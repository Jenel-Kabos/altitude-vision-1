const FinancialPayment = require('../../models/FinancialPayment');
const FinancialDocument = require('../../models/FinancialDocument');
const PaymentAllocation = require('../../models/PaymentAllocation');
const { assertAmountMinor } = require('./moneyService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');
const { runFinancialOperation } = require('./financialTransactionService');
const { financialCheckpoint } = require('./financialFaultInjection');
const logger = require('../../utils/logger');
const { hashPayload } = require('./financialIdempotencyService');

function derivePaymentStatus(total, allocated) { if (allocated <= 0) return 'unpaid'; if (allocated < total) return 'partially_paid'; if (allocated === total) return 'paid'; return 'overpaid'; }
const getPaymentAllocatedMinor = (payment) => payment.allocatedAmountMinor;
const getPaymentAvailableMinor = (payment) => payment.availableAmountMinor;
const getDocumentAllocatedMinor = (document) => document.amountAllocatedMinor;
const getDocumentBalanceMinor = (document) => document.balanceMinor;
const inSession = (query, session) => (session ? query.session(session) : query);
async function allocatePaymentToDocumentCore({ paymentId, documentId, amountMinor, businessOperationKey, actor, session, transactional, faultInjector }) {
  await financialCheckpoint(faultInjector, 'allocation.before_payment_reservation', { businessOperationKey });
  assertAmountMinor(amountMinor); if (amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Allocation strictement positive requise.');
  const payloadHash = hashPayload({ paymentId: String(paymentId), documentId: String(documentId), amountMinor });
  const existing = await inSession(PaymentAllocation.findOne({ businessOperationKey }), session); if (existing) { if (existing.metadata?.payloadHash !== payloadHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à une autre allocation.', 409); return existing; }
  const [payment, document] = await Promise.all([inSession(FinancialPayment.findById(paymentId), session), inSession(FinancialDocument.findById(documentId), session)]);
  if (!payment || !document) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement ou facture introuvable.', 404);
  if (payment.domain !== document.domain || String(payment.establishmentId) !== String(document.establishmentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Paiement et facture appartiennent à des établissements différents.', 409);
  if (payment.currency !== document.currency) fail('FINANCIAL_CURRENCY_MISMATCH', 'Devises incompatibles.', 409);
  if (payment.status !== 'succeeded') fail('FINANCIAL_PAYMENT_NOT_ALLOCATABLE', 'Le paiement n’est pas confirmé.', 409);
  if (document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'La facture doit être émise.', 409);
  if (payment.domain === 'hotel' && payment.metadata?.financialDocumentId && String(payment.metadata.financialDocumentId) !== String(documentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Ce paiement hôtelier est rattaché à une autre facture.', 409);
  if (amountMinor > payment.availableAmountMinor) fail('FINANCIAL_PAYMENT_OVERALLOCATION', 'Le montant dépasse le montant disponible du paiement.', 409);
  if (amountMinor > document.balanceMinor) fail('FINANCIAL_DOCUMENT_OVERPAYMENT', 'Le montant dépasse le solde restant de la facture.', 409);
  const reservedPayment = await FinancialPayment.findOneAndUpdate({ _id: paymentId, status: 'succeeded', availableAmountMinor: { $gte: amountMinor } }, { $inc: { availableAmountMinor: -amountMinor, allocatedAmountMinor: amountMinor } }, { new: true, session });
  if (!reservedPayment) fail('FINANCIAL_PAYMENT_OVERALLOCATION', 'Paiement déjà alloué par une opération concurrente.', 409);
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
    fail('FINANCIAL_DOCUMENT_OVERPAYMENT', 'Solde déjà alloué par une opération concurrente.', 409);
  }
  await financialCheckpoint(faultInjector, 'allocation.after_document_reservation', { businessOperationKey });
  reservedDocument.paymentStatus = derivePaymentStatus(reservedDocument.totalMinor, reservedDocument.amountAllocatedMinor - (reservedDocument.refundedAmountMinor || 0)); await reservedDocument.save({ session });
  await financialCheckpoint(faultInjector, 'allocation.before_create', { businessOperationKey });
  let allocation;
  const allocationData = { financialPayment: paymentId, financialDocument: documentId, domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, currency: document.currency, amountMinor, businessOperationKey, allocatedBy: actor.id || actor._id, metadata: { payloadHash } };
  try { allocation = session ? (await PaymentAllocation.create([allocationData], { session }))[0] : await PaymentAllocation.create(allocationData); }
  catch (error) { if (!transactional) await Promise.all([FinancialPayment.updateOne({ _id: paymentId }, { $inc: { availableAmountMinor: amountMinor, allocatedAmountMinor: -amountMinor } }), FinancialDocument.updateOne({ _id: documentId }, { $inc: { balanceMinor: amountMinor, amountAllocatedMinor: -amountMinor }, $set: { paymentStatus: document.paymentStatus } })]); if (error.code === 11000) return inSession(PaymentAllocation.findOne({ businessOperationKey }), session); throw error; }
  await financialCheckpoint(faultInjector, 'allocation.after_create', { businessOperationKey, allocationId: allocation._id });
  await financialCheckpoint(faultInjector, 'allocation.before_ledger', { businessOperationKey, allocationId: allocation._id });
  const ledgerData = { eventType: 'payment.allocated', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: paymentId }, { entityType: 'FinancialDocument', entityId: documentId }], actorType: 'user', actorId: actor.id || actor._id, amountMinor, currency: allocation.currency, businessOperationKey, newState: { status: 'active' } };
  await (session ? appendFinancialLedgerEntry(ledgerData, { session }) : appendFinancialLedgerEntry(ledgerData));
  const shared = { domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'FinancialPayment', entityId: paymentId, relatedEntities: ledgerData.relatedEntities, actorType: 'user', actorId: actor.id || actor._id, currency: allocation.currency, businessOperationKey };
  if (reservedPayment.availableAmountMinor > 0) await (session ? appendFinancialLedgerEntry({ ...shared, eventType: 'payment.unallocated_balance_remaining', amountMinor: reservedPayment.availableAmountMinor, newState: { availableAmountMinor: reservedPayment.availableAmountMinor } }, { session }) : appendFinancialLedgerEntry({ ...shared, eventType: 'payment.unallocated_balance_remaining', amountMinor: reservedPayment.availableAmountMinor, newState: { availableAmountMinor: reservedPayment.availableAmountMinor } }));
  if (reservedPayment.availableAmountMinor === 0) await (session ? appendFinancialLedgerEntry({ ...shared, eventType: 'payment.fully_allocated', amountMinor: reservedPayment.allocatedAmountMinor, newState: { availableAmountMinor: 0 } }, { session }) : appendFinancialLedgerEntry({ ...shared, eventType: 'payment.fully_allocated', amountMinor: reservedPayment.allocatedAmountMinor, newState: { availableAmountMinor: 0 } }));
  if (document.paymentStatus !== reservedDocument.paymentStatus) await (session ? appendFinancialLedgerEntry({ ...shared, eventType: 'document.payment_status_changed', entityType: 'FinancialDocument', entityId: documentId, amountMinor: reservedDocument.amountAllocatedMinor, previousState: { paymentStatus: document.paymentStatus }, newState: { paymentStatus: reservedDocument.paymentStatus } }, { session }) : appendFinancialLedgerEntry({ ...shared, eventType: 'document.payment_status_changed', entityType: 'FinancialDocument', entityId: documentId, amountMinor: reservedDocument.amountAllocatedMinor, previousState: { paymentStatus: document.paymentStatus }, newState: { paymentStatus: reservedDocument.paymentStatus } }));
  await financialCheckpoint(faultInjector, 'allocation.after_ledger', { businessOperationKey, allocationId: allocation._id });
  return allocation;
}
async function allocatePaymentToDocument(args) { return runFinancialOperation({ operationName: 'payment.allocate', transactionMode: args.transactionMode }, (context) => allocatePaymentToDocumentCore({ ...args, ...context })); }
async function reversePaymentAllocationCore({ allocationId, reason, businessOperationKey, actor, session, faultInjector }) {
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) fail('FINANCIAL_ALLOCATION_REASON_REQUIRED', 'Une raison de renversement est obligatoire.');
  const reversalHash = hashPayload({ allocationId: String(allocationId), reason: normalizedReason });
  let allocation = await PaymentAllocation.findOneAndUpdate({ _id: allocationId, status: 'active' }, { status: 'reversed', reversedAt: new Date(), reversedBy: actor.id || actor._id, reversalReason: normalizedReason, 'metadata.reversalOperationKey': businessOperationKey, 'metadata.reversalPayloadHash': reversalHash }, { new: true, session });
  if (!allocation) { allocation = await inSession(PaymentAllocation.findById(allocationId), session); if (allocation?.status === 'reversed' && allocation.metadata?.reversalOperationKey === businessOperationKey && allocation.metadata?.reversalPayloadHash === reversalHash) return allocation; fail('FINANCIAL_ALLOCATION_ALREADY_REVERSED', 'Allocation absente, déjà renversée ou données contradictoires.', 409); }
  await financialCheckpoint(faultInjector, 'reversal.after_lock', { businessOperationKey, allocationId });
  await financialCheckpoint(faultInjector, 'reversal.before_payment_restore', { businessOperationKey, allocationId });
  const payment = await FinancialPayment.findByIdAndUpdate(allocation.financialPayment, { $inc: { availableAmountMinor: allocation.amountMinor, allocatedAmountMinor: -allocation.amountMinor } }, { new: true, session });
  await financialCheckpoint(faultInjector, 'reversal.before_document_restore', { businessOperationKey, allocationId });
  const document = await FinancialDocument.findByIdAndUpdate(allocation.financialDocument, { $inc: { balanceMinor: allocation.amountMinor, amountAllocatedMinor: -allocation.amountMinor } }, { new: true, session });
  document.paymentStatus = derivePaymentStatus(document.totalMinor, document.amountAllocatedMinor - (document.refundedAmountMinor || 0)); await document.save({ session });
  await financialCheckpoint(faultInjector, 'reversal.before_ledger', { businessOperationKey, allocationId });
  const ledgerData = { eventType: 'payment.allocation_reversed', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, actorType: 'user', actorId: actor.id || actor._id, amountMinor: -allocation.amountMinor, currency: allocation.currency, businessOperationKey, previousState: { status: 'active' }, newState: { status: 'reversed', reason } };
  await (session ? appendFinancialLedgerEntry(ledgerData, { session }) : appendFinancialLedgerEntry(ledgerData));
  const previousPaymentStatus = derivePaymentStatus(document.totalMinor, document.amountAllocatedMinor + allocation.amountMinor);
  if (document.paymentStatus !== previousPaymentStatus) {
    const statusData = { eventType: 'document.payment_status_changed', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'FinancialDocument', entityId: allocation.financialDocument, relatedEntities: [{ entityType: 'FinancialPayment', entityId: allocation.financialPayment }, { entityType: 'PaymentAllocation', entityId: allocation._id }], actorType: 'user', actorId: actor.id || actor._id, amountMinor: document.amountAllocatedMinor, currency: allocation.currency, businessOperationKey, previousState: { paymentStatus: previousPaymentStatus }, newState: { paymentStatus: document.paymentStatus } };
    await (session ? appendFinancialLedgerEntry(statusData, { session }) : appendFinancialLedgerEntry(statusData));
  }
  await financialCheckpoint(faultInjector, 'reversal.after_ledger', { businessOperationKey, allocationId });
  return { allocation, payment, document };
}
async function reversePaymentAllocation(args) { return runFinancialOperation({ operationName: 'payment.allocation.reverse', transactionMode: args.transactionMode }, ({ session }) => reversePaymentAllocationCore({ ...args, session })); }
module.exports = { derivePaymentStatus, getPaymentAllocatedMinor, getPaymentAvailableMinor, getDocumentAllocatedMinor, getDocumentBalanceMinor, allocatePaymentToDocument, reversePaymentAllocation };
