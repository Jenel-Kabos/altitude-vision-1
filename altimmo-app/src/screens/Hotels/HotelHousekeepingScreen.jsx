import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { HOUSEKEEPING_PRIORITY_LABELS, HOUSEKEEPING_STATUS_LABELS, HOUSEKEEPING_TYPE_LABELS } from '../../constants/housekeeping';
import useHotelRealtime from '../../hooks/useHotelRealtime';
import {
  approveInspection, cancelHousekeepingTask, completeHousekeepingTask, createInspection,
  getHousekeepingTasks, rejectInspection, startHousekeepingTask,
} from '../../services/housekeepingService';

// SYNC-2B — écran terrain (ménage + inspection, même page combinée que
// client/lib/pages/dashboard/HousekeepingDashboardPage.jsx, mission E2E-1 :
// « la fin du nettoyage mène à l'inspection, pas directement à disponible »).
// Le backend reste l'autorité de chaque transition — cet écran affiche,
// demande, envoie, interprète (mandat §18) ; il ne décide jamais localement
// qu'une inspection échouée implique une maintenance obligatoire (mandat §28).
export default function HotelHousekeepingScreen({ route }) {
  const { hotelId } = route.params || {};
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inspections, setInspections] = useState({}); // taskId -> inspection en attente de décision
  // Les capacités hôtel (hotel.housekeeping.manage, etc.) sont un espace de
  // permissions PAR HÔTEL via `HotelStaffAssignment` — distinct de la
  // projection IAM-3 (`staffCapabilities.js`, rôles globaux). Aucun garde
  // client ne peut reproduire ce scope sans le requêter séparément ; comme
  // `HotelOperationsScreen.jsx` existant, les actions restent visibles et le
  // backend (`assertOperationalHotelAccess`) reste la seule sécurité réelle,
  // un refus se traduisant par le message d'erreur déjà géré ci-dessous.

  const load = useCallback(async () => {
    // Mandat §11 : jamais de requête PMS globale filtrée seulement côté UI —
    // sans hotelId sélectionné, ne rien charger plutôt que renvoyer tous les
    // hôtels accessibles au propriétaire/staff (fuite de contexte potentielle).
    if (!hotelId) { setTasks([]); return; }
    setLoading(true);
    try { setTasks(await getHousekeepingTasks({ hotelId })); }
    catch (error) { Alert.alert('Erreur', error.normalized?.message || 'Tâches indisponibles.'); }
    finally { setLoading(false); }
  }, [hotelId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // SYNC-2C — `useFocusEffect` seul ne suffit PAS : il ne se redéclenche que
  // sur un événement de focus réel (retour sur l'écran), jamais sur un simple
  // changement de `route.params.hotelId` pendant que l'écran est DÉJÀ au
  // premier plan (ex. deux notifications hôtel A puis B tapées coup sur coup
  // sans quitter l'écran) — bug réel démontré, corrigé en rechargeant aussi
  // explicitement sur tout changement de `hotelId`.
  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useHotelRealtime(hotelId, useCallback((event) => {
    if (String(event?.eventType || '').startsWith('housekeeping.') || String(event?.eventType || '').startsWith('inspection.')) load();
  }, [load]));

  const run = async (action, success) => {
    setLoading(true);
    try { await action(); await load(); }
    catch (error) { Alert.alert('Action impossible', error.response?.data?.message || error.normalized?.message || 'Réessayez.'); setLoading(false); }
  };

  const inspect = async (task) => {
    try {
      const inspection = await createInspection({ roomId: task.room?._id, housekeepingTaskId: task._id });
      setInspections((prev) => ({ ...prev, [task._id]: inspection }));
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Création de l’inspection impossible.'); }
  };
  const decide = async (task, approve) => {
    const inspection = inspections[task._id];
    if (!inspection) return;
    try {
      if (approve) await approveInspection(inspection._id);
      else await rejectInspection(inspection._id, 'Inspection échouée depuis l’application mobile.');
      setInspections((prev) => { const next = { ...prev }; delete next[task._id]; return next; });
      await load();
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Décision impossible.'); }
  };

  if (!hotelId) return <Screen style={styles.content}><Text style={styles.text}>Aucun hôtel sélectionné.</Text></Screen>;

  return <Screen scroll style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Ménage</Text>
    <Button label="Actualiser" variant="ghost" loading={loading} onPress={load} />
    {!loading && tasks.length === 0 && <Text style={styles.empty}>Aucune tâche de ménage.</Text>}
    {tasks.map((task) => <View key={task._id} style={styles.card} accessibilityLabel={`Chambre ${task.room?.roomNumber}`}>
      <View style={styles.row}>
        <Text style={styles.reference}>Chambre {task.room?.roomNumber}{task.room?.floor != null ? ` · étage ${task.room.floor}` : ''}</Text>
        <Text style={styles.priority}>{HOUSEKEEPING_PRIORITY_LABELS[task.priority] || task.priority}</Text>
      </View>
      <Text style={styles.text}>{HOUSEKEEPING_TYPE_LABELS[task.type] || task.type} · {HOUSEKEEPING_STATUS_LABELS[task.status] || task.status}</Text>
      <Text style={styles.text}>Assigné : {task.assignedTo?.name || '—'}</Text>
      <View style={styles.row}>
        {(task.status === 'pending' || task.status === 'assigned') && <Button label="Démarrer" variant="outline" onPress={() => run(() => startHousekeepingTask(task._id))} />}
        {task.status === 'in_progress' && <Button label="Terminer" onPress={() => run(() => completeHousekeepingTask(task._id))} />}
        {task.status === 'completed' && !inspections[task._id] && <Button label="Inspecter" variant="outline" onPress={() => inspect(task)} />}
        {task.status === 'completed' && inspections[task._id] && <>
          <Button label="Approuver" onPress={() => decide(task, true)} />
          <Button label="Rejeter" variant="danger" onPress={() => decide(task, false)} />
        </>}
        {!['completed', 'cancelled'].includes(task.status) && <Button label="Annuler" variant="ghost" onPress={() => run(() => cancelHousekeepingTask(task._id, 'Annulée depuis l’application mobile.'))} />}
      </View>
    </View>)}
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md }, title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', alignItems: 'center' },
  reference: { color: c.text, fontFamily: fonts.bodyBold }, priority: { color: c.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  text: { color: c.textSub, fontFamily: fonts.body }, empty: { color: c.textMuted, textAlign: 'center' },
});
