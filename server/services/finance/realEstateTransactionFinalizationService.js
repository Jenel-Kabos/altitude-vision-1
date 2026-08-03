const Transaction = require('../../models/Transaction');
const Property = require('../../models/Property');
const Document = require('../../models/Document');
const FinancialLedgerEntry = require('../../models/FinancialLedgerEntry');
const { hashPayload } = require('./financialIdempotencyService');
const { runFinancialOperation } = require('./financialTransactionService');
const { FinancialError } = require('./financialError');
const { financialCheckpoint } = require('./financialFaultInjection');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const RealEstateReservation = require('../../models/RealEstateReservation');

const inSession = (query, session) => (session ? query.session(session) : query);
const operationKeyFor = (transactionId) => `real-estate:transaction:${transactionId}:finalize`;
const calculateCommission = (finalAmount, tauxPercent = 10, hasSpecial = false) => {
  const total = Math.round(finalAmount * (tauxPercent / 100));
  const ownerPayout = hasSpecial ? Math.round(total * 0.30) : 0;
  return { taux: tauxPercent, total, ownerPayout, agencyNet: total - ownerPayout };
};
const assertFinalizable = (transaction) => {
  if (!transaction) throw new FinancialError('FINANCIAL_TRANSACTION_NOT_FOUND', 'Transaction introuvable.', 404);
  if (transaction.status === 'Annulée') throw new FinancialError('FINANCIAL_TRANSACTION_CANCELLED', 'Transaction annulée — impossible de finaliser.', 409);
  if (transaction.paymentStatus !== 'confirmé') throw new FinancialError('PAYMENT_NOT_CONFIRMED', 'Le paiement doit être confirmé avant la finalisation.', 409);
};
// DOC-ARCH-2 — classement automatique du Centre documentaire : ce Document
// est produit par un vrai workflow métier (finalisation de transaction, paiement
// déjà confirmé), jamais une saisie manuelle. `pole`/`service`/`categorie`
// sont donc déduits ici du contexte déjà disponible (transactionType,
// property), jamais demandés à un utilisateur — conformément à la règle
// « un document doit toujours être créé par son workflow métier lorsqu'un
// workflow existe ». `entityType`/`entityId` pointent vers la Transaction
// (source de vérité de cette facture), même convention que le ledger
// financier (`ensureFinalizationLedger`, ci-dessus) qui référence déjà
// `entityType: 'Transaction', entityId: transaction._id`.
const invoiceData = ({ transaction, property, actorId, commission, operationKey }) => ({
  type: 'Facture', status: 'Envoyé', client: transaction.client, createdBy: actorId,
  relatedProperty: property._id, businessOperationKey: operationKey,
  items: [{ description: `Commission agence — ${transaction.transactionType} de "${property.title}"`, quantity: 1, unitPrice: commission.total, total: commission.total }],
  subTotal: commission.total, totalAmount: commission.agencyNet,
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  pole: 'Altimmo',
  service: transaction.transactionType === 'vente' ? 'vente' : 'location',
  categorie: 'Factures',
  entityType: 'Transaction',
  entityId: transaction._id,
  visibility: 'client',
});
async function ensureFinalizationLedger({ transaction, property, actorId, operationKey, session }) {
  const ledgerKey = `${operationKey}:ledger`;
  const existing = await inSession(FinancialLedgerEntry.findOne({ businessOperationKey: ledgerKey, eventType: 'real_estate.transaction.finalized' }), session);
  if (existing) return existing;
  return appendFinancialLedgerEntry({
    eventType: 'real_estate.transaction.finalized', domain: 'real_estate', establishmentType: 'Property', establishmentId: property._id,
    entityType: 'Transaction', entityId: transaction._id, relatedEntities: [{ entityType: 'Property', entityId: property._id }, { entityType: 'Document', entityId: transaction.linkedInvoice }],
    actorType: 'user', actorId, amountMinor: transaction.commission?.agencyNet, currency: 'XAF', businessOperationKey: ledgerKey,
    previousState: { status: 'Paiement en attente', paymentStatus: 'confirmé' }, newState: { status: 'Réussie', linkedInvoice: transaction.linkedInvoice },
    metadata: { transactionType: transaction.transactionType, commission: transaction.commission },
  }, { session });
}

async function finalizeCore({ transactionId, actorId, tauxCommission, operationKey, payloadHash, session, transactional, faultInjector }) {
  let transaction = await inSession(Transaction.findById(transactionId), session);
  assertFinalizable(transaction);
  if (transaction.status === 'Réussie' && transaction.linkedInvoice) {
    if (transaction.finalization?.payloadHash && transaction.finalization.payloadHash !== payloadHash) throw new FinancialError('FINANCIAL_IDEMPOTENCY_CONFLICT', 'La transaction est déjà finalisée avec des paramètres différents.', 409);
    const property = await inSession(Property.findById(transaction.property), session);
    if (property) await ensureFinalizationLedger({ transaction, property, actorId, operationKey, session });
    return { transaction, invoice: await inSession(Document.findById(transaction.linkedInvoice), session), idempotent: true };
  }
  const property = await inSession(Property.findById(transaction.property), session);
  if (!property) throw new FinancialError('FINANCIAL_PROPERTY_NOT_FOUND', 'Bien associé introuvable.', 404);
  if (property.status !== transaction.transactionType) throw new FinancialError('FINANCIAL_TRANSACTION_TYPE_MISMATCH', 'Le type de transaction ne correspond plus au bien.', 409);
  const reservation = await inSession(RealEstateReservation.findById(transaction.reservation), session);
  if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= new Date() || String(reservation.transaction) !== String(transaction._id)) {
    throw new FinancialError('ACTIVE_RESERVATION_REQUIRED', 'La réservation active associée est requise pour finaliser.', 409);
  }
  if (['Vendu', 'Loué', 'Retiré'].includes(property.availability)) {
    throw new FinancialError('FINANCIAL_PROPERTY_ALREADY_CLOSED', 'Le bien est déjà vendu, loué ou retiré.', 409);
  }
  const commission = calculateCommission(transaction.finalAmount, tauxCommission || transaction.commission?.taux || 10, property.hasSpecialCommission);
  const previousPropertyState = { availability: property.availability, isPublished: property.isPublished };

  if (!transactional) {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claimed = await Transaction.findOneAndUpdate(
      { _id: transactionId, status: { $nin: ['Réussie', 'Annulée'] }, paymentStatus: 'confirmé', $or: [{ 'finalization.status': { $in: [null, 'failed'] } }, { 'finalization.status': { $exists: false } }, { 'finalization.status': 'processing', 'finalization.startedAt': { $lt: staleBefore } }] },
      { $set: { 'finalization.operationKey': operationKey, 'finalization.payloadHash': payloadHash, 'finalization.status': 'processing', 'finalization.startedAt': new Date(), 'finalization.previousPropertyState': previousPropertyState, 'finalization.lastError': null }, $inc: { 'finalization.attemptCount': 1 } },
      { new: true },
    );
    if (!claimed) {
      transaction = await Transaction.findById(transactionId);
      if (transaction?.status === 'Réussie' && transaction.linkedInvoice && transaction.finalization?.payloadHash === payloadHash) return { transaction, invoice: await Document.findById(transaction.linkedInvoice), idempotent: true };
      throw new FinancialError('FINANCIAL_FINALIZATION_IN_PROGRESS', 'Une finalisation est déjà en cours.', 409);
    }
  }

  let invoice = await inSession(Document.findOne({ businessOperationKey: operationKey }), session);
  let invoiceCreated = false;
  let businessStateCommitted = false;
  try {
    await financialCheckpoint(faultInjector, 'finalization.before_invoice', { transactionId, operationKey });
    if (!invoice) {
      [invoice] = await Document.create([invoiceData({ transaction, property, actorId, commission, operationKey })], { session });
      invoiceCreated = true;
    }
    await financialCheckpoint(faultInjector, 'finalization.after_invoice', { transactionId, operationKey, invoiceId: invoice._id });
    await Property.findByIdAndUpdate(property._id, { availability: transaction.transactionType === 'vente' ? 'Vendu' : 'Loué', isPublished: false }, { session });
    await financialCheckpoint(faultInjector, 'finalization.after_property', { transactionId, operationKey });
    transaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, status: { $nin: ['Réussie', 'Annulée'] }, paymentStatus: 'confirmé' },
      {
        $set: { status: 'Réussie', commission, linkedInvoice: invoice._id, 'finalization.operationKey': operationKey, 'finalization.payloadHash': payloadHash, 'finalization.status': 'completed', 'finalization.completedAt': new Date(), 'finalization.invoice': invoice._id, 'finalization.lastError': null },
        // Mode transactional : le claim optimiste (et son $inc) ci-dessus est
        // entièrement sauté (voir `if (!transactional)`), donc attemptCount
        // ne serait jamais incrémenté sans ce $inc ici. Mode fallback : déjà
        // incrémenté par le claim, ne pas compter deux fois la même tentative.
        ...(transactional ? { $inc: { 'finalization.attemptCount': 1 } } : {}),
      },
      { new: true, session },
    );
    if (!transaction) throw new FinancialError('FINANCIAL_FINALIZATION_STATE_CHANGED', 'La transaction a changé pendant la finalisation.', 409);
    const converted = await RealEstateReservation.updateOne(
      { _id: reservation._id, status: 'active', transaction: transaction._id },
      { $set: { status: 'converted' }, $push: { history: { from: 'active', to: 'converted', action: 'transaction_finalized', actor: actorId, at: new Date() } } },
      { session },
    );
    if (converted.modifiedCount !== 1) throw new FinancialError('RESERVATION_CONVERSION_CONFLICT', 'La réservation a changé pendant la conversion.', 409);
    await financialCheckpoint(faultInjector, 'finalization.after_transaction', { transactionId, operationKey });
    businessStateCommitted = true;
    await ensureFinalizationLedger({ transaction, property, actorId, operationKey, session });
    await financialCheckpoint(faultInjector, 'finalization.after_ledger', { transactionId, operationKey });
    return { transaction, invoice, idempotent: false };
  } catch (error) {
    if (!transactional && !businessStateCommitted) {
      await Property.findByIdAndUpdate(property._id, previousPropertyState).catch(() => {});
      if (invoiceCreated) await Document.deleteOne({ _id: invoice._id, businessOperationKey: operationKey }).catch(() => {});
      await Transaction.updateOne({ _id: transactionId, 'finalization.operationKey': operationKey, 'finalization.status': 'processing' }, { $set: { 'finalization.status': 'failed', 'finalization.lastError': String(error.message).slice(0, 1000) } }).catch(() => {});
    }
    throw error;
  }
}

async function finalizeRealEstateTransaction({ transactionId, actorId, tauxCommission, transactionMode = 'auto', faultInjector }) {
  const operationKey = operationKeyFor(transactionId);
  const payloadHash = hashPayload({ transactionId: String(transactionId), tauxCommission: tauxCommission || null });
  try {
    return await runFinancialOperation({ operationName: 'real_estate.transaction.finalize', transactionMode }, (context) => finalizeCore({ transactionId, actorId, tauxCommission, operationKey, payloadHash, faultInjector, ...context }));
  } catch (error) {
    if (error.code === 'FINANCIAL_IDEMPOTENCY_CONFLICT') {
      const transaction = await Transaction.findById(transactionId);
      if (transaction?.status === 'Réussie' && transaction.linkedInvoice && transaction.finalization?.payloadHash === payloadHash) return { transaction, invoice: await Document.findById(transaction.linkedInvoice), idempotent: true };
    }
    throw error;
  }
}

module.exports = { finalizeRealEstateTransaction, calculateCommission, operationKeyFor };
