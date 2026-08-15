import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import useHotelRealtime from '../../hooks/useHotelRealtime';
import { getHotelCockpitAnalytics } from '../../services/hotelReservationService';

// SYNC-2B — cockpit hôtel mobile. UNIQUEMENT les champs `kpis` réellement
// renvoyés par /api/dashboard-analytics/hotels (mêmes que
// client/lib/pages/dashboard/HotelDetailPage.jsx). Aucun KPI inventé
// (revenu, taux d'occupation, ADR, RevPAR — mandat §14) : ils n'existent pas
// dans cette réponse et ne sont donc jamais affichés.
export default function HotelCockpitScreen({ route, navigation }) {
  const { hotelId } = route.params || {};
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    // Mandat §11 — jamais de requête PMS globale filtrée seulement côté UI.
    if (!hotelId) { setKpis(null); return; }
    setLoading(true);
    try { const data = await getHotelCockpitAnalytics(hotelId); setKpis(data?.kpis || {}); setUnavailable(false); }
    catch { setUnavailable(true); } // panne d'agrégat non bloquante (DASH-3 §8) : les outils restent accessibles
    finally { setLoading(false); }
  }, [hotelId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // SYNC-2C — voir HotelHousekeepingScreen.jsx.
  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useHotelRealtime(hotelId, useCallback(() => load(), [load]));

  if (!hotelId) return <Screen style={styles.content}><Text style={styles.text}>Aucun hôtel sélectionné.</Text></Screen>;

  const cards = kpis ? [
    { label: 'Occupation', value: `${kpis.occupiedRooms || 0}/${kpis.totalRooms || 0}`, onPress: () => navigation.navigate('HotelOperations', { hotelId }) },
    { label: 'Arrivées aujourd’hui', value: kpis.checkInsToday || 0, detail: `${kpis.pendingCheckIns || 0} check-in en attente`, onPress: () => navigation.navigate('HotelOperations', { hotelId }) },
    { label: 'Départs aujourd’hui', value: kpis.checkOutsToday || 0, detail: `${kpis.pendingCheckOuts || 0} check-out en attente`, onPress: () => navigation.navigate('HotelOperations', { hotelId }) },
    { label: 'À nettoyer', value: kpis.cleaningRooms || 0, detail: `${kpis.housekeeping || 0} tâche(s) ouverte(s)`, onPress: () => navigation.navigate('HotelHousekeeping', { hotelId }) },
    { label: 'À inspecter', value: kpis.inspectionRooms || 0, onPress: () => navigation.navigate('HotelHousekeeping', { hotelId }) },
    { label: 'Maintenance', value: kpis.maintenance || 0, detail: `${kpis.outOfServiceRooms || 0} chambre(s) hors service`, onPress: () => navigation.navigate('HotelMaintenance', { hotelId }) },
    { label: 'Alertes financières', value: kpis.remainingAmount ? 'Solde émis restant' : 'Aucun solde émis' },
  ] : [];

  return <Screen scroll style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Cockpit</Text>
    <Button label="Actualiser" variant="ghost" loading={loading} onPress={load} />
    {unavailable && <Text style={styles.text}>Indicateurs indisponibles pour le moment — les outils restent accessibles ci-dessous.</Text>}
    <View style={styles.grid}>
      {cards.map((card) => (
        <View key={card.label} style={styles.card} accessible accessibilityLabel={`${card.label} : ${card.value}`}>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={styles.value}>{card.value}</Text>
          {card.detail && <Text style={styles.detail}>{card.detail}</Text>}
          {card.onPress && <Button label="Ouvrir" variant="outline" onPress={card.onPress} style={styles.open} />}
        </View>
      ))}
    </View>
    <View style={styles.row}>
      <Button label="Réservations" variant="outline" onPress={() => navigation.navigate('HotelOperations', { hotelId })} />
      <Button label="Ménage" variant="outline" onPress={() => navigation.navigate('HotelHousekeeping', { hotelId })} />
      <Button label="Maintenance" variant="outline" onPress={() => navigation.navigate('HotelMaintenance', { hotelId })} />
    </View>
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md }, title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs, minWidth: '46%', flexGrow: 1 },
  label: { color: c.textSub, fontFamily: fonts.body, fontSize: fontSize.sm },
  value: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.lg },
  detail: { color: c.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm },
  open: { marginTop: spacing.xs },
  text: { color: c.textSub, fontFamily: fonts.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
