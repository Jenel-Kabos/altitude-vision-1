import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { cancelHotelReservation, getMyHotelReservations } from '../../services/hotelReservationService';

export default function MyHotelReservationsScreen({ navigation }) {
  const { themeColors: c } = useTheme(); const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setItems(await getMyHotelReservations()); } catch (error) { Alert.alert('Erreur', error.normalized?.message || 'Réservations indisponibles.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const cancel = (item) => Alert.alert('Annuler la réservation', item.reference, [{ text: 'Retour', style: 'cancel' }, { text: 'Annuler', style: 'destructive', onPress: async () => { try { await cancelHotelReservation(item._id, 'Annulation depuis l’application mobile'); load(); } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Annulation impossible.'); } } }]);
  return <Screen scroll style={styles.content}><Text accessibilityRole="header" style={styles.title}>Mes réservations hôtel</Text><Button label="Réserver un hôtel" icon="add" onPress={() => navigation.navigate('HotelBooking')} style={styles.action} />
    <Button label="Actualiser" variant="ghost" loading={loading} onPress={load} />
    {items.map((item) => <TouchableOpacity key={item._id} accessibilityRole="button" onPress={() => navigation.navigate('HotelReservationDetail', { reservationId: item._id })} style={styles.card}><View style={styles.row}><Text style={styles.reference}>{item.reference}</Text><Text style={styles.status}>{item.status}</Text></View><Text style={styles.text}>{item.hotel?.name || 'Hôtel'}</Text><Text style={styles.text}>{new Date(item.checkInDate).toLocaleDateString('fr-FR')} → {new Date(item.checkOutDate).toLocaleDateString('fr-FR')}</Text><Text style={styles.text}>{item.roomsCount} chambre(s) · {Number(item.totalAmount || 0).toLocaleString('fr-FR')} FCFA</Text>{['pending', 'confirmed'].includes(item.status) && <Button label="Annuler" variant="danger" onPress={() => cancel(item)} style={styles.small} />}</TouchableOpacity>)}
    {!loading && items.length === 0 && <Text style={styles.empty}>Aucune réservation.</Text>}
  </Screen>;
}
const makeStyles = (c) => StyleSheet.create({ content: { gap: spacing.md }, title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text }, action: { marginBottom: spacing.sm }, card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs }, row: { flexDirection: 'row', justifyContent: 'space-between' }, reference: { color: c.text, fontFamily: fonts.bodyBold }, status: { color: c.gold, fontFamily: fonts.bodyBold }, text: { color: c.textSub, fontFamily: fonts.body }, small: { marginTop: spacing.sm }, empty: { color: c.textMuted, textAlign: 'center' } });
