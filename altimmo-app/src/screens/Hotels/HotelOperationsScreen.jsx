import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import useHotelRealtime from '../../hooks/useHotelRealtime';
import {
  assignHotelRoom, autoAssignHotelRooms, changeHotelRoom, checkInHotelReservation,
  checkOutHotelReservation, getAccessibleHotels, getCheckoutFinancialReadiness, getHotelInventory, getHotelRooms,
  getOwnerHotelReservations, getReservationAssignments, updateHotelInventory,
} from '../../services/hotelReservationService';

const isoDay = (offset = 0) => { const day = new Date(); day.setUTCDate(day.getUTCDate() + offset); return day.toISOString().slice(0, 10); };
// SYNC-2B — même libellé que client/lib/components/RoomAssignmentPanel.jsx (E2E-1).
const READINESS_LABELS = { ready: 'Prêt pour check-out', warning: 'Prêt avec avertissements', blocked: 'Check-out bloqué' };

export default function HotelOperationsScreen({ navigation, route }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [hotelId, setHotelId] = useState(route?.params?.hotelId || '');
  // SYNC-2C — `useState(route.params.hotelId)` ne lit la valeur initiale
  // qu'au premier montage ; sans cette synchronisation, taper une
  // notification Hôtel B alors que l'écran est déjà ouvert sur Hôtel A (donc
  // déjà monté, jamais démonté/remonté) laisserait `hotelId` figé sur A —
  // bug réel démontré (mandat SYNC-2C §51 : switch hôtel via notification).
  useEffect(() => {
    if (route?.params?.hotelId && route.params.hotelId !== hotelId) setHotelId(route.params.hotelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.hotelId]);
  const [hotels, setHotels] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomIds, setRoomIds] = useState({});
  const [oldRoomIds, setOldRoomIds] = useState({});
  const [rooms, setRooms] = useState({});
  const [inventory, setInventory] = useState(null);
  const [readiness, setReadiness] = useState({}); // reservationId -> financialReadiness

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOwnerHotelReservations({ hotelId: hotelId || undefined, limit: 50 });
      const list = data.reservations || [];
      setItems(list);
      // SYNC-2B — E2E-1 a démontré qu'afficher l'état financier AVANT le
      // check-out (pas seulement au clic) évite un check-out « à l'aveugle ».
      const checkedIn = list.filter((item) => item.status === 'checked_in');
      const entries = await Promise.all(checkedIn.map((item) => getCheckoutFinancialReadiness(item._id).then((value) => [item._id, value]).catch(() => [item._id, null])));
      setReadiness(Object.fromEntries(entries));
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Opérations indisponibles.'); }
    finally { setLoading(false); }
  }, [hotelId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // SYNC-2C — voir HotelHousekeepingScreen.jsx : recharge aussi hors
  // transition de focus (switch hôtel via notification sans quitter l'écran).
  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { getAccessibleHotels().then(setHotels).catch(() => setHotels([])); }, []));
  // Signal de rafraîchissement uniquement (mandat §34) — un événement
  // réservation/finance recharge la liste ET l'état financier via HTTP,
  // jamais une mutation locale directe à partir du payload socket.
  useHotelRealtime(hotelId, useCallback((event) => {
    if (String(event?.eventType || '').startsWith('reservation.') || String(event?.eventType || '').includes('financial')) load();
  }, [load]));

  const run = async (action, success) => {
    setLoading(true);
    try { await action(); Alert.alert('Succès', success); await load(); }
    catch (error) { Alert.alert('Action impossible', error.response?.data?.message || error.normalized?.message || 'Réessayez après actualisation.'); setLoading(false); }
  };
  const loadInventory = async () => {
    if (!hotelId) return Alert.alert('Hôtel requis', 'Saisissez l’identifiant de l’hôtel.');
    setLoading(true);
    try { setInventory(await getHotelInventory(hotelId, { from: isoDay(), to: isoDay(8) })); }
    catch (error) { Alert.alert('Inventaire indisponible', error.response?.data?.message || 'Impossible de charger la semaine.'); }
    finally { setLoading(false); }
  };
  const setRoomValue = (id, value) => setRoomIds((state) => ({ ...state, [id]: value }));
  const loadRoomChoices = async (item) => {
    const resolvedHotelId = item.hotel?._id || item.hotel;
    setLoading(true);
    try {
      const [available, assignmentData] = await Promise.all([
        getHotelRooms(resolvedHotelId, { roomCategoryId: item.roomCategory?._id || item.roomCategory, status: 'available' }),
        getReservationAssignments(item._id),
      ]);
      setRooms((state) => ({ ...state, [item._id]: available || [] }));
      const active = assignmentData.activeRoomAssignments || [];
      if (active[0]?.room?._id) setOldRoomIds((state) => ({ ...state, [item._id]: active[0].room._id }));
    } catch (error) { Alert.alert('Chambres indisponibles', error.response?.data?.message || 'Impossible de charger les chambres.'); }
    finally { setLoading(false); }
  };

  return <Screen scroll style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Opérations hôtelières</Text>
    <Text style={styles.sectionLabel}>Hôtel exploité</Text>
    <View style={styles.row}>{hotels.map((hotel) => <Button key={hotel.id} label={hotel.name} variant={hotelId === String(hotel.id) ? 'primary' : 'outline'} onPress={() => setHotelId(String(hotel.id))} />)}</View>
    <View style={styles.row}><Button label="Actualiser" variant="outline" loading={loading} onPress={load} /><Button label="Inventaire 7 jours" variant="outline" onPress={loadInventory} /></View>
    {inventory && <View style={styles.card} accessible accessibilityLabel="Inventaire simplifié sur sept jours">
      <Text style={styles.reference}>Inventaire · {inventory.days?.length || 0} lignes</Text>
      {(inventory.days || []).slice(0, 14).map((day) => <View key={day.id || `${day.roomCategory}-${day.date}`} style={styles.inventoryLine}><Text style={styles.text}>{String(day.date).slice(0, 10)} · {day.categoryName}</Text><Text style={styles.text}>{day.availableUnits} libre(s){day.stopSell ? ' · stop-sell' : ''} · {day.physicalOutOfService || 0} HS</Text><View style={styles.row}><Button label={day.stopSell ? 'Rouvrir' : 'Stop-sell'} variant="outline" onPress={() => run(() => updateHotelInventory(hotelId, { roomCategoryId: day.roomCategory, from: String(day.date).slice(0, 10), to: new Date(new Date(day.date).getTime() + 86400000).toISOString().slice(0, 10), stopSell: !day.stopSell, reason: 'Mobile operations' }), 'Inventaire mis à jour.')} /></View></View>)}
    </View>}
    {items.map((item) => <View key={item._id} style={styles.card}>
      <Text style={styles.reference}>{item.reference} · {item.status}</Text>
      <Text style={styles.text}>{item.guest?.firstName} {item.guest?.lastName} · {item.roomsCount} chambre(s)</Text>
      {item.status === 'confirmed' && <>
        <Button label="Choisir une chambre disponible" variant="outline" onPress={() => loadRoomChoices(item)} />
        {(rooms[item._id] || []).length > 0 && <View accessibilityRole="radiogroup" accessibilityLabel={`Chambres disponibles pour ${item.reference}`} style={styles.row}>{rooms[item._id].map((room) => <Button key={room._id} label={`Chambre ${room.roomNumber}${room.floor == null ? '' : ` · étage ${room.floor}`}`} variant={roomIds[item._id] === room._id ? 'primary' : 'secondary'} onPress={() => setRoomValue(item._id, room._id)} />)}</View>}
        <View style={styles.row}><Button label="Affecter" variant="outline" disabled={!roomIds[item._id]} onPress={() => run(() => assignHotelRoom(item._id, roomIds[item._id]), 'Chambre affectée.')} /><Button label="Auto" variant="secondary" onPress={() => run(() => autoAssignHotelRooms(item._id), 'Chambres affectées.')} /></View>
        <Button label="Changer de chambre" variant="outline" disabled={!oldRoomIds[item._id] || !roomIds[item._id]} onPress={() => run(() => changeHotelRoom(item._id, oldRoomIds[item._id], roomIds[item._id], 'Changement Mobile'), 'Chambre changée.')} />
        <Button label="Check-in de toutes les chambres" onPress={() => run(() => checkInHotelReservation(item._id, { autoAssign: true }), 'Check-in effectué.')} />
      </>}
      {item.status === 'checked_in' && <>
        {readiness[item._id] && <View accessibilityLabel="État financier avant check-out" style={styles.readiness}>
          <Text style={styles.readinessLabel}>{READINESS_LABELS[readiness[item._id].status] || readiness[item._id].status}</Text>
          {(readiness[item._id].blockers || []).map((b) => <Text key={b.code} style={styles.readinessBlocker}>{b.code}</Text>)}
        </View>}
        <Button
          label="Check-out / départ anticipé"
          variant="danger"
          disabled={readiness[item._id]?.status === 'blocked'}
          onPress={() => run(() => checkOutHotelReservation(item._id), 'Check-out effectué.')}
        />
      </>}
    </View>)}
    {hotelId && <View style={styles.row}>
      <Button label="Cockpit" variant="outline" onPress={() => navigation.navigate('HotelCockpit', { hotelId })} />
      <Button label="Ménage" variant="outline" onPress={() => navigation.navigate('HotelHousekeeping', { hotelId })} />
      <Button label="Maintenance" variant="outline" onPress={() => navigation.navigate('HotelMaintenance', { hotelId })} />
    </View>}
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md }, title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  sectionLabel: { color: c.text, fontFamily: fonts.bodyBold },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  reference: { color: c.text, fontFamily: fonts.bodyBold }, text: { color: c.textSub, fontFamily: fonts.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, inventoryLine: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: spacing.xs },
  readiness: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: spacing.xs },
  readinessLabel: { color: c.text, fontFamily: fonts.bodyBold }, readinessBlocker: { color: c.danger || '#B91C1C', fontFamily: fonts.body, fontSize: fontSize.sm },
});
