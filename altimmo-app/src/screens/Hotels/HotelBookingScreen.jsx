import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { createHotelReservation, getHotelAvailability, getPublicHotel, newReservationRequestId, searchPublicHotels } from '../../services/hotelReservationService';

const PAGE_SIZE = 8;
const nightsBetween = (from, to) => Math.max(0, Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000));
const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XAF`;

export default function HotelBookingScreen({ navigation }) {
  const { themeColors: c } = useTheme(); const styles = useMemo(() => makeStyles(c), [c]);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState({ name: '', city: '', page: 1 }); const [hotels, setHotels] = useState([]); const [total, setTotal] = useState(0);
  const [hotelData, setHotelData] = useState(null); const [availability, setAvailability] = useState({}); const [selectedCategory, setSelectedCategory] = useState(null); const [selectedRate, setSelectedRate] = useState(null);
  const [form, setForm] = useState({ checkInDate: '', checkOutDate: '', roomsCount: '1', adults: '1', children: '0', firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(null); const requestId = useRef(null);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const loadHotels = useCallback(async ({ append = false, page = 1 } = {}) => {
    setLoading(true);
    try { const data = await searchPublicHotels({ search: search.name || undefined, city: search.city || undefined, page, limit: PAGE_SIZE }); setHotels((current) => append ? [...current, ...(data.hotels || [])] : data.hotels || []); setTotal(data.total || 0); setSearch((current) => ({ ...current, page })); }
    catch (error) { Alert.alert('Recherche indisponible', error.response?.data?.message || error.normalized?.message || 'Vérifiez votre connexion.'); }
    finally { setLoading(false); }
  }, [search.name, search.city]);

  const chooseHotel = async (hotel) => { setLoading(true); try { setHotelData(await getPublicHotel(hotel._id)); setStep(2); } catch (error) { Alert.alert('Hôtel indisponible', error.response?.data?.message || 'Impossible de charger cet hôtel.'); } finally { setLoading(false); } };
  const verify = async () => {
    if (!form.checkInDate || !form.checkOutDate || nightsBetween(form.checkInDate, form.checkOutDate) < 1) return Alert.alert('Dates invalides', 'Choisissez une arrivée et un départ valides.');
    setLoading(true);
    try {
      const rows = await Promise.all((hotelData.categories || []).map(async (category) => {
        const result = await getHotelAvailability(hotelData.hotel._id, { roomCategoryId: category._id, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, roomsCount: Number(form.roomsCount), adults: Number(form.adults), children: Number(form.children) });
        return [category._id, result];
      }));
      setAvailability(Object.fromEntries(rows)); setSelectedCategory(null); setSelectedRate(null); setStep(3);
    } catch (error) { Alert.alert('Disponibilité indisponible', error.response?.data?.message || error.normalized?.message || 'Vérifiez votre connexion.'); }
    finally { setLoading(false); }
  };
  const submit = async () => {
    if (loading || !selectedCategory || !selectedRate) return;
    setLoading(true); if (!requestId.current) requestId.current = newReservationRequestId();
    try {
      const result = await createHotelReservation(hotelData.hotel._id, { roomCategoryId: selectedCategory._id, ratePlanId: selectedRate._id, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, roomsCount: Number(form.roomsCount), adults: Number(form.adults), children: Number(form.children), specialRequests: form.specialRequests, guest: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone }, reservationRequestId: requestId.current });
      requestId.current = null; setSuccess(result.reservation); setStep(7);
    } catch (error) { Alert.alert('Réservation non confirmée', error.response?.data?.message || error.normalized?.message || 'La même demande pourra être réessayée sans doublon.'); }
    finally { setLoading(false); }
  };
  const reset = () => { requestId.current = null; setSuccess(null); setHotelData(null); setSelectedCategory(null); setSelectedRate(null); setAvailability({}); setStep(1); };
  const nights = nightsBetween(form.checkInDate, form.checkOutDate); const totalPrice = Number(selectedRate?.amount || 0) * nights * Number(form.roomsCount || 1);

  return <Screen scroll avoidKeyboard style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Réserver un hôtel</Text><Text style={styles.progress} accessibilityLabel={`Étape ${step} sur 7`}>Étape {step}/7</Text>
    {step === 1 && <><Input label="Nom de l’hôtel" value={search.name} onChangeText={(name) => setSearch((s) => ({ ...s, name }))} /><Input label="Ville" value={search.city} onChangeText={(city) => setSearch((s) => ({ ...s, city }))} /><Button label="Rechercher" loading={loading} onPress={() => loadHotels({ page: 1 })} />{!loading && hotels.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.muted}>Lancez une recherche pour afficher les hôtels disponibles.</Text>}{hotels.map((hotel) => <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${hotel.name}`} key={hotel._id} onPress={() => chooseHotel(hotel)} style={styles.card}><Text style={styles.cardTitle}>{hotel.name}</Text><Text style={styles.muted}>{hotel.property?.address?.city || 'Ville non précisée'} · dès {formatMoney(hotel.minNightlyRate)}</Text></Pressable>)}{hotels.length < total && <Button label="Afficher plus" variant="outline" loading={loading} onPress={() => loadHotels({ append: true, page: search.page + 1 })} />}</>}
    {step === 2 && <><Text style={styles.section}>{hotelData?.hotel?.name}</Text><View style={styles.row}><Input style={styles.half} label="Arrivée (AAAA-MM-JJ)" value={form.checkInDate} onChangeText={set('checkInDate')} /><Input style={styles.half} label="Départ (AAAA-MM-JJ)" value={form.checkOutDate} onChangeText={set('checkOutDate')} /></View><View style={styles.row}><Input style={styles.third} label="Chambres" keyboardType="number-pad" value={form.roomsCount} onChangeText={set('roomsCount')} /><Input style={styles.third} label="Adultes" keyboardType="number-pad" value={form.adults} onChangeText={set('adults')} /><Input style={styles.third} label="Enfants" keyboardType="number-pad" value={form.children} onChangeText={set('children')} /></View><Button label="Rechercher les disponibilités" loading={loading} onPress={verify} /><Button label="Changer d’hôtel" variant="outline" onPress={() => setStep(1)} /></>}
    {step === 3 && <><Text style={styles.section}>Catégories disponibles</Text>{(hotelData.categories || []).filter((category) => availability[category._id]?.available).map((category) => { const remaining = Math.min(...(availability[category._id]?.nights || []).map((night) => night.availableUnits)); const publicRate = category.rates?.find((rate) => rate.rateType === 'public') || category.rates?.[0]; return <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${category.name}, ${remaining} chambres restantes`} key={category._id} onPress={() => { setSelectedCategory(category); setSelectedRate(null); setStep(4); }} style={styles.card}><Text style={styles.cardTitle}>{category.name}</Text><Text style={styles.muted}>{category.capacity?.adults || category.maxAdults || '—'} adulte(s) · {category.bedsCount || category.numberOfBeds || '—'} lit(s)</Text><Text style={styles.muted}>{(category.amenities || []).slice(0, 4).join(' · ') || 'Équipements sur demande'}</Text><Text style={styles.good}>{remaining} chambre(s) restante(s) · dès {formatMoney(publicRate?.amount)}/nuit</Text></Pressable>; })}<Button label="Modifier les dates" variant="outline" onPress={() => setStep(2)} /></>}
    {step === 4 && <><Text style={styles.section}>Tarifs · {selectedCategory?.name}</Text>{(selectedCategory?.rates || []).filter((rate) => rate.active !== false).map((rate) => { const rateLabel = rate.name || (rate.rateType === 'public' ? 'Tarif public' : rate.rateType); return <Pressable accessibilityRole="button" accessibilityLabel={`Choisir le tarif ${rateLabel}, ${formatMoney(rate.amount)} par nuit`} key={rate._id} onPress={() => { setSelectedRate(rate); setStep(5); }} style={styles.card}><Text style={styles.cardTitle}>{rateLabel}</Text><Text style={styles.good}>{formatMoney(rate.amount)} / nuit · {formatMoney(Number(rate.amount) * nights * Number(form.roomsCount))} total</Text><Text style={styles.muted}>{rate.mealPlan || 'Repas non inclus'} · {rate.cancellationPolicy || 'Conditions communiquées par l’hôtel'}</Text></Pressable>; })}<Button label="Changer de catégorie" variant="outline" onPress={() => setStep(3)} /></>}
    {step === 5 && <><Text style={styles.section}>Informations client</Text><Input label="Prénom" value={form.firstName} onChangeText={set('firstName')} /><Input label="Nom" value={form.lastName} onChangeText={set('lastName')} /><Input label="Email" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} /><Input label="Téléphone" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} /><Input label="Demandes particulières" value={form.specialRequests} onChangeText={set('specialRequests')} multiline /><Button label="Voir le résumé" disabled={!form.firstName || !form.lastName || !form.email} onPress={() => setStep(6)} /><Button label="Retour aux tarifs" variant="outline" onPress={() => setStep(4)} /></>}
    {step === 6 && <View style={styles.card}><Text style={styles.section}>Résumé</Text><Text style={styles.text}>{hotelData.hotel.name} · {selectedCategory.name}</Text><Text style={styles.text}>{form.checkInDate} → {form.checkOutDate} · {nights} nuit(s)</Text><Text style={styles.text}>{form.roomsCount} chambre(s) · {form.adults} adulte(s) · {form.children} enfant(s)</Text><Text style={styles.text}>{selectedRate.name || selectedRate.rateType}</Text><Text style={styles.total}>{formatMoney(totalPrice)}</Text><Text style={styles.muted}>Taxes et frais connus inclus dans le tarif communiqué. Aucun paiement n’est prélevé ici.</Text><Button label="Confirmer la réservation" loading={loading} disabled={loading} onPress={submit} /><Button label="Modifier mes informations" variant="outline" onPress={() => setStep(5)} /><Button label="Abandonner cette demande" variant="outline" onPress={reset} /></View>}
    {step === 7 && success && <View style={styles.card} accessibilityLiveRegion="polite"><Text style={styles.section}>Réservation enregistrée</Text><Text style={styles.good}>Référence {success.reference}</Text><Text style={styles.text}>Votre demande est consultable immédiatement.</Text><Button label="Voir le détail" onPress={() => navigation.replace('HotelReservationDetail', { reservationId: success._id })} /><Button label="Nouvelle réservation" variant="outline" onPress={reset} /></View>}
  </Screen>;
}

const makeStyles = (c) => StyleSheet.create({ content: { gap: spacing.md }, title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text }, progress: { color: c.textSub, fontFamily: fonts.body }, section: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.lg }, card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs, minHeight: 48 }, cardTitle: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.md }, text: { color: c.text, fontFamily: fonts.body }, muted: { color: c.textSub, fontFamily: fonts.body }, good: { color: c.success || '#27845A', fontFamily: fonts.bodyBold }, total: { color: c.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.xl }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, half: { flexGrow: 1, minWidth: 145 }, third: { flexGrow: 1, minWidth: 90 } });
