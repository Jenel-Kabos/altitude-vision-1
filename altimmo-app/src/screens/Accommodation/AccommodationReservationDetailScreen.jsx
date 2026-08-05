import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import {
  cancelAccommodationReservation, downloadFinancialDocument, getAccommodationFinancialSummary,
  getAccommodationRefundableSummary, getAccommodationReservation, getFinancialDocument,
  getFinancialDocumentPdf, requestAccommodationRefund,
} from '../../services/accommodationReservationService';

const date = (value, withTime = false) => value ? new Date(value).toLocaleString('fr-FR', withTime ? undefined : { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const money = (value, currency = 'XAF') => `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;
const human = (value) => String(value || '—').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

function Info({ label, value, styles }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value ?? '—'}</Text></View>; }
function Section({ title, children, styles }) { return <View style={styles.card}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{children}</View>; }

export default function AccommodationReservationDetailScreen({ navigation, route }) {
  const { themeColors: c } = useTheme(); const { width } = useWindowDimensions(); const styles = useMemo(() => makeStyles(c, width >= 700), [c, width]);
  const id = route.params?.reservationId; const [data, setData] = useState({ reservation: null, finance: null, refunds: null, document: null, artifact: null });
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [offline, setOffline] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState({ paymentId: '', amountMinor: '', reason: '', method: 'bank_transfer' });
  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true); setError('');
    try {
      const [reservationResult, financeResult, refundResult] = await Promise.all([getAccommodationReservation(id, { refresh }), getAccommodationFinancialSummary(id, { refresh }), getAccommodationRefundableSummary(id, { refresh })]);
      const reservation = reservationResult.data?.reservation; let document = null; let artifact = null;
      if (reservation?.financialDocument) {
        const documentResult = await getFinancialDocument(reservation.financialDocument, { refresh }); document = documentResult.data?.document;
        const artifactResult = await getFinancialDocumentPdf(reservation.financialDocument, { refresh }); artifact = artifactResult.data?.artifact;
      }
      setData({ reservation, finance: financeResult.data, refunds: refundResult.data, document, artifact });
      setRefund((current) => ({ ...current, paymentId: current.paymentId || refundResult.data?.payments?.[0]?._id || '' }));
      setOffline([reservationResult, financeResult, refundResult].some((result) => result.offline));
    } catch (loadError) { setError(loadError.response?.data?.message || loadError.normalized?.message || 'Détail indisponible.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const reservation = data.reservation;
  const cancel = () => Alert.alert('Annuler le séjour', 'Cette action applique les transitions ACC-1.', [{ text: 'Retour', style: 'cancel' }, { text: 'Annuler la réservation', style: 'destructive', onPress: async () => { setBusy(true); try { await cancelAccommodationReservation(id, 'Annulation depuis l’application mobile'); await load({ refresh: true }); } catch (actionError) { Alert.alert('Annulation impossible', actionError.response?.data?.message || 'Veuillez réessayer.'); } finally { setBusy(false); } } }]);
  const sendRefund = async () => {
    if (offline) return Alert.alert('Mode hors ligne', 'La demande nécessite une connexion.');
    setBusy(true); try { await requestAccommodationRefund(id, { ...refund, amountMinor: Number(refund.amountMinor) }, `mobile-refund:${Crypto.randomUUID()}`); setRefund((current) => ({ ...current, amountMinor: '', reason: '' })); await load({ refresh: true }); Alert.alert('Demande envoyée', 'Le remboursement doit être traité par l’équipe financière.'); } catch (actionError) { Alert.alert('Demande impossible', actionError.response?.data?.message || 'Veuillez vérifier le montant.'); } finally { setBusy(false); }
  };
  const download = async () => { setBusy(true); try { await downloadFinancialDocument(data.document.id, data.document.documentNumber); } catch (downloadError) { Alert.alert('Document indisponible', downloadError.response?.data?.message || downloadError.message || 'Aucun PDF officiel disponible.'); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.safe} edges={['top']}><PageHeader title="Détail du séjour" onBack={() => navigation.goBack()}/><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={c.gold}/> }>
    {offline && <View accessibilityRole="alert" style={styles.offline}><Ionicons name="cloud-offline-outline" size={18} color={c.warning}/><Text style={styles.text}>Données hors ligne — actions désactivées</Text></View>}
    {loading && !reservation ? <><Skeleton height={170}/><Skeleton height={220}/><Skeleton height={180}/></> : null}
    {error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button label="Réessayer" onPress={() => load({ refresh: true })}/></View> : null}
    {!loading && !error && !reservation ? <EmptyState icon="bed-outline" title="Séjour introuvable" subtitle="Cette réservation n’est pas accessible."/> : null}
    {reservation ? <>
      <Section title={reservation.accommodation?.property?.title || 'Hébergement'} styles={styles}><Text style={styles.status}>{human(reservation.status)}</Text><View style={styles.infoGrid}><Info label="Arrivée" value={date(reservation.checkInDate)} styles={styles}/><Info label="Départ" value={date(reservation.checkOutDate)} styles={styles}/><Info label="Durée" value={`${reservation.nights} nuit(s)`} styles={styles}/><Info label="Voyageurs" value={`${reservation.adults} adulte(s), ${reservation.children} enfant(s)`} styles={styles}/></View><Text style={styles.text}>{reservation.accommodation?.property?.address?.city || ''}</Text>{reservation.specialRequests ? <Text style={styles.muted}>Demande : {reservation.specialRequests}</Text> : null}</Section>
      <Section title="Propriétaire" styles={styles}><Text style={styles.text}>{reservation.owner?.name || reservation.owner?.email || 'Propriétaire de l’hébergement'}</Text></Section>
      <Section title="Montants et paiements" styles={styles}><View style={styles.infoGrid}><Info label="Total" value={money(data.finance?.total ?? reservation.total, reservation.currency)} styles={styles}/><Info label="Payé" value={money(data.finance?.amountPaid ?? reservation.amountPaid, reservation.currency)} styles={styles}/><Info label="Solde" value={money(data.finance?.remainingAmount ?? reservation.remainingAmount, reservation.currency)} styles={styles}/><Info label="Statut" value={human(data.finance?.paymentStatus ?? reservation.paymentStatus)} styles={styles}/></View>{(data.finance?.payments || []).map((payment) => <View key={payment._id} style={styles.listRow}><View><Text style={styles.text}>{payment.paymentReference || payment.reference || 'Paiement'}</Text><Text style={styles.muted}>{date(payment.createdAt, true)} · {human(payment.method)}</Text></View><Text style={styles.value}>{money(payment.amountMinor, payment.currency)}</Text></View>)}{!data.finance?.payments?.length && <Text style={styles.muted}>Aucun paiement enregistré.</Text>}</Section>
      <Section title="Facture et reçu" styles={styles}>{data.document ? <><Text style={styles.text}>{data.document.documentNumber || 'Facture en préparation'}</Text><Text style={styles.muted}>{human(data.document.status)} · {human(data.document.paymentStatus)}</Text>{(data.document.lines || []).map((line) => <View key={line.id} style={styles.listRow}><Text style={styles.text}>{line.description}</Text><Text style={styles.value}>{money(line.totalMinor, data.document.currency)}</Text></View>)}<Text style={styles.total}>{money(data.document.totalMinor, data.document.currency)}</Text><Button label={data.artifact ? 'Prévisualiser ou télécharger le PDF' : 'PDF officiel non encore disponible'} disabled={!data.artifact || busy} loading={busy && !!data.artifact} onPress={download}/></> : <Text style={styles.muted}>La facture est créée après confirmation du séjour. Les paiements ci-dessus constituent l’historique des reçus enregistrés.</Text>}</Section>
      <Section title="Remboursements" styles={styles}><Text style={styles.text}>Montant remboursable : {money(data.refunds?.refundableAmount, reservation.currency)}</Text>{(data.refunds?.refunds || []).map((item) => <View key={item._id} style={styles.listRow}><View><Text style={styles.text}>{human(item.status)}</Text><Text style={styles.muted}>{item.reason || date(item.createdAt)}</Text></View><Text style={styles.value}>{money(item.amountMinor, item.currency)}</Text></View>)}{Number(data.refunds?.refundableAmount || 0) > 0 && <View style={styles.refundForm}><TextInput accessibilityLabel="Montant du remboursement" keyboardType="number-pad" placeholder="Montant" placeholderTextColor={c.textMuted} value={refund.amountMinor} onChangeText={(amountMinor) => setRefund((current) => ({ ...current, amountMinor }))} style={styles.input}/><TextInput accessibilityLabel="Motif du remboursement" placeholder="Motif" placeholderTextColor={c.textMuted} value={refund.reason} onChangeText={(reason) => setRefund((current) => ({ ...current, reason }))} style={styles.input}/><Button label="Demander le remboursement" disabled={offline || busy || !refund.paymentId || !refund.amountMinor || !refund.reason.trim()} loading={busy} onPress={sendRefund}/></View>}</Section>
      <Section title="Historique" styles={styles}><View style={styles.listRow}><Text style={styles.text}>Demande créée</Text><Text style={styles.muted}>{date(reservation.createdAt, true)}</Text></View>{(reservation.workflowHistory || []).map((item, index) => <View key={`${item.at}-${index}`} style={styles.listRow}><View><Text style={styles.text}>{human(item.from)} → {human(item.to)}</Text>{item.reason ? <Text style={styles.muted}>{item.reason}</Text> : null}</View><Text style={styles.muted}>{date(item.at, true)}</Text></View>)}</Section>
      {['pending', 'confirmed'].includes(reservation.status) && <Button label="Annuler ma réservation" variant="outline" disabled={offline || busy} loading={busy} onPress={cancel}/>} 
    </> : null}
  </ScrollView></SafeAreaView>;
}

const makeStyles = (c, tablet) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, gap: spacing.md }, card: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm }, sectionTitle: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.lg }, status: { color: c.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.md }, text: { color: c.text, fontFamily: fonts.body }, muted: { color: c.textSub, fontFamily: fonts.body, fontSize: fontSize.sm }, value: { color: c.text, fontFamily: fonts.bodyBold }, total: { color: c.gold, fontFamily: fonts.bodyBold, fontSize: fontSize.xl, textAlign: 'right' }, error: { color: c.error, fontFamily: fonts.body }, offline: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.warning, borderRadius: radius.sm }, infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, info: { width: tablet ? '23%' : '47%', minHeight: 68, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.bg }, infoLabel: { color: c.textMuted, fontFamily: fonts.body, fontSize: fontSize.sm }, infoValue: { color: c.text, fontFamily: fonts.bodyBold }, listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, refundForm: { gap: spacing.sm }, input: { minHeight: 48, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, fontFamily: fonts.body },
});
