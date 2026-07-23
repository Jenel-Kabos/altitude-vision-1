const HotelReservation = require('../../models/HotelReservation');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialPayment = require('../../models/FinancialPayment');
const PaymentAllocation = require('../../models/PaymentAllocation');
const authz = require('./financialAuthorizationService');
const { scanFinancialConsistency } = require('./financialReconciliationService');
const { fail } = require('./financialError');

const BLOCKERS = Object.freeze({
  DOCUMENT_MISSING: 'FINANCIAL_DOCUMENT_MISSING',
  DOCUMENT_NOT_ISSUED: 'FINANCIAL_DOCUMENT_NOT_ISSUED',
  BALANCE_REMAINING: 'FINANCIAL_BALANCE_REMAINING',
  PAYMENT_NOT_SETTLED: 'FINANCIAL_PAYMENT_NOT_SETTLED',
  ALLOCATION_INCONSISTENT: 'FINANCIAL_ALLOCATION_INCONSISTENT',
  RECONCILIATION_CRITICAL: 'FINANCIAL_RECONCILIATION_CRITICAL',
  LINES_NOT_FINALIZED: 'FINANCIAL_LINES_NOT_FINALIZED',
  CURRENCY_UNSUPPORTED: 'FINANCIAL_CURRENCY_UNSUPPORTED',
});
const WARNINGS = Object.freeze({
  UNALLOCATED_CONFIRMED_PAYMENT: 'UNALLOCATED_CONFIRMED_PAYMENT',
  UNMATCHED_PAYMENT_REQUIRES_REVIEW: 'UNMATCHED_PAYMENT_REQUIRES_REVIEW',
  RECONCILIATION_WARNING: 'FINANCIAL_RECONCILIATION_WARNING',
});
const INFO = Object.freeze({
  DOCUMENT_PAID: 'FINANCIAL_DOCUMENT_PAID',
  ZERO_BALANCE: 'FINANCIAL_ZERO_BALANCE',
  NO_ANOMALY: 'FINANCIAL_NO_ANOMALY',
  NO_UNALLOCATED_PAYMENT: 'FINANCIAL_NO_UNALLOCATED_PAYMENT',
});
const same = (a, b) => String(a || '') === String(b || '');
const item = (code, details) => ({ code, ...(details ? { details } : {}) });

async function evaluateHotelCheckoutFinancialReadiness({ reservationId, actor, establishmentId, requestedHotelId, session, skipAuthorization = false }) {
  const lean = (query) => (session ? query.session(session) : query).lean();
  const reservation = await lean(HotelReservation.findById(reservationId).select('_id hotel currency status'));
  if (!reservation) fail('FINANCIAL_RESERVATION_NOT_FOUND', 'Reservation inaccessible.', 404);
  if (!skipAuthorization) await authz.assertCanViewHotelCheckoutFinancials(actor, reservation.hotel);
  const claimedHotel = requestedHotelId || establishmentId;
  if (claimedHotel && !same(claimedHotel, reservation.hotel)) {
    fail('FINANCIAL_UNAUTHORIZED', 'Etablissement incoherent.', 403);
  }

  const document = await lean(FinancialDocument.findOne({
    domain: 'hotel', establishmentId: reservation.hotel,
    subjectType: 'HotelReservation', subjectId: reservation._id,
    documentType: 'invoice',
  }).sort({ createdAt: 1 }));
  const blockers = [];
  const warnings = [];
  const info = [];

  if (!document) {
    blockers.push(item(BLOCKERS.DOCUMENT_MISSING));
    return buildResult({ reservation, blockers, warnings, info });
  }
  if (document.status !== 'issued') blockers.push(item(BLOCKERS.DOCUMENT_NOT_ISSUED, { status: document.status }));
  if (document.currency !== 'XAF') blockers.push(item(BLOCKERS.CURRENCY_UNSUPPORTED, { currency: document.currency }));
  if (document.balanceMinor > 0) blockers.push(item(BLOCKERS.BALANCE_REMAINING, { balanceMinor: document.balanceMinor }));
  if (document.paymentStatus !== 'paid') blockers.push(item(BLOCKERS.PAYMENT_NOT_SETTLED, { paymentStatus: document.paymentStatus }));
  if (document.metadata?.linesFinalized === false) blockers.push(item(BLOCKERS.LINES_NOT_FINALIZED));

  const allocations = await lean(PaymentAllocation.find({ financialDocument: document._id }));
  const activeAllocations = allocations.filter((allocation) => allocation.status === 'active');
  const paymentIds = activeAllocations.map((allocation) => allocation.financialPayment);
  const allocatedPayments = paymentIds.length ? await lean(FinancialPayment.find({ _id: { $in: paymentIds } })) : [];
  const paymentById = new Map(allocatedPayments.map((payment) => [String(payment._id), payment]));
  const inconsistent = activeAllocations.some((allocation) => {
    const payment = paymentById.get(String(allocation.financialPayment));
    return !payment || !same(allocation.establishmentId, reservation.hotel)
      || !same(payment.establishmentId, reservation.hotel)
      || allocation.domain !== document.domain || payment.domain !== document.domain
      || allocation.currency !== document.currency || payment.currency !== document.currency;
  });
  if (inconsistent) blockers.push(item(BLOCKERS.ALLOCATION_INCONSISTENT));
  if (allocatedPayments.some((payment) => ['pending', 'processing', 'failed'].includes(payment.status))) {
    blockers.push(item(BLOCKERS.PAYMENT_NOT_SETTLED, { reason: 'allocated_payment_not_succeeded' }));
  }

  const allocatedMinor = activeAllocations.reduce((total, allocation) => total + Number(allocation.amountMinor || 0), 0);
  const balanceMinor = document.totalMinor - allocatedMinor;
  const derivedPaymentStatus = allocatedMinor === 0 ? 'unpaid' : allocatedMinor === document.totalMinor ? 'paid' : allocatedMinor < document.totalMinor ? 'partially_paid' : 'overpaid';
  if (balanceMinor !== 0 && !blockers.some(({ code }) => code === BLOCKERS.BALANCE_REMAINING)) blockers.push(item(BLOCKERS.BALANCE_REMAINING, { balanceMinor })); else if (balanceMinor === 0) info.push(item(INFO.ZERO_BALANCE));
  if (derivedPaymentStatus !== 'paid' && !blockers.some(({ code }) => code === BLOCKERS.PAYMENT_NOT_SETTLED)) blockers.push(item(BLOCKERS.PAYMENT_NOT_SETTLED, { paymentStatus: derivedPaymentStatus })); else if (derivedPaymentStatus === 'paid') info.push(item(INFO.DOCUMENT_PAID));
  if (allocatedMinor < 0 || allocatedMinor > document.totalMinor || balanceMinor < 0 || document.amountAllocatedMinor !== allocatedMinor || document.balanceMinor !== balanceMinor || document.paymentStatus !== derivedPaymentStatus) blockers.push(item(BLOCKERS.ALLOCATION_INCONSISTENT, { reason: 'aggregate_mismatch' }));
  const reconciliation = await scanFinancialConsistency({ document: document._id, establishmentId: reservation.hotel, session });
  const criticalIssues = reconciliation.issues.filter((issue) => issue.severity === 'critical');
  const nonCriticalIssues = reconciliation.issues.filter((issue) => issue.severity !== 'critical');
  if (criticalIssues.length) blockers.push(item(BLOCKERS.RECONCILIATION_CRITICAL, { issueCodes: criticalIssues.map((issue) => issue.code) }));
  if (nonCriticalIssues.length) warnings.push(item(WARNINGS.RECONCILIATION_WARNING, { issueCodes: nonCriticalIssues.map((issue) => issue.code) }));
  if (!reconciliation.issues.length) info.push(item(INFO.NO_ANOMALY));

  const unallocated = await (session ? FinancialPayment.find({
    domain: 'hotel', establishmentId: reservation.hotel,
    subjectType: 'HotelReservation', subjectId: reservation._id,
    status: 'succeeded', availableAmountMinor: { $gt: 0 },
  }).select('_id paymentReference availableAmountMinor currency amountMinor').session(session).lean() : FinancialPayment.find({ domain: 'hotel', establishmentId: reservation.hotel, subjectType: 'HotelReservation', subjectId: reservation._id, status: 'succeeded', availableAmountMinor: { $gt: 0 } }).select('_id paymentReference availableAmountMinor currency amountMinor').lean());
  if (unallocated.length) warnings.push(item(WARNINGS.UNALLOCATED_CONFIRMED_PAYMENT, { paymentIds: unallocated.map((payment) => payment._id) }));
  else info.push(item(INFO.NO_UNALLOCATED_PAYMENT));

  return buildResult({ reservation, document, blockers, warnings, info, aggregates: { allocatedMinor, balanceMinor, confirmedPaymentMinor: allocatedPayments.reduce((total, payment) => total + payment.amountMinor, 0), unallocatedConfirmedMinor: unallocated.reduce((total, payment) => total + payment.availableAmountMinor, 0), activeAllocationCount: activeAllocations.length, reversedAllocationCount: allocations.length - activeAllocations.length, paymentStatus: derivedPaymentStatus } });
}

function buildResult({ reservation, document, blockers, warnings, info, aggregates = {} }) {
  const allowed = blockers.length === 0;
  return {
    allowed,
    status: allowed ? (warnings.length ? 'warning' : 'ready') : 'blocked',
    blockers, warnings, info,
    financialSnapshot: {
      reservationId: reservation._id,
      establishmentId: reservation.hotel,
      documentId: document?._id || null,
      documentStatus: document?.status || null,
      currency: document?.currency || reservation.currency || null,
      totalMinor: document?.totalMinor ?? null,
      documentTotalMinor: document?.totalMinor ?? null,
      allocatedMinor: aggregates.allocatedMinor ?? document?.amountAllocatedMinor ?? null,
      paidMinor: aggregates.allocatedMinor ?? document?.amountAllocatedMinor ?? null,
      balanceMinor: aggregates.balanceMinor ?? document?.balanceMinor ?? null,
      confirmedPaymentMinor: aggregates.confirmedPaymentMinor ?? null,
      unallocatedConfirmedMinor: aggregates.unallocatedConfirmedMinor ?? 0,
      activeAllocationCount: aggregates.activeAllocationCount ?? 0,
      reversedAllocationCount: aggregates.reversedAllocationCount ?? 0,
      paymentStatus: aggregates.paymentStatus || document?.paymentStatus || null,
    },
  };
}

const HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT = Object.freeze({
  eventType: 'hotel_checkout.financial_override',
  requiredFields: Object.freeze(['reservationId', 'financialDocumentId', 'establishmentId', 'actorId', 'actorRole', 'reason', 'balanceMinor', 'currency', 'blockerCodes', 'createdAt']),
  optionalFields: Object.freeze(['ticketReference']),
  appendOnly: true,
});

module.exports = {
  BLOCKERS, WARNINGS, INFO, HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT,
  evaluateHotelCheckoutFinancialReadiness,
};
