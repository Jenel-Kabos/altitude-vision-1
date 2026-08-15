import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_STATUS_LABELS } from '../../constants/maintenance';
import useHotelRealtime from '../../hooks/useHotelRealtime';
import { approveInspection, createInspection, rejectInspection } from '../../services/housekeepingService';
import {
  closeMaintenanceTicket, getHotelMaintenanceTickets, resolveMaintenanceTicket, startMaintenanceWork,
} from '../../services/hotelMaintenanceService';

// SYNC-2B — maintenance HÔTELIÈRE (MaintenanceTicket), strictement distincte
// de la maintenance locative GL (TenantPortalScreen/tenantPortalService.js,
// RentalMaintenanceTicket) — jamais fusionnées, même écran ni même service.
// Miroir de client/lib/pages/dashboard/MaintenanceDashboardPage.jsx.
export default function HotelMaintenanceScreen({ route }) {
  const { hotelId } = route.params || {};
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inspections, setInspections] = useState({}); // ticketId -> ré-inspection en attente

  const load = useCallback(async () => {
    // Mandat §11 — jamais de requête PMS globale filtrée seulement côté UI.
    if (!hotelId) { setTickets([]); return; }
    setLoading(true);
    try { setTickets(await getHotelMaintenanceTickets({ hotelId })); }
    catch (error) { Alert.alert('Erreur', error.normalized?.message || 'Tickets indisponibles.'); }
    finally { setLoading(false); }
  }, [hotelId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // SYNC-2C — voir HotelHousekeepingScreen.jsx : `useFocusEffect` ne
  // recharge pas sur un simple changement de `hotelId` sans transition de
  // focus (deux notifications hôtel différentes tapées sans quitter l'écran).
  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useHotelRealtime(hotelId, useCallback((event) => {
    if (String(event?.eventType || '').startsWith('maintenance.') || String(event?.eventType || '').startsWith('inspection.')) load();
  }, [load]));

  const run = async (action) => {
    setLoading(true);
    try { await action(); await load(); }
    catch (error) { Alert.alert('Action impossible', error.response?.data?.message || error.normalized?.message || 'Réessayez.'); setLoading(false); }
  };

  const reinspect = async (ticket) => {
    const housekeepingTaskId = ticket.inspection?.housekeepingTask?._id;
    if (!housekeepingTaskId) { Alert.alert('Ré-inspection impossible', 'Aucune tâche de ménage d’origine trouvée pour cette chambre.'); return; }
    try {
      const inspection = await createInspection({ roomId: ticket.room?._id, housekeepingTaskId });
      setInspections((prev) => ({ ...prev, [ticket._id]: inspection }));
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Création de la ré-inspection impossible.'); }
  };
  const decide = async (ticket, approve) => {
    const inspection = inspections[ticket._id];
    if (!inspection) return;
    try {
      if (approve) await approveInspection(inspection._id);
      else await rejectInspection(inspection._id, 'Ré-inspection échouée depuis l’application mobile.');
      setInspections((prev) => { const next = { ...prev }; delete next[ticket._id]; return next; });
      await load();
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Décision impossible.'); }
  };

  if (!hotelId) return <Screen style={styles.content}><Text style={styles.text}>Aucun hôtel sélectionné.</Text></Screen>;

  return <Screen scroll style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Maintenance</Text>
    <Button label="Actualiser" variant="ghost" loading={loading} onPress={load} />
    {!loading && tickets.length === 0 && <Text style={styles.empty}>Aucun ticket de maintenance.</Text>}
    {tickets.map((ticket) => <View key={ticket._id} style={styles.card} accessibilityLabel={`Chambre ${ticket.room?.roomNumber}`}>
      <Text style={styles.reference}>Chambre {ticket.room?.roomNumber}{ticket.room?.floor != null ? ` · étage ${ticket.room.floor}` : ''}</Text>
      <Text style={styles.text}>{MAINTENANCE_CATEGORY_LABELS[ticket.category] || ticket.category} · {MAINTENANCE_STATUS_LABELS[ticket.status] || ticket.status}</Text>
      <Text style={styles.text}>{ticket.description}</Text>
      <Text style={styles.text}>Technicien : {ticket.assignedTo?.name || '—'}</Text>
      <View style={styles.row}>
        {(ticket.status === 'open' || ticket.status === 'assigned') && <Button label="Démarrer" variant="outline" onPress={() => run(() => startMaintenanceWork(ticket._id))} />}
        {ticket.status === 'in_progress' && <Button label="Résoudre" onPress={() => run(() => resolveMaintenanceTicket(ticket._id))} />}
        {ticket.status === 'resolved' && !inspections[ticket._id] && <Button label="Ré-inspecter" variant="outline" onPress={() => reinspect(ticket)} />}
        {ticket.status === 'resolved' && inspections[ticket._id] && <>
          <Button label="Approuver" onPress={() => decide(ticket, true)} />
          <Button label="Rejeter" variant="danger" onPress={() => decide(ticket, false)} />
        </>}
        {ticket.status === 'resolved' && <Button label="Clôturer" variant="ghost" onPress={() => run(() => closeMaintenanceTicket(ticket._id))} />}
      </View>
    </View>)}
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md }, title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reference: { color: c.text, fontFamily: fonts.bodyBold }, text: { color: c.textSub, fontFamily: fonts.body },
  empty: { color: c.textMuted, textAlign: 'center' },
});
