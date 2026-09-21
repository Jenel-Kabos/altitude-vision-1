const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_PURPOSES = Object.freeze({
  GUARANTEE: 'guarantee',
  NEXT_NIGHT: 'next_night',
  REMAINING_BALANCE: 'remaining_balance',
});

const asAmount = (value) => Math.max(0, Number(value || 0));
const utcDay = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

function calculateConsumedNights(reservation, { now = new Date() } = {}) {
  if (!reservation?.checkedInAt) return 0;
  const start = utcDay(reservation.checkInDate);
  const candidates = [now, reservation.checkedOutAt, reservation.cancelledAt]
    .filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()));
  const effectiveAt = new Date(Math.min(...candidates.map((value) => value.getTime()), new Date(reservation.checkOutDate).getTime()));
  const elapsed = Math.max(0, Math.floor((utcDay(effectiveAt) - start) / DAY_MS));
  return Math.min(Number(reservation.nights || 0), elapsed);
}

function getStayFinancialSummary(reservation, options = {}) {
  const nightlyRate = asAmount(reservation?.pricingSnapshot?.nightlyRate);
  const total = asAmount(reservation?.pricingSnapshot?.total ?? reservation?.total);
  const amountPaid = asAmount(options.validatedPaidAmount ?? reservation?.amountPaid);
  // `reservation.amountPaid` est déjà net des remboursements après la
  // réconciliation Financial Core. Un appelant qui fournit le brut validé
  // doit aussi fournir explicitement les montants remboursés/réservés.
  const alreadyRefundedAmount = asAmount(options.alreadyRefundedAmount);
  const alreadyReservedForRefundAmount = asAmount(options.alreadyReservedForRefundAmount);
  const firstNightGuarantee = Math.min(asAmount(reservation?.pricingSnapshot?.requiredToConfirm), total);
  const consumedNights = calculateConsumedNights(reservation, options);
  const consumedStayAmount = Math.min(total, consumedNights * nightlyRate);
  const nonRefundableAmount = reservation?.checkedInAt
    ? Math.max(firstNightGuarantee, consumedStayAmount)
    : firstNightGuarantee;
  return {
    nightlyRate,
    numberOfNights: Number(reservation?.nights || reservation?.pricingSnapshot?.nights || 0),
    total,
    amountPaid,
    remainingBalance: Math.max(0, total - amountPaid),
    firstNightGuarantee,
    firstNightCovered: amountPaid >= firstNightGuarantee,
    consumedNights,
    consumedStayAmount,
    remainingNights: Math.max(0, Number(reservation?.nights || 0) - consumedNights),
    nonRefundableAmount,
    refundableAmount: Math.max(0, amountPaid - nonRefundableAmount - alreadyRefundedAmount - alreadyReservedForRefundAmount),
  };
}

function resolveServerPaymentAmount(reservation, purpose) {
  const summary = getStayFinancialSummary(reservation);
  if (purpose === PAYMENT_PURPOSES.GUARANTEE) return Math.max(0, Math.min(summary.firstNightGuarantee - summary.amountPaid, summary.remainingBalance));
  if (purpose === PAYMENT_PURPOSES.NEXT_NIGHT) return Math.max(0, Math.min(summary.nightlyRate, summary.remainingBalance));
  if (purpose === PAYMENT_PURPOSES.REMAINING_BALANCE) return summary.remainingBalance;
  const error = new Error('Objet de paiement hébergement invalide.'); error.code = 'ACCOMMODATION_PAYMENT_PURPOSE_INVALID'; error.status = 422; throw error;
}

module.exports = { DAY_MS, PAYMENT_PURPOSES, calculateConsumedNights, getStayFinancialSummary, resolveServerPaymentAmount };
