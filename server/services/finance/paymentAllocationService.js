const FinancialPayment = require('../../models/FinancialPayment');
const FinancialDocument = require('../../models/FinancialDocument');
const PaymentAllocation = require('../../models/PaymentAllocation');
const { assertAmountMinor } = require('./moneyService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { fail } = require('./financialError');

function derivePaymentStatus(total, allocated) { if (allocated <= 0) return 'unpaid'; if (allocated < total) return 'partially_paid'; if (allocated === total) return 'paid'; return 'overpaid'; }
async function allocatePaymentToDocument({ paymentId, documentId, amountMinor, businessOperationKey, actor }) {
  assertAmountMinor(amountMinor); if (amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Allocation strictement positive requise.');
  const existing = await PaymentAllocation.findOne({ businessOperationKey }); if (existing) return existing;
  const [payment, document] = await Promise.all([FinancialPayment.findById(paymentId), FinancialDocument.findById(documentId)]);
  if (!payment || !document) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement ou facture introuvable.', 404);
  if (payment.domain !== document.domain || String(payment.establishmentId) !== String(document.establishmentId)) fail('FINANCIAL_ESTABLISHMENT_MISMATCH', 'Paiement et facture appartiennent à des établissements différents.', 409);
  if (payment.currency !== document.currency) fail('FINANCIAL_CURRENCY_MISMATCH', 'Devises incompatibles.', 409);
  if (payment.status !== 'succeeded') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Le paiement n’est pas confirmé.', 409);
  if (document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'La facture doit être émise.', 409);
  if (amountMinor > payment.availableAmountMinor || amountMinor > document.balanceMinor) fail('FINANCIAL_OVERALLOCATION', 'Le montant dépasse le disponible ou le solde.', 409);
  const reservedPayment = await FinancialPayment.findOneAndUpdate({ _id: paymentId, status: 'succeeded', availableAmountMinor: { $gte: amountMinor } }, { $inc: { availableAmountMinor: -amountMinor, allocatedAmountMinor: amountMinor } }, { new: true });
  if (!reservedPayment) fail('FINANCIAL_OVERALLOCATION', 'Paiement déjà alloué par une opération concurrente.', 409);
  const reservedDocument = await FinancialDocument.findOneAndUpdate({ _id: documentId, status: 'issued', balanceMinor: { $gte: amountMinor } }, { $inc: { balanceMinor: -amountMinor, amountAllocatedMinor: amountMinor } }, { new: true });
  if (!reservedDocument) { await FinancialPayment.updateOne({ _id: paymentId }, { $inc: { availableAmountMinor: amountMinor, allocatedAmountMinor: -amountMinor } }); fail('FINANCIAL_OVERALLOCATION', 'Solde déjà alloué par une opération concurrente.', 409); }
  reservedDocument.paymentStatus = derivePaymentStatus(reservedDocument.totalMinor, reservedDocument.amountAllocatedMinor); await reservedDocument.save();
  let allocation;
  try { allocation = await PaymentAllocation.create({ financialPayment: paymentId, financialDocument: documentId, domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId, currency: document.currency, amountMinor, businessOperationKey, allocatedBy: actor.id || actor._id }); }
  catch (error) { await Promise.all([FinancialPayment.updateOne({ _id: paymentId }, { $inc: { availableAmountMinor: amountMinor, allocatedAmountMinor: -amountMinor } }), FinancialDocument.updateOne({ _id: documentId }, { $inc: { balanceMinor: amountMinor, amountAllocatedMinor: -amountMinor }, $set: { paymentStatus: document.paymentStatus } })]); if (error.code === 11000) return PaymentAllocation.findOne({ businessOperationKey }); throw error; }
  await appendFinancialLedgerEntry({ eventType: 'payment.allocated', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: paymentId }, { entityType: 'FinancialDocument', entityId: documentId }], actorType: 'user', actorId: actor.id || actor._id, amountMinor, currency: allocation.currency, businessOperationKey, newState: { status: 'active' } });
  return allocation;
}
async function reversePaymentAllocation({ allocationId, reason, businessOperationKey, actor }) {
  if (!String(reason || '').trim()) fail('FINANCIAL_INVALID_TRANSITION', 'Une raison de renversement est obligatoire.');
  let allocation = await PaymentAllocation.findOneAndUpdate({ _id: allocationId, status: 'active' }, { status: 'reversed', reversedAt: new Date(), reversedBy: actor.id || actor._id, reversalReason: reason }, { new: true });
  if (!allocation) { allocation = await PaymentAllocation.findById(allocationId); if (allocation?.status === 'reversed' && allocation.metadata?.reversalOperationKey === businessOperationKey) return allocation; fail('FINANCIAL_INVALID_TRANSITION', 'Allocation absente ou déjà renversée.', 409); }
  allocation.metadata = { ...(allocation.metadata || {}), reversalOperationKey: businessOperationKey }; await allocation.save();
  const [payment, document] = await Promise.all([FinancialPayment.findByIdAndUpdate(allocation.financialPayment, { $inc: { availableAmountMinor: allocation.amountMinor, allocatedAmountMinor: -allocation.amountMinor } }, { new: true }), FinancialDocument.findByIdAndUpdate(allocation.financialDocument, { $inc: { balanceMinor: allocation.amountMinor, amountAllocatedMinor: -allocation.amountMinor } }, { new: true })]);
  document.paymentStatus = derivePaymentStatus(document.totalMinor, document.amountAllocatedMinor); await document.save();
  await appendFinancialLedgerEntry({ eventType: 'payment.allocation_reversed', domain: allocation.domain, establishmentType: allocation.establishmentType, establishmentId: allocation.establishmentId, entityType: 'PaymentAllocation', entityId: allocation._id, actorType: 'user', actorId: actor.id || actor._id, amountMinor: -allocation.amountMinor, currency: allocation.currency, businessOperationKey, previousState: { status: 'active' }, newState: { status: 'reversed', reason } });
  return { allocation, payment, document };
}
module.exports = { derivePaymentStatus, allocatePaymentToDocument, reversePaymentAllocation };
