import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import { listAccommodationReservations } from '../../services/accommodationReservationService';
import { resolveMobileDestination } from '../../navigation/navigationSdk';

const FILTERS = [
  ['all', 'Toutes'], ['pending', 'En attente'], ['confirmed', 'Confirmées'],
  ['checked_in', 'En cours'], ['checked_out', 'Terminées'], ['cancelled', 'Annulées'],
];
const date = (value) => new Date(value).toLocaleDateString('fr-FR');
const money = (value, currency = 'XAF') => `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;
const label = (value) => ({ pending: 'En attente', confirmed: 'Confirmée', checked_in: 'En cours', checked_out: 'Terminée', cancelled: 'Annulée', no_show: 'Non-présentation' }[value] || value);

export default function MyAccommodationReservationsScreen({ navigation }) {
  const { themeColors: c } = useTheme(); const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c, width >= 700), [c, width]);
  const [filter, setFilter] = useState('all'); const [items, setItems] = useState([]);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false); const [error, setError] = useState('');

  const load = useCallback(async ({ nextPage = 1, append = false, refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true); setError('');
    try {
      const result = await listAccommodationReservations({ page: nextPage, limit: 10, ...(filter === 'all' ? {} : { status: filter }) }, { refresh });
      const data = result.data || {}; setItems((current) => append ? [...current, ...(data.reservations || [])] : data.reservations || []);
      setPage(data.page || nextPage); setPages(data.totalPages || 1); setOffline(result.offline);
    } catch (loadError) { setError(loadError.response?.data?.message || loadError.normalized?.message || 'Réservations indisponibles.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const open = (id) => {
    const target = resolveMobileDestination('ACCOMMODATION_RESERVATION_DETAILS', { id });
    if (target?.params?.screen) navigation.navigate(target.params.screen, target.params.params);
  };
  return <SafeAreaView style={styles.safe} edges={['top']}><PageHeader title="Mes hébergements" onBack={() => navigation.goBack()}/>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={c.gold}/> }>
      {offline && <View accessibilityRole="alert" style={styles.offline}><Ionicons name="cloud-offline-outline" size={18} color={c.warning}/><Text style={styles.offlineText}>Données hors ligne — lecture seule</Text></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.map(([key, title]) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterActive]}><Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{title}</Text></TouchableOpacity>)}</ScrollView>
      {loading && items.length === 0 ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={130} style={styles.skeleton}/>) : null}
      {error ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Button label="Réessayer" onPress={() => load({ refresh: true })}/></View> : null}
      {!loading && !error && items.length === 0 ? <EmptyState icon="bed-outline" title="Aucun séjour" subtitle="Vos demandes d’hébergement apparaîtront ici."/> : null}
      <View style={styles.grid}>{items.map((item) => <TouchableOpacity key={item._id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${item.accommodation?.property?.title || 'le séjour'}`} onPress={() => open(item._id)} style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>{item.accommodation?.property?.title || 'Hébergement'}</Text><Text style={styles.status}>{label(item.status)}</Text></View>
        <Text style={styles.text}>{date(item.checkInDate)} → {date(item.checkOutDate)} · {item.nights} nuit(s)</Text>
        <Text style={styles.text}>{item.guestCount} voyageur(s) · {money(item.total, item.currency)}</Text>
        <Text style={styles.meta}>Paiement : {label(item.paymentStatus)} · Solde {money(item.remainingAmount ?? item.total, item.currency)}</Text>
      </TouchableOpacity>)}</View>
      {page < pages && <Button label="Afficher plus" variant="outline" loading={loading} onPress={() => load({ nextPage: page + 1, append: true })}/>} 
    </ScrollView></SafeAreaView>;
}

const makeStyles = (c, tablet) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  offline: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.warning }, offlineText: { color: c.text, fontFamily: fonts.body },
  filters: { gap: spacing.sm }, filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: c.border }, filterActive: { backgroundColor: c.gold, borderColor: c.gold }, filterText: { color: c.textSub, fontFamily: fonts.bodyBold }, filterTextActive: { color: '#0A0A0A' },
  grid: { flexDirection: tablet ? 'row' : 'column', flexWrap: 'wrap', gap: spacing.md }, card: { width: tablet ? '48%' : '100%', minHeight: 126, padding: spacing.md, gap: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, cardTitle: { flex: 1, color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.md }, status: { color: c.gold, fontFamily: fonts.bodyBold }, text: { color: c.textSub, fontFamily: fonts.body }, meta: { color: c.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm }, skeleton: { borderRadius: radius.sm }, error: { gap: spacing.sm }, errorText: { color: c.error, fontFamily: fonts.body },
});
