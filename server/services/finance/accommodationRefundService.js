const FinancialRefund = require('../../models/FinancialRefund');
const FinancialPayment = require('../../models/FinancialPayment');
const FinancialDocument = require('../../models/FinancialDocument');
const Reservation = require('../../models/AccommodationReservation');
const FinancialLedgerEntry = require('../../models/FinancialLedgerEntry');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { runFinancialOperation } = require('./financialTransactionService');
const { fail } = require('./financialError');
const billing = require('./accommodationBillingService');
const { financialCheckpoint } = require('./financialFaultInjection');
const { getStayFinancialSummary } = require('./accommodationStayBalanceService');

const actorId = (actor) => actor.id || actor._id;
const inSession = (query, session) => session ? query.session(session) : query;
const derivedStatus = (total, net, refunded) => refunded > 0 && net === 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : net <= 0 ? 'unpaid' : net < total ? 'partially_paid' : 'paid';
const ACTIVE_REFUND_STATUSES = ['requested', 'approved', 'processing', 'completed'];
const REASONS = Object.freeze({ client: 'CLIENT_CANCELLATION', owner: 'OWNER_CANCELLATION', platform: 'PLATFORM_CANCELLATION', late: 'LATE_PAYMENT_AFTER_EXPIRY' });
const reasonLabel = (code) => ({ CLIENT_CANCELLATION: 'Annulation par le client', OWNER_CANCELLATION: 'Annulation par le propriétaire', PLATFORM_CANCELLATION: 'Annulation par la plateforme', LATE_PAYMENT_AFTER_EXPIRY: 'Paiement reçu après expiration de la réservation', OVERPAYMENT: 'Trop-perçu' }[code] || code);

async function refundableSummary(reservationId) {
  const reservation = await Reservation.findById(reservationId); if (!reservation) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
  const payments = await FinancialPayment.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id, status: { $in: ['succeeded', 'partially_refunded', 'refunded'] } }).select('-providerMetadata -payloadHash').lean();
  const refunds = await FinancialRefund.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id }).sort({ createdAt: -1 }).lean();
  const completed = refunds.filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.amountMinor, 0);
  const reserved = refunds.filter((item) => ['requested', 'approved', 'processing'].includes(item.status)).reduce((sum, item) => sum + item.amountMinor, 0);
  const gross = payments.reduce((sum, item) => sum + item.allocatedAmountMinor, 0);
  const net = Math.max(0, gross - completed);
  const stay = getStayFinancialSummary(reservation, { validatedPaidAmount: gross, alreadyRefundedAmount: completed, alreadyReservedForRefundAmount: reserved, now: reservation.cancelledAt || new Date() });
  const retained = reservation.cancellationActor === 'client'
    ? Math.min(stay.nonRefundableAmount, net)
    : reservation.checkedInAt ? Math.min(stay.consumedStayAmount, net) : 0;
  const deductionData = await require('./accommodationDeductionService').summary(reservationId);
  return { reservation, payments, refunds, deductions: deductionData.deductions, validatedDeductions: deductionData.validatedDeductions, grossAmountPaid: gross, refundedAmount: completed, reservedForRefundAmount: reserved, netAmountPaid: net, nonRefundableGuarantee: reservation.cancellationActor === 'client' ? Math.min(stay.firstNightGuarantee, retained) : 0, nonRefundableAmount: retained, refundableAmount: Math.max(0, gross - retained - completed - reserved), stay, refundCalculation: reservation.refundCalculationSnapshot || null };
}

async function reservedForPayment(paymentId, session) {
  const rows = await FinancialRefund.aggregate([{ $match: { financialPayment: paymentId, status: { $in: ACTIVE_REFUND_STATUSES } } }, { $group: { _id: null, amount: { $sum: '$amountMinor' } } }]).session(session || null);
  return rows[0]?.amount || 0;
}

async function createRequiredRefund({ reservation, payment, amountMinor, reasonCode, actor, session }) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  const key = `accommodation-refund-required:${reservation._id}:${payment._id}:${reasonCode}`;
  const existing = await inSession(FinancialRefund.findOne({ businessOperationKey: key }), session); if (existing) return existing;
  const refund = new FinancialRefund({ tenant: reservation.tenant || payment.tenant || null, domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, financialPayment: payment._id, financialDocument: payment.metadata?.financialDocumentId || reservation.financialDocument, subjectType: payment.subjectType, subjectId: payment.subjectId, amountMinor, currency: payment.currency, reasonCode, reason: reasonLabel(reasonCode), provider: payment.provider || 'manual', providerRefundSupported: false, requestedBy: actor ? actorId(actor) : payment.createdBy, businessOperationKey: key, metadata: { execution: 'manual_offline', source: 'automatic_policy', calculation: reservation.refundCalculationSnapshot || undefined } });
  try { await refund.save({ session }); } catch (error) { if (error?.code === 11000) return inSession(FinancialRefund.findOne({ businessOperationKey: key }), session); throw error; }
  await appendFinancialLedgerEntry({ eventType: 'refund.required', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId, entityType: 'FinancialRefund', entityId: refund._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }, { entityType: 'AccommodationReservation', entityId: payment.subjectId }], actorType: actor ? 'user' : 'system', actorId: actor ? actorId(actor) : undefined, amountMinor: -amountMinor, currency: refund.currency, businessOperationKey: `${key}:ledger`, newState: { status: 'requested', reasonCode, execution: 'manual_offline' } }, { session });
  return refund;
}

async function ensureCancellationRefunds({ reservationId, actor, session }) {
  const reservation = await inSession(Reservation.findById(reservationId), session); if (!reservation) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
  if (reservation.status !== 'cancelled') fail('FINANCIAL_REFUND_POLICY_NOT_APPLICABLE', 'La réservation doit être annulée.', 409);
  const payments = await inSession(FinancialPayment.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id, status: { $in: ['succeeded', 'partially_refunded'] } }).sort({ createdAt: 1 }), session);
  let retained = Number(reservation.nonRefundableAmount || 0);
  if (reservation.cancellationActor === 'client' && !retained) retained = Number(reservation.pricingSnapshot?.requiredToConfirm || 0);
  const created = [];
  if (reservation.cancellationResponsibility === 'client' && reservation.checkedInAt) {
    const { applyApproved } = require('./accommodationDeductionService');
    await applyApproved({ reservationId: reservation._id, maximumMinor: Number(reservation.refundCalculationSnapshot?.futurePaidRefundable || 0) });
  }
  for (const payment of payments) {
    const allocated = Number(payment.allocatedAmountMinor || 0); const retainHere = Math.min(retained, allocated); retained -= retainHere;
    const reserved = await reservedForPayment(payment._id, session); const amount = Math.max(0, allocated - retainHere - reserved);
    if (amount) created.push(await createRequiredRefund({ reservation, payment, amountMinor: amount, reasonCode: REASONS[reservation.cancellationActor] || REASONS.platform, actor, session }));
  }
  return created;
}

async function ensureLatePaymentRefund({ reservationId, paymentId, session }) {
  const [reservation, payment] = await Promise.all([inSession(Reservation.findById(reservationId), session), inSession(FinancialPayment.findById(paymentId).select('+providerMetadata'), session)]);
  if (!reservation || !payment || reservation.status !== 'expired' || payment.providerRefundStatus !== 'refund_required') return null;
  const reserved = await reservedForPayment(payment._id, session); const amount = Math.max(0, Number(payment.amountMinor || 0) - Number(payment.refundedAmountMinor || 0) - reserved);
  return createRequiredRefund({ reservation, payment, amountMinor: amount, reasonCode: REASONS.late, session });
}

async function requestRefund({ reservationId, actor }) {
  const refunds = await ensureCancellationRefunds({ reservationId, actor });
  return { refund: refunds[0] || null, refunds, created: refunds.length > 0 };
}

async function approveRefund({ refundId, actor, idempotencyKey }) {
  const refund = await FinancialRefund.findOneAndUpdate({ _id: refundId, status: 'requested' }, { status: 'approved', approvedBy: actorId(actor), approvedAt: new Date(), 'metadata.approvalKey': idempotencyKey }, { new: true });
  if (!refund) { const current = await FinancialRefund.findById(refundId); if (current?.metadata?.approvalKey === idempotencyKey) return current; fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non approuvable.', 409); }
  await appendFinancialLedgerEntry({ eventType: 'refund.approved', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId, entityType: 'FinancialRefund', entityId: refund._id, actorType: 'user', actorId: actorId(actor), amountMinor: -refund.amountMinor, currency: refund.currency, businessOperationKey: `${idempotencyKey}:ledger`, previousState: { status: 'requested' }, newState: { status: 'approved' } }); return refund;
}

async function completeManualRefund({ refundId, reference, method, amountMinor, effectiveDate, proofUrl, comment, actor, idempotencyKey, transactionMode = 'auto', faultInjector }) {
  if (!String(reference || '').trim()) fail('FINANCIAL_REFUND_REFERENCE_REQUIRED', 'Référence de décaissement requise.', 422);
  if (!['cash', 'bank_transfer', 'cheque'].includes(method)) fail('FINANCIAL_REFUND_METHOD_UNSUPPORTED', 'Moyen de remboursement requis.', 422);
  const duplicateReference = await FinancialRefund.findOne({ manualReference: String(reference).trim(), _id: { $ne: refundId } });
  if (duplicateReference) fail('FINANCIAL_REFUND_REFERENCE_DUPLICATE', 'Cette référence externe est déjà rapprochée.', 409);
  return runFinancialOperation({ operationName: 'refund.accommodation.complete', transactionMode }, async ({ session, transactional }) => {
    let current = await inSession(FinancialRefund.findById(refundId), session); if (!current) fail('FINANCIAL_REFUND_NOT_FOUND', 'Remboursement introuvable.', 404);
    if (current.status === 'completed' && current.metadata?.completionKey === idempotencyKey) return current;
    if (amountMinor !== undefined && Number(amountMinor) !== current.amountMinor) fail('FINANCIAL_REFUND_AMOUNT_MISMATCH', 'Le montant exécuté doit correspondre au montant autorisé.', 409);
    if (current.status === 'approved') current = await FinancialRefund.findOneAndUpdate({ _id: refundId, status: 'approved' }, { status: 'processing', method, processedBy: actorId(actor), manualReference: String(reference).trim(), proofUrl, comment, 'metadata.completionKey': idempotencyKey, 'metadata.checkpoints.refundMarkedProcessing': new Date() }, { new: true, session });
    if (!current || current.status !== 'processing' || current.metadata?.completionKey !== idempotencyKey) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non finalisable ou déjà réclamé.', 409);
    await financialCheckpoint(faultInjector, 'refund.after_processing', { refundId });
    let paymentAdjusted = Boolean(current.metadata?.checkpoints?.paymentAdjusted); let documentAdjusted = Boolean(current.metadata?.checkpoints?.documentAdjusted); let ledgerCreated = Boolean(current.metadata?.checkpoints?.ledgerCreated);
    try {
      let payment = await inSession(FinancialPayment.findById(current.financialPayment), session);
      if (!paymentAdjusted) {
        const ceilingField = current.reasonCode === 'LATE_PAYMENT_AFTER_EXPIRY' ? '$amountMinor' : '$allocatedAmountMinor';
        payment = await FinancialPayment.findOneAndUpdate({ _id: current.financialPayment, status: { $in: ['succeeded', 'partially_refunded'] }, $expr: { $lte: [{ $add: ['$refundedAmountMinor', current.amountMinor] }, ceilingField] } }, { $inc: { refundedAmountMinor: current.amountMinor } }, { new: true, session });
        if (!payment) fail('FINANCIAL_REFUND_OVERPAYMENT', 'Montant remboursable épuisé.', 409);
        const refundableCeiling = current.reasonCode === 'LATE_PAYMENT_AFTER_EXPIRY' ? payment.amountMinor : payment.allocatedAmountMinor;
        payment.status = payment.refundedAmountMinor === refundableCeiling ? 'refunded' : 'partially_refunded'; if (payment.provider === 'mtn_direct') payment.providerRefundStatus = 'completed'; await payment.save({ session }); paymentAdjusted = true;
        await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.paymentAdjusted': new Date() } }, { session });
      }
      await financialCheckpoint(faultInjector, 'refund.after_payment_adjusted', { refundId });
      let document = await inSession(FinancialDocument.findById(current.financialDocument), session);
      if (!documentAdjusted && current.reasonCode !== 'LATE_PAYMENT_AFTER_EXPIRY') {
        document = await FinancialDocument.findOneAndUpdate({ _id: current.financialDocument }, { $inc: { refundedAmountMinor: current.amountMinor, balanceMinor: current.amountMinor } }, { new: true, session }); const net = Math.max(0, document.amountAllocatedMinor - document.refundedAmountMinor); document.paymentStatus = net <= 0 ? 'unpaid' : net < document.totalMinor ? 'partially_paid' : 'paid'; await document.save({ session }); documentAdjusted = true;
        await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.documentAdjusted': new Date() } }, { session });
      }
      await financialCheckpoint(faultInjector, 'refund.before_ledger', { refundId });
      const ledgerKey = `${idempotencyKey}:ledger`; const existingLedger = await inSession(FinancialLedgerEntry.findOne({ businessOperationKey: ledgerKey, eventType: 'refund.completed' }), session);
      if (!ledgerCreated && !existingLedger) await appendFinancialLedgerEntry({ eventType: 'refund.completed', domain: current.domain, establishmentType: current.establishmentType, establishmentId: current.establishmentId, entityType: 'FinancialRefund', entityId: current._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }, { entityType: 'FinancialDocument', entityId: document._id }, { entityType: 'AccommodationReservation', entityId: current.subjectId }], actorType: 'user', actorId: actorId(actor), amountMinor: -current.amountMinor, currency: current.currency, businessOperationKey: ledgerKey, previousState: { status: 'approved' }, newState: { status: 'completed', reference: current.manualReference, execution: 'manual_offline' } }, { session });
      ledgerCreated = true; await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.ledgerCreated': new Date() } }, { session });
      await financialCheckpoint(faultInjector, 'refund.after_ledger', { refundId });
      if (current.reasonCode !== 'LATE_PAYMENT_AFTER_EXPIRY') await billing.recalculateReservationFinancials(current.subjectId, { session }); await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.financialTotalsRecomputed': new Date() } }, { session });
      await financialCheckpoint(faultInjector, 'refund.before_completed', { refundId });
      return FinancialRefund.findOneAndUpdate({ _id: current._id, status: 'processing', 'metadata.completionKey': idempotencyKey }, { status: 'completed', processedAt: effectiveDate ? new Date(effectiveDate) : new Date(), 'metadata.checkpoints.refundMarkedCompleted': new Date() }, { new: true, session });
    } catch (error) {
      if (!transactional && !ledgerCreated) {
        if (documentAdjusted) await FinancialDocument.updateOne({ _id: current.financialDocument }, { $inc: { refundedAmountMinor: -current.amountMinor, balanceMinor: -current.amountMinor } });
        if (paymentAdjusted) { const restored = await FinancialPayment.findByIdAndUpdate(current.financialPayment, { $inc: { refundedAmountMinor: -current.amountMinor } }, { new: true }); restored.status = restored.refundedAmountMinor > 0 ? 'partially_refunded' : 'succeeded'; await restored.save(); }
        await FinancialRefund.updateOne({ _id: current._id, status: 'processing' }, { status: 'approved', $unset: { 'metadata.checkpoints.paymentAdjusted': 1, 'metadata.checkpoints.documentAdjusted': 1, 'metadata.checkpoints.refundMarkedProcessing': 1 } });
      }
      throw error;
    }
  });
}

async function cancelRefund({ refundId, reason, actor, idempotencyKey }) {
  const refund = await FinancialRefund.findOneAndUpdate({ _id: refundId, status: { $in: ['requested', 'approved', 'failed'] } }, { status: 'cancelled', cancelledBy: actorId(actor), cancelledAt: new Date(), comment: reason, 'metadata.cancellationKey': idempotencyKey }, { new: true });
  if (!refund) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non annulable.', 409);
  await appendFinancialLedgerEntry({ eventType: 'refund.cancelled', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId, entityType: 'FinancialRefund', entityId: refund._id, actorType: 'user', actorId: actorId(actor), amountMinor: -refund.amountMinor, currency: refund.currency, businessOperationKey: `${idempotencyKey}:ledger`, newState: { status: 'cancelled', reason } }); return refund;
}

module.exports = { REASONS, refundableSummary, requestRefund, ensureCancellationRefunds, ensureLatePaymentRefund, approveRefund, completeManualRefund, cancelRefund, derivedStatus };
