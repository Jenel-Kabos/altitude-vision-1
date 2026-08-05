import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import { getPersonalDocuments, PERSONAL_DOCUMENT_CATEGORIES } from '../../services/personalDocumentService';
import { resolveMobileDestination } from '../../navigation/navigationSdk';

const PAGE_SIZE = 20;
const formatDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : 'Date indisponible';

export default function MyDocumentsScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c, width >= 700), [c, width]);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tous');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true); setError('');
    try { const result = await getPersonalDocuments({ refresh }); setDocuments(result.documents); setOffline(result.offline); }
    catch (loadError) { setError(loadError.normalized?.message || 'Impossible de charger vos documents.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, category, sort]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((item) => (category === 'Tous' || item.category === category)
      && (!needle || [item.title, item.category, item.contextLabel, item.status].some((value) => String(value || '').toLowerCase().includes(needle))))
      .sort((a, b) => (sort === 'oldest' ? 1 : -1) * (new Date(a.date || 0) - new Date(b.date || 0)));
  }, [category, documents, query, sort]);
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const open = (document) => { const target = resolveMobileDestination('MY_DOCUMENT_DETAILS', { id: document.id }); if (target) navigation.navigate(target.screen, target.params); };

  if (loading) return <SafeAreaView style={styles.safe}><PageHeader title="Mes documents" onBack={navigation.goBack}/><View style={styles.loading}>{[1, 2, 3, 4].map((key) => <Skeleton key={key} width="100%" height={92} style={styles.skeleton}/>)}</View></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.safe}><PageHeader title="Mes documents" onBack={navigation.goBack}/><EmptyState icon="folder-open-outline" title="Coffre indisponible" subtitle={error} actionLabel="Réessayer" onAction={load}/></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <PageHeader title="Mes documents" subtitle={offline ? 'Métadonnées en cache' : `${documents.length} document(s) autorisé(s)`} onBack={navigation.goBack}/>
    {offline && <View style={styles.offline}><Ionicons name="cloud-offline-outline" size={16} color={c.warning}/><Text style={styles.offlineText}>Lecture hors connexion · fichiers sécurisés indisponibles</Text></View>}
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={c.gold}/>} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.search}><Ionicons name="search-outline" size={18} color={c.textMuted}/><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un document" placeholderTextColor={c.placeholder} style={styles.input} accessibilityLabel="Rechercher dans mes documents"/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{['Tous', ...PERSONAL_DOCUMENT_CATEGORIES].map((item) => <TouchableOpacity key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: category === item }}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>
      <View style={styles.sort}><Text style={styles.result}>{filtered.length} résultat(s)</Text><TouchableOpacity onPress={() => setSort((value) => value === 'recent' ? 'oldest' : 'recent')} accessibilityRole="button"><Text style={styles.sortText}>{sort === 'recent' ? 'Plus récents' : 'Plus anciens'} ↕</Text></TouchableOpacity></View>
      {!visible.length ? <EmptyState icon="document-text-outline" title="Aucun document" subtitle="Aucun document personnel ne correspond à ces critères."/> : <View style={styles.grid}>{visible.map((item) => <Card key={item.id} style={styles.card}><TouchableOpacity onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`Ouvrir ${item.title}`} style={styles.row}><View style={styles.icon}><Ionicons name="document-text-outline" size={22} color={c.gold}/></View><View style={styles.body}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.category} · {formatDate(item.date)}</Text><Text style={styles.context}>{item.contextLabel || item.status || 'Document personnel'}</Text></View><Ionicons name="chevron-forward" size={18} color={c.textMuted}/></TouchableOpacity></Card>)}</View>}
      {visible.length < filtered.length && <Button label="Charger la suite" variant="outline" onPress={() => setPage((value) => value + 1)} style={styles.more}/>} 
    </ScrollView>
  </SafeAreaView>;
}

const makeStyles = (c, tablet) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, loading: { padding: spacing.md }, skeleton: { marginBottom: spacing.md },
  offline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: spacing.sm, backgroundColor: c.goldLight }, offlineText: { color: c.warning, fontFamily: fonts.bodyMedium, fontSize: fontSize.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, maxWidth: tablet ? 1000 : undefined, width: '100%', alignSelf: 'center' }, search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.inputBorder, borderRadius: radius.sm, paddingHorizontal: spacing.sm, backgroundColor: c.bgCard }, input: { flex: 1, minHeight: 46, marginLeft: spacing.xs, color: c.text, fontFamily: fonts.body }, chips: { gap: spacing.xs, paddingVertical: spacing.md }, chip: { borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingHorizontal: spacing.sm, paddingVertical: 8 }, chipActive: { backgroundColor: c.gold, borderColor: c.gold }, chipText: { color: c.textSub, fontFamily: fonts.bodyMedium, fontSize: fontSize.xs }, chipTextActive: { color: c.onAccent }, sort: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }, result: { color: c.textSub, fontFamily: fonts.body }, sortText: { color: c.gold, fontFamily: fonts.bodyBold }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, card: { width: tablet ? '48.8%' : '100%', padding: 0 }, row: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldLight }, body: { flex: 1 }, title: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.sm }, meta: { color: c.textSub, fontFamily: fonts.body, fontSize: fontSize.xs, marginTop: 4 }, context: { color: c.textMuted, fontFamily: fonts.body, fontSize: fontSize.xs, marginTop: 3 }, more: { marginTop: spacing.md },
});
