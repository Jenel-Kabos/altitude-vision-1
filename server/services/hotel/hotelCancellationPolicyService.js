// server/services/hotel/hotelCancellationPolicyService.js — PHASE-H5
//
// Calcul PUR (aucune I/O, aucune écriture) des conditions d'annulation
// dérivées d'un snapshot de politique (jamais du RatePlan courant — voir
// mission §12 : modifier un RatePlan demain ne doit jamais réécrire les
// conditions contractuelles d'hier). Sépare explicitement :
//   - l'ÉLIGIBILITÉ/le calcul de pénalité (ici, pur, déterministe)
//   - l'EXÉCUTION monétaire du remboursement (hors scope H5 — aucun
//     FinancialRefund n'est créé par ce service ni par ses appelants ;
//     voir HOTEL_H5_REPORT.md, "Real refunds: 0").
//
// Sécurité fuseau horaire (mission §15) : `Hotel.timezone` existe comme
// simple champ de profil (défaut 'Africa/Brazzaville') mais n'est utilisé
// NULLE PART ailleurs dans ce domaine pour une conversion d'heure murale —
// aucune bibliothèque de fuseaux horaires n'est une dépendance existante.
// Plutôt que d'inventer une conversion locale (risque réel d'erreur DST/
// fuseau), l'échéance est calculée comme une soustraction d'instant absolu :
// `checkInDate` (minuit UTC du jour d'arrivée, convention déjà établie par
// hotelAvailabilityService.getNightDates) moins N heures. Ce calcul ne
// suppose JAMAIS une heure murale locale : il est donc correct par
// construction, indépendamment du fuseau de l'hôtel.
function computeDeadlineAt(checkInDate, deadlineHoursBeforeCheckIn) {
  if (!checkInDate || deadlineHoursBeforeCheckIn == null) return null;
  return new Date(new Date(checkInDate).getTime() - deadlineHoursBeforeCheckIn * 3600 * 1000);
}

// Conditions d'annulation d'une OFFRE (avant réservation) — jamais un
// "maintenant", uniquement les termes tels qu'ils s'appliqueraient.
function describeCancellationPolicy(cancellation, checkInDate) {
  if (!cancellation) return null;
  if (cancellation.type === 'non_refundable') {
    return { type: 'non_refundable', deadlineAt: null, penaltyType: null, penaltyValue: null };
  }
  return {
    type: cancellation.type,
    deadlineAt: computeDeadlineAt(checkInDate, cancellation.deadlineHoursBeforeCheckIn),
    penaltyType: cancellation.penaltyType,
    penaltyValue: cancellation.penaltyValue,
  };
}

function computePenaltyAmount(cancellation, totalAmount) {
  if (!cancellation.penaltyType || cancellation.penaltyValue == null) return 0;
  if (cancellation.penaltyType === 'percentage') return Math.round((totalAmount * cancellation.penaltyValue) / 100);
  return Math.min(totalAmount, cancellation.penaltyValue);
}

// Éligibilité d'annulation d'une RÉSERVATION EXISTANTE — utilise
// EXCLUSIVEMENT `reservation.rateSnapshot.cancellation` (figé à la création,
// mission §12), jamais le RatePlan courant (mission §5 : "before deadline
// / after deadline / non-refundable / penalty calculation" doivent rester
// vrais même si le RatePlan a changé depuis). Purement informatif : ne
// bloque pas et n'exécute aucune action — voir hotelReservationController
// (le statut `cancelled` reste atteignable indépendamment de ce calcul,
// mission §5/§12 séparent explicitement éligibilité et transition/exécution).
function computeCancellationEligibility({ reservation, now = new Date() }) {
  const cancellation = reservation.rateSnapshot?.cancellation || null;
  const totalAmount = reservation.totalAmount;
  const cancellableStatuses = ['pending', 'confirmed'];
  const statusCancellable = cancellableStatuses.includes(reservation.status);

  if (!cancellation) {
    // Politique inconnue (RatePlan antérieur à H5) — jamais fabriquée comme
    // remboursable ou non remboursable (mission §4).
    return {
      policyKnown: false, statusCancellable, freeCancellation: null,
      deadlineAt: null, penaltyAmount: null, refundableAmount: null,
    };
  }

  if (cancellation.type === 'non_refundable') {
    return {
      policyKnown: true, statusCancellable, freeCancellation: false,
      deadlineAt: null, penaltyAmount: totalAmount, refundableAmount: 0,
    };
  }

  const deadlineAt = computeDeadlineAt(reservation.checkInDate, cancellation.deadlineHoursBeforeCheckIn);
  const beforeDeadline = now < deadlineAt;
  if (beforeDeadline) {
    return {
      policyKnown: true, statusCancellable, freeCancellation: true,
      deadlineAt, penaltyAmount: 0, refundableAmount: totalAmount,
    };
  }
  const penaltyAmount = computePenaltyAmount(cancellation, totalAmount);
  return {
    policyKnown: true, statusCancellable, freeCancellation: false,
    deadlineAt, penaltyAmount, refundableAmount: Math.max(0, totalAmount - penaltyAmount),
  };
}

module.exports = { describeCancellationPolicy, computeCancellationEligibility, computeDeadlineAt };
