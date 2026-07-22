const FinancialPayment = require('../../models/FinancialPayment');
const FinancialDocument = require('../../models/FinancialDocument');
const PaymentAllocation = require('../../models/PaymentAllocation');
const { assertAmountMinor } = require('./moneyService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const { runFinancialOperation } = require('./financialTransactionService');
const { financialCheckpoint } = require('./financialFaultInjection');
const logger = require('../../utils/logger');

function derivePaymentStatus(total, allocated) { if (allocated <= 0) return 'unpaid'; if (allocated < total) return 'partially_paid'; if (allocated === total) return 'paid'; return 'overpaid'; }
const inSession = (query, session) => (session ? query.session(session) : query);
async function allocatePaymentToDocumentCore({ paymentId, documentId, amountMinor, businessOperationKey, actor, session, transactional, faultInjector }) {
  await financialCheckpoint(faultInjector, 'allocation.before_payment_reservation', { businessOperationKey });
  assertAmountMinor(amountMinor); if (amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Allocation strictement positive requise.');
  const existing = await inSession(PaymentAllocation.findOne({ businessOperationKey }), session); if (existing) return existing;
  const [payment, document] = await Promise.all([inSession(FinancialPayment.findById(paymentId), session), inSession(FinancialDocument.findById(documentId), session)]);
  if (!payment || !document) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement ou facture introuvable.', 404);
  if (payment.domain !== document.domain || String(payment.establishmentId) !== String(document.establishmentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Paiement et facture appartiennent à des établissements différents.', 409);
  if (payment.currency !== document.currency) fail('FINANCIAL_CURRENCY_MISMATCH', 'Devises incompatibles.', 409);
  if (payment.status !== 'succeeded') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Le paiement n’est pas confirmé.', 409);
  if (document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'La facture doit être émise.', 409);
  if (amountMinor > payment.availableAmountMinor || amountMinor > document.balanceMinor) fail('FINANCIAL_OVERALLOCATION', 'Le montant dépasse le disponible ou le solde.', 409);
  const reservedPayment = await FinancialPayment.findOneAndUpdate({ _id: paymentId, status: 'succeeded', availableAmountMinor: { $gte: amountMinor } }, { $inc: { availableAmountMinor: -amountMinor, allocatedAmountMinor: amountMinor } }, { new: true, session });
  if (!reservedPayment) fail('FINANCIAL_OVERALLOCATION', 'Paiement déjà alloué par une opération concurrente.', 409);
  await financialCheckpoint(faultInjector, 'allocation.after_payment_reservation', { businessOperationKey });
  await financialCheckpoint(faultInjector, 'allocation.before_document_reservation', { businessOperationKey });
  const reservedDocument = await FinancialDocument.findOneAndUpdate({ _id: documentId, status: 'issued', balanceMinor: { $gte: amountMinor } }, { $inc: { balanceMinor: -amountMinor, amountAllocatedMinor: amountMinor } }, { new: true, session });
  if (!reservedDocument) {
    if (!transactional) {
      try {
        await financialCheckpoint(faultInjector, 'allocation.before_compensation', { businessOperationKey });
        await FinancialPayment.updateOne({ _id: paymentId }, { $inc: { availableAmountMinor: amountMinor, allocatedAmountMinor: -amountMinor } });
      } catch (compensationError) {
        logger.error('financial.compensation.failed', { operationName: 'payment.allocate', businessOperationKey, errorCode: compensationError.code, reconciliationRequired: true });
        const error = new Error('La compensation financière a échoué; une réconciliation est requise.');
        error.code = 'FINANCIAL_COMPENSATION_FAILED'; error.statusCode = 500; error.reconciliationRequired = true; error.businessOperationKey = businessOperationKey;
        throw error;
      }
    }
    fail('FINANCIAL_OVERALLOCATION', 'Solde déjà alloué par une opération concurrente.', 409);
  }
  await financialCheckpoint(faultInjector, 'allocation.after_document_reservation', { businessOperationKey });
  reservedDocument.paymentStatus = derivePaymentStatus(reservedDocument.totalMinor, reservedDocument.amountAllocatedMinor); await reservedDocument.save({ session });
  await financialCheckpoint(faultInjector, 'allocation.before_create', { businessOperationKey });
  let allocation;
  try { allocation = session ? (await PaymentAllocation.create([{ financialPayment: paymentId, financialDocument: documentId, domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, currency: document.currency, amountMinor, businessOperationKey, allocatedBy: actor.id || actor._id }], { session }))[0] : await PaymentAllocation.create({ financialPayment: paymentId, financialDocument: documentId, domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, currency: document.currency, amountMinor, businessOperationKey, allocatedBy: actor.id || actor._id }); }
  catch (error) { if (!transactional) await Promise.all([FinancialPayment.updateOne({ _id: paymentId }, { $inc: { availableAmountMinor: amountMinor, allocatedAmountMinor: -amountMinor } }), FinancialDocument.updateOne({ _id: documentId }, { $inc: { balanceMinor: amountMinor, amountAllocatedMinor: -amountMinor }, $set: { paymentStatus: document.paymentStatus } })]); if (error.code === 11000) return inSession(PaymentAllocation.findOne({ businessOperationKey }), session); throw error; }
  await financialCheckpoint(faultInjector, 'allocation.after_create', { businessOperationKey, allocationId: allocation._id });
  await financialCheckpoint(faultInjector, 'allocation.before_ledger', { businessOperationKey, allocationId: allocation._id });
  const ledgerData = { eventType: 'payment.allocated', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: paymentId }, { entityType: 'FinancialDocument', entityId: documentId }], actorType: 'user', actorId: actor.id || actor._id, amountMinor, currency: allocation.currency, businessOperationKey, newState: { status: 'active' } };
  await (session ? appendFinancialLedgerEntry(ledgerData, { session }) : appendFinancialLedgerEntry(ledgerData));
  await financialCheckpoint(faultInjector, 'allocation.after_ledger', { businessOperationKey, allocationId: allocation._id });
  return allocation;
}
async function allocatePaymentToDocument(args) { return runFinancialOperation({ operationName: 'payment.allocate', transactionMode: args.transactionMode }, (context) => allocatePaymentToDocumentCore({ ...args, ...context })); }
async function reversePaymentAllocationCore({ allocationId, reason, businessOperationKey, actor, session, faultInjector }) {
  if (!String(reason || '').trim()) fail('FINANCIAL_INVALID_TRANSITION', 'Une raison de renversement est obligatoire.');
  let allocation = await PaymentAllocation.findOneAndUpdate({ _id: allocationId, status: 'active' }, { status: 'reversed', reversedAt: new Date(), reversedBy: actor.id || actor._id, reversalReason: reason, 'metadata.reversalOperationKey': businessOperationKey }, { new: true, session });
  if (!allocation) { allocation = await PaymentAllocation.findById(allocationId); if (allocation?.status === 'reversed' && allocation.metadata?.reversalOperationKey === businessOperationKey) return allocation; fail('FINANCIAL_INVALID_TRANSITION', 'Allocation absente ou déjà renversée.', 409); }
  await financialCheckpoint(faultInjector, 'reversal.after_lock', { businessOperationKey, allocationId });
  await financialCheckpoint(faultInjector, 'reversal.before_payment_restore', { businessOperationKey, allocationId });
  const payment = await FinancialPayment.findByIdAndUpdate(allocation.financialPayment, { $inc: { availableAmountMinor: allocation.amountMinor, allocatedAmountMinor: -allocation.amountMinor } }, { new: true, session });
  await financialCheckpoint(faultInjector, 'reversal.before_document_restore', { businessOperationKey, allocationId });
  const document = await FinancialDocument.findByIdAndUpdate(allocation.financialDocument, { $inc: { balanceMinor: allocation.amountMinor, amountAllocatedMinor: -allocation.amountMinor } }, { new: true, session });
  document.paymentStatus = derivePaymentStatus(document.totalMinor, document.amountAllocatedMinor); await document.save({ session });
  await financialCheckpoint(faultInjector, 'reversal.before_ledger', { businessOperationKey, allocationId });
  const ledgerData = { eventType: 'payment.allocation_reversed', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, actorType: 'user', actorId: actor.id || actor._id, amountMinor: -allocation.amountMinor, currency: allocation.currency, businessOperationKey, previousState: { status: 'active' }, newState: { status: 'reversed', reason } };
  await (session ? appendFinancialLedgerEntry(ledgerData, { session }) : appendFinancialLedgerEntry(ledgerData));
  await financialCheckpoint(faultInjector, 'reversal.after_ledger', { businessOperationKey, allocationId });
  return { allocation, payment, document };
}
async function reversePaymentAllocation(args) { return runFinancialOperation({ operationName: 'payment.allocation.reverse', transactionMode: args.transactionMode }, ({ session }) => reversePaymentAllocationCore({ ...args, session })); }
module.exports = { derivePaymentStatus, allocatePaymentToDocument, reversePaymentAllocation };
