import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Screen from '../../components/Screen';
import PageHeader from '../../components/PageHeader';
import Input from '../../components/Input';
import Button from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import { createAccommodationReservation, getAccommodationAvailability } from '../../services/accommodationReservationService';
import { resolveMobileDestination } from '../../navigation/navigationSdk';

const money = (value, currency = 'XAF') => `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;

export default function AccommodationBookingScreen({ navigation, route }) {
  const { themeColors: c } = useTheme(); const { width } = useWindowDimensions(); const styles = useMemo(() => makeStyles(c, width >= 700), [c, width]);
  const accommodationId = route.params?.accommodationId; const title = route.params?.title || 'Hébergement';
  const [form, setForm] = useState({ checkInDate: '', checkOutDate: '', adults: '1', children: '0', specialRequests: '' });
  const [quote, setQuote] = useState(null); const [loading, setLoading] = useState(false); const [offline, setOffline] = useState(false); const [success, setSuccess] = useState(null);
  const set = (key) => (value) => { setForm((current) => ({ ...current, [key]: value })); setQuote(null); };
  const verify = async () => {
    if (!accommodationId || !form.checkInDate || !form.checkOutDate) return Alert.alert('Informations requises', 'Renseignez les dates du séjour.');
    setLoading(true);
    try { const result = await getAccommodationAvailability(accommodationId, { from: form.checkInDate, to: form.checkOutDate }, { refresh: true }); setQuote(result.data); setOffline(result.offline); }
    catch (error) { Alert.alert('Disponibilité indisponible', error.response?.data?.message || error.normalized?.message || 'Veuillez réessayer.'); }
    finally { setLoading(false); }
  };
  const submit = async () => {
    if (offline) return Alert.alert('Mode hors ligne', 'La réservation nécessite une connexion.');
    if (!quote?.available || !quote?.pricing) return Alert.alert('Vérification requise', 'Vérifiez une période disponible avant de confirmer.');
    setLoading(true);
    try {
      const reservation = await createAccommodationReservation({ accommodation: accommodationId, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, adults: Number(form.adults), children: Number(form.children), guestCount: Number(form.adults) + Number(form.children), specialRequests: form.specialRequests });
      setSuccess(reservation);
    } catch (error) { Alert.alert('Demande non enregistrée', error.response?.data?.message || error.normalized?.message || 'Veuillez réessayer.'); }
    finally { setLoading(false); }
  };
  const openSuccess = () => { const target = resolveMobileDestination('ACCOMMODATION_RESERVATION_DETAILS', { id: success._id }); if (target?.params?.screen) navigation.replace(target.params.screen, target.params.params); };
  return <Screen scroll avoidKeyboard style={styles.content}><PageHeader title="Réserver" onBack={() => navigation.goBack()}/>
    {success ? <View accessibilityLiveRegion="polite" style={styles.card}><Text accessibilityRole="header" style={styles.title}>Demande enregistrée</Text><Text style={styles.good}>Votre réservation sera confirmée après le paiement d’une nuitée.</Text><Text style={styles.text}>Cette demande est maintenue pendant 2 heures.</Text><Text style={styles.text}>Garantie : {money(success.pricingSnapshot?.requiredToConfirm, success.currency)}</Text><Text style={styles.text}>Reste après garantie : {money(Math.max(0, Number(success.total || 0) - Number(success.pricingSnapshot?.requiredToConfirm || 0)), success.currency)}</Text><Text style={styles.warning}>La première nuitée est non remboursable si vous annulez, quelle que soit la date d’annulation.</Text><Button label="Voir ma réservation" onPress={openSuccess}/></View> : <>
      <View style={styles.card}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.muted}>Le prix et la disponibilité sont vérifiés par le serveur avant confirmation.</Text></View>
      <View style={styles.formRow}><Input style={styles.half} label="Arrivée (AAAA-MM-JJ)" value={form.checkInDate} onChangeText={set('checkInDate')}/><Input style={styles.half} label="Départ (AAAA-MM-JJ)" value={form.checkOutDate} onChangeText={set('checkOutDate')}/></View>
      <View style={styles.formRow}><Input style={styles.half} label="Adultes" keyboardType="number-pad" value={form.adults} onChangeText={set('adults')}/><Input style={styles.half} label="Enfants" keyboardType="number-pad" value={form.children} onChangeText={set('children')}/></View>
      <Input label="Demandes spéciales" value={form.specialRequests} onChangeText={set('specialRequests')} multiline/>
      <Button label="Vérifier disponibilité et tarif" loading={loading} onPress={verify}/>
      {offline && <Text accessibilityRole="alert" style={styles.warning}>Devis issu du cache — confirmation désactivée hors ligne.</Text>}
      {quote && <View style={styles.card}><Text style={styles.title}>{quote.available ? 'Période disponible' : 'Période indisponible'}</Text>{quote.pricing ? <><Text style={styles.text}>{quote.pricing.nights} nuit(s) × {money(quote.pricing.nightlyRate, quote.pricing.currency)}</Text>{quote.pricing.cleaningFee > 0 && <Text style={styles.text}>Frais : {money(quote.pricing.cleaningFee, quote.pricing.currency)}</Text>}<Text style={styles.total}>Total : {money(quote.pricing.total, quote.pricing.currency)}</Text><Text style={styles.text}>À payer pour confirmer : {money(quote.pricing.requiredToConfirm, quote.pricing.currency)}</Text><Text style={styles.text}>Reste après garantie : {money(Math.max(0, quote.pricing.total - quote.pricing.requiredToConfirm), quote.pricing.currency)}</Text><Text style={styles.warning}>La première nuitée constitue une garantie non remboursable si vous annulez, quelle que soit la date d’annulation.</Text></> : null}<Button label="Créer la demande (hold 2 h)" loading={loading} disabled={!quote.available || !quote.pricing || offline} onPress={submit}/></View>}
    </>}
  </Screen>;
}
const makeStyles = (c, tablet) => StyleSheet.create({ content: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: spacing.md }, card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm }, formRow: { flexDirection: tablet ? 'row' : 'column', gap: spacing.md }, half: { flex: 1 }, title: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.lg }, text: { color: c.text, fontFamily: fonts.body }, muted: { color: c.textSub, fontFamily: fonts.body }, total: { color: c.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.xl }, good: { color: c.success, fontFamily: fonts.bodyBold }, warning: { color: c.warning, fontFamily: fonts.bodyBold } });
