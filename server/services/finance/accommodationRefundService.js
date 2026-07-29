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

const actorId = (actor) => actor.id || actor._id;
const inSession = (query, session) => session ? query.session(session) : query;
const derivedStatus = (total, net, refunded) => refunded > 0 && net === 0 ? 'refunded' : refunded > 0 ? 'partially_refunded' : net <= 0 ? 'unpaid' : net < total ? 'partially_paid' : 'paid';

async function refundableSummary(reservationId) {
  const reservation = await Reservation.findById(reservationId); if (!reservation) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Réservation introuvable.', 404);
  const payments = await FinancialPayment.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id, status: { $in: ['succeeded', 'partially_refunded', 'refunded'] } }).select('-providerMetadata -payloadHash').lean();
  const refunds = await FinancialRefund.find({ subjectType: 'AccommodationReservation', subjectId: reservation._id }).sort({ createdAt: -1 }).lean();
  const completed = refunds.filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.amountMinor, 0);
  const gross = payments.reduce((sum, item) => sum + item.allocatedAmountMinor, 0);
  return { reservation, payments, refunds, grossAmountPaid: gross, refundedAmount: completed, netAmountPaid: Math.max(0, gross - completed), refundableAmount: Math.max(0, gross - completed) };
}

async function requestRefund({ reservationId, paymentId, amountMinor, method, reason, actor, idempotencyKey }) {
  if (!['cash', 'bank_transfer', 'cheque'].includes(method)) fail('FINANCIAL_REFUND_METHOD_UNSUPPORTED', 'Seul un remboursement manuel hors ligne est supporté.', 422);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant de remboursement invalide.', 422);
  const existing = await FinancialRefund.findOne({ businessOperationKey: idempotencyKey }); if (existing) return { refund: existing, created: false };
  const payment = await FinancialPayment.findOne({ _id: paymentId, subjectType: 'AccommodationReservation', subjectId: reservationId, status: { $in: ['succeeded', 'partially_refunded'] } });
  if (!payment) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement confirmé introuvable.', 409);
  const reserved = await FinancialRefund.aggregate([{ $match: { financialPayment: payment._id, status: { $in: ['requested', 'approved', 'processing', 'completed'] } } }, { $group: { _id: null, amount: { $sum: '$amountMinor' } } }]);
  if (amountMinor > payment.allocatedAmountMinor - (reserved[0]?.amount || 0)) fail('FINANCIAL_REFUND_OVERPAYMENT', 'Le montant dépasse le montant remboursable.', 409);
  const refund = await FinancialRefund.create({ domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, financialPayment: payment._id, financialDocument: payment.metadata.financialDocumentId, subjectType: payment.subjectType, subjectId: payment.subjectId, amountMinor, currency: payment.currency, method, reason, requestedBy: actorId(actor), businessOperationKey: idempotencyKey, metadata: { execution: 'manual_offline' } });
  await appendFinancialLedgerEntry({ eventType: 'refund.requested', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId, entityType: 'FinancialRefund', entityId: refund._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }, { entityType: 'AccommodationReservation', entityId: payment.subjectId }], actorType: 'user', actorId: actorId(actor), amountMinor: -amountMinor, currency: refund.currency, businessOperationKey: `${idempotencyKey}:ledger`, newState: { status: 'requested', execution: 'manual_offline' } });
  return { refund, created: true };
}

async function approveRefund({ refundId, actor, idempotencyKey }) {
  const refund = await FinancialRefund.findOneAndUpdate({ _id: refundId, status: 'requested' }, { status: 'approved', approvedBy: actorId(actor), approvedAt: new Date(), 'metadata.approvalKey': idempotencyKey }, { new: true });
  if (!refund) { const current = await FinancialRefund.findById(refundId); if (current?.metadata?.approvalKey === idempotencyKey) return current; fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non approuvable.', 409); }
  await appendFinancialLedgerEntry({ eventType: 'refund.approved', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId, entityType: 'FinancialRefund', entityId: refund._id, actorType: 'user', actorId: actorId(actor), amountMinor: -refund.amountMinor, currency: refund.currency, businessOperationKey: `${idempotencyKey}:ledger`, previousState: { status: 'requested' }, newState: { status: 'approved' } }); return refund;
}

async function completeManualRefund({ refundId, reference, effectiveDate, proofUrl, comment, actor, idempotencyKey, transactionMode = 'auto', faultInjector }) {
  if (!String(reference || '').trim()) fail('FINANCIAL_REFUND_REFERENCE_REQUIRED', 'Référence de décaissement requise.', 422);
  return runFinancialOperation({ operationName: 'refund.accommodation.complete', transactionMode }, async ({ session, transactional }) => {
    let current = await inSession(FinancialRefund.findById(refundId), session); if (!current) fail('FINANCIAL_REFUND_NOT_FOUND', 'Remboursement introuvable.', 404);
    if (current.status === 'completed' && current.metadata?.completionKey === idempotencyKey) return current;
    if (current.status === 'approved') current = await FinancialRefund.findOneAndUpdate({ _id: refundId, status: 'approved' }, { status: 'processing', processedBy: actorId(actor), manualReference: String(reference).trim(), proofUrl, comment, 'metadata.completionKey': idempotencyKey, 'metadata.checkpoints.refundMarkedProcessing': new Date() }, { new: true, session });
    if (!current || current.status !== 'processing' || current.metadata?.completionKey !== idempotencyKey) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non finalisable ou déjà réclamé.', 409);
    await financialCheckpoint(faultInjector, 'refund.after_processing', { refundId });
    let paymentAdjusted = Boolean(current.metadata?.checkpoints?.paymentAdjusted); let documentAdjusted = Boolean(current.metadata?.checkpoints?.documentAdjusted); let ledgerCreated = Boolean(current.metadata?.checkpoints?.ledgerCreated);
    try {
      let payment = await inSession(FinancialPayment.findById(current.financialPayment), session);
      if (!paymentAdjusted) {
        payment = await FinancialPayment.findOneAndUpdate({ _id: current.financialPayment, status: { $in: ['succeeded', 'partially_refunded'] }, $expr: { $lte: [{ $add: ['$refundedAmountMinor', current.amountMinor] }, '$allocatedAmountMinor'] } }, { $inc: { refundedAmountMinor: current.amountMinor } }, { new: true, session });
        if (!payment) fail('FINANCIAL_REFUND_OVERPAYMENT', 'Montant remboursable épuisé.', 409);
        payment.status = payment.refundedAmountMinor === payment.allocatedAmountMinor ? 'refunded' : 'partially_refunded'; await payment.save({ session }); paymentAdjusted = true;
        await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.paymentAdjusted': new Date() } }, { session });
      }
      await financialCheckpoint(faultInjector, 'refund.after_payment_adjusted', { refundId });
      let document = await inSession(FinancialDocument.findById(current.financialDocument), session);
      if (!documentAdjusted) {
        document = await FinancialDocument.findOneAndUpdate({ _id: current.financialDocument }, { $inc: { refundedAmountMinor: current.amountMinor, balanceMinor: current.amountMinor } }, { new: true, session }); const net = Math.max(0, document.amountAllocatedMinor - document.refundedAmountMinor); document.paymentStatus = net <= 0 ? 'unpaid' : net < document.totalMinor ? 'partially_paid' : 'paid'; await document.save({ session }); documentAdjusted = true;
        await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.documentAdjusted': new Date() } }, { session });
      }
      await financialCheckpoint(faultInjector, 'refund.before_ledger', { refundId });
      const ledgerKey = `${idempotencyKey}:ledger`; const existingLedger = await inSession(FinancialLedgerEntry.findOne({ businessOperationKey: ledgerKey, eventType: 'refund.completed' }), session);
      if (!ledgerCreated && !existingLedger) await appendFinancialLedgerEntry({ eventType: 'refund.completed', domain: current.domain, establishmentType: current.establishmentType, establishmentId: current.establishmentId, entityType: 'FinancialRefund', entityId: current._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }, { entityType: 'FinancialDocument', entityId: document._id }, { entityType: 'AccommodationReservation', entityId: current.subjectId }], actorType: 'user', actorId: actorId(actor), amountMinor: -current.amountMinor, currency: current.currency, businessOperationKey: ledgerKey, previousState: { status: 'approved' }, newState: { status: 'completed', reference: current.manualReference, execution: 'manual_offline' } }, { session });
      ledgerCreated = true; await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.ledgerCreated': new Date() } }, { session });
      await financialCheckpoint(faultInjector, 'refund.after_ledger', { refundId });
      await billing.recalculateReservationFinancials(current.subjectId, { session }); await FinancialRefund.updateOne({ _id: current._id }, { $set: { 'metadata.checkpoints.financialTotalsRecomputed': new Date() } }, { session });
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

module.exports = { refundableSummary, requestRefund, approveRefund, completeManualRefund, cancelRefund, derivedStatus };
