import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import {
  assignHotelRoom, autoAssignHotelRooms, changeHotelRoom, checkInHotelReservation,
  checkOutHotelReservation, getAccessibleHotels, getHotelInventory, getHotelRooms, getOwnerHotelReservations, getReservationAssignments,
  updateHotelInventory,
} from '../../services/hotelReservationService';

const isoDay = (offset = 0) => { const day = new Date(); day.setUTCDate(day.getUTCDate() + offset); return day.toISOString().slice(0, 10); };

export default function HotelOperationsScreen() {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [hotelId, setHotelId] = useState('');
  const [hotels, setHotels] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomIds, setRoomIds] = useState({});
  const [oldRoomIds, setOldRoomIds] = useState({});
  const [rooms, setRooms] = useState({});
  const [inventory, setInventory] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await getOwnerHotelReservations({ hotelId: hotelId || undefined, limit: 50 }); setItems(data.reservations || []); }
    catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Opérations indisponibles.'); }
    finally { setLoading(false); }
  }, [hotelId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { getAccessibleHotels().then(setHotels).catch(() => setHotels([])); }, []));

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
      {item.status === 'checked_in' && <Button label="Check-out / départ anticipé" variant="danger" onPress={() => run(() => checkOutHotelReservation(item._id), 'Check-out effectué.')} />}
    </View>)}
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md }, title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  sectionLabel: { color: c.text, fontFamily: fonts.bodyBold },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  reference: { color: c.text, fontFamily: fonts.bodyBold }, text: { color: c.textSub, fontFamily: fonts.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, inventoryLine: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: spacing.xs },
});
