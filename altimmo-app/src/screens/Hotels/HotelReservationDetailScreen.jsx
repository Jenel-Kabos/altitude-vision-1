import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen'; import Button from '../../components/Button';
import HotelReviewForm from '../../components/hotel/HotelReviewForm';
import { useTheme } from '../../context/ThemeContext'; import { fonts, fontSize, spacing, radius } from '../../theme';
import { getHotelReservation, getReservationAssignments, getCancellationEligibility, createHotelReview } from '../../services/hotelReservationService';
import { formatMealPlan, formatCancellationTerms, formatCancellationEligibility } from '../../utils/hotelCommercialConditions';

export default function HotelReservationDetailScreen({ route }) {
  const { themeColors: c } = useTheme(); const styles = useMemo(() => makeStyles(c), [c]);
  const [reservation, setReservation] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [assignmentData, setAssignmentData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { reservation: item, reviewEligibility: eligibilityData } = await getHotelReservation(route.params.reservationId);
      setReservation(item);
      setReviewEligibility(eligibilityData);
      setAssignmentData(await getReservationAssignments(item._id));
      // PHASE-H5 — purement informatif (aucune écriture) ; une erreur ici ne
      // doit jamais bloquer l'affichage du reste de la réservation.
      getCancellationEligibility(item._id).then(setEligibility).catch(() => setEligibility(null));
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || 'Détail indisponible.');
    } finally {
      setLoading(false);
    }
  }, [route.params.reservationId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitReview = useCallback(async ({ overallRating, comment }) => {
    setReviewLoading(true); setReviewError(null);
    try {
      await createHotelReview(reservation.hotel._id, { reservationId: reservation._id, overallRating, comment });
      setShowReviewForm(false);
      setReviewEligibility({ eligible: false, alreadyReviewed: true });
      Alert.alert('Merci !', 'Votre avis a été publié.');
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        setShowReviewForm(false);
        setReviewEligibility({ eligible: false, alreadyReviewed: true });
        Alert.alert('Avis déjà envoyé', 'Vous avez déjà évalué ce séjour.');
      } else if (status === 422) {
        setReviewError(error.response?.data?.message || 'Formulaire invalide.');
      } else {
        Alert.alert('Erreur', error.response?.data?.message || 'Impossible d’envoyer votre avis. Vérifiez votre connexion.');
      }
    } finally {
      setReviewLoading(false);
    }
  }, [reservation]);

  if (!reservation) return <Screen><Button label="Charger" loading={loading} onPress={load} /></Screen>;
  const rooms = assignmentData?.activeRoomAssignments || [];
  const mealPlanLabel = formatMealPlan(reservation.rateSnapshot?.mealPlan);
  const cancellationTermsLabel = formatCancellationTerms(reservation.rateSnapshot?.cancellation);

  return <Screen scroll style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{reservation.reference}</Text>
    <View style={styles.card}>
      <Text style={styles.status}>{reservation.status}</Text>
      <Text style={styles.text}>{reservation.hotel?.name}</Text>
      <Text style={styles.text}>Arrivée : {new Date(reservation.checkInDate).toLocaleString('fr-FR')}</Text>
      <Text style={styles.text}>Départ prévu : {new Date(reservation.checkOutDate).toLocaleString('fr-FR')}</Text>
      {reservation.actualCheckInAt && <Text style={styles.text}>Arrivée réelle : {new Date(reservation.actualCheckInAt).toLocaleString('fr-FR')}</Text>}
      {reservation.actualCheckOutAt && <Text style={styles.text}>Départ réel : {new Date(reservation.actualCheckOutAt).toLocaleString('fr-FR')}</Text>}
      <Text style={styles.text}>{reservation.roomsCount} chambre(s) · {reservation.adults} adulte(s)</Text>
      <Text style={styles.amount}>{Number(reservation.totalAmount || 0).toLocaleString('fr-FR')} FCFA</Text>
    </View>

    {/* PHASE-H5 — conditions contractuelles figées à la réservation (jamais
        celles du RatePlan courant, potentiellement modifié depuis). */}
    {(mealPlanLabel || cancellationTermsLabel) && (
      <View style={styles.card}>
        <Text style={styles.subtitle}>Conditions de votre réservation</Text>
        {mealPlanLabel && <Text style={styles.text}>{mealPlanLabel}</Text>}
        {cancellationTermsLabel && <Text style={styles.text}>{cancellationTermsLabel}</Text>}
      </View>
    )}
    {eligibility && (
      <View style={styles.card}>
        <Text style={styles.subtitle}>Conditions d’annulation</Text>
        <Text style={styles.text}>{formatCancellationEligibility(eligibility)}</Text>
      </View>
    )}

    <View style={styles.card}>
      <Text style={styles.subtitle}>Chambres</Text>
      <Text style={styles.text}>{assignmentData?.assignmentState || 'unassigned'}</Text>
      {rooms.map((item) => <Text key={item.id} style={styles.text}>Chambre {item.room?.roomNumber} · étage {item.room?.floor}</Text>)}
    </View>

    {/* PHASE-H5 §20 — complétion H3 : CTA server-authoritative uniquement. */}
    {reviewEligibility?.eligible && !showReviewForm && (
      <Button label="Donner votre avis" onPress={() => setShowReviewForm(true)} />
    )}
    {showReviewForm && (
      <HotelReviewForm onSubmit={submitReview} loading={reviewLoading} error={reviewError} />
    )}
    {reviewEligibility?.alreadyReviewed && !showReviewForm && (
      <Text style={styles.mutedCenter}>Vous avez déjà évalué ce séjour.</Text>
    )}

    <Button label="Actualiser" variant="outline" loading={loading} onPress={load} />
  </Screen>;
}
const makeStyles = (c) => StyleSheet.create({
  content: { gap: spacing.md },
  title: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl },
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs },
  subtitle: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  status: { color: c.gold, fontFamily: fonts.bodyBold },
  text: { color: c.textSub, fontFamily: fonts.body },
  amount: { color: c.text, fontFamily: fonts.bodyBold, fontSize: fontSize.lg },
  mutedCenter: { color: c.textMuted, fontFamily: fonts.body, textAlign: 'center' },
});
