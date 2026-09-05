// PHASE-H5 — formatage UNIQUEMENT des conditions commerciales déjà
// canoniques côté serveur (RatePlan.mealPlan/cancellation). Jamais un
// libellé fabriqué à partir d'un champ absent (`null`/absent → aucun texte,
// jamais "Repas non inclus"/"Remboursable" par défaut — mission §4).

export const MEAL_PLAN_LABELS = {
  room_only: 'Chambre seule',
  breakfast_included: 'Petit-déjeuner inclus',
  half_board: 'Demi-pension',
  full_board: 'Pension complète',
};

export function formatMealPlan(mealPlan) {
  if (!mealPlan) return null;
  return MEAL_PLAN_LABELS[mealPlan] || mealPlan;
}

// Offre de disponibilité (H2/H5) : `cancellation.deadlineAt` est une date
// ABSOLUE déjà calculée côté serveur (hotelCancellationPolicyService) —
// jamais recalculée ici, uniquement mise en forme.
export function formatCancellationOffer(cancellation) {
  if (!cancellation) return null;
  if (cancellation.type === 'non_refundable') return 'Non remboursable';
  if (cancellation.deadlineAt) {
    const date = new Date(cancellation.deadlineAt).toLocaleDateString('fr-FR');
    return `Annulation gratuite jusqu’au ${date}`;
  }
  return 'Conditions d’annulation communiquées par l’hôtel';
}

// RatePlan brut (formulaire pro / flux HotelBookingScreen historique) :
// aucune date absolue disponible sans dupliquer le calcul serveur — le
// libellé reste volontairement relatif (heures avant l'arrivée), jamais une
// date recalculée côté mobile.
export function formatCancellationTerms(cancellation) {
  if (!cancellation) return null;
  if (cancellation.type === 'non_refundable') return 'Non remboursable';
  if (cancellation.deadlineHoursBeforeCheckIn != null) {
    return `Annulation gratuite jusqu’à ${cancellation.deadlineHoursBeforeCheckIn}h avant l’arrivée`;
  }
  return 'Conditions d’annulation communiquées par l’hôtel';
}

export function formatCancellationEligibility(eligibility) {
  if (!eligibility || !eligibility.policyKnown) return 'Conditions d’annulation non communiquées pour cette réservation.';
  if (eligibility.freeCancellation) {
    const date = eligibility.deadlineAt ? new Date(eligibility.deadlineAt).toLocaleDateString('fr-FR') : null;
    return date ? `Annulation gratuite jusqu’au ${date}.` : 'Annulation gratuite.';
  }
  if (eligibility.refundableAmount === 0) return 'Non remboursable.';
  return `Pénalité applicable : ${Number(eligibility.penaltyAmount || 0).toLocaleString('fr-FR')} XAF (remboursable : ${Number(eligibility.refundableAmount || 0).toLocaleString('fr-FR')} XAF).`;
}
