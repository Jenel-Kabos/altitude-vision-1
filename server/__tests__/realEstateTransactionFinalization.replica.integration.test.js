const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const Document = require('../models/Document');
const FinancialPayment = require('../models/FinancialPayment');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { finalizeRealEstateTransaction } = require('../services/finance/realEstateTransactionFinalizationService');
const { createManualPayment } = require('../services/finance/financialPaymentService');
const RealEstateReservation = require('../models/RealEstateReservation');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();

async function fixture(label) {
  const propertyId = id(); const transactionId = id(); const clientId = id(); const agentId = id(); const reservationId = id();
  await Property.collection.insertOne({ _id: propertyId, title: `Bien ${label}`, status: 'vente', availability: 'Réservé', isPublished: true, hasSpecialCommission: false, reservationLock: { reservation: reservationId } });
  await RealEstateReservation.collection.insertOne({ _id: reservationId, property: propertyId, client: clientId, application: id(), type: 'sale', status: 'active', expiresAt: new Date(Date.now() + 60000), idempotencyKey: `fixture:${label}`, transaction: transactionId, history: [], createdAt: new Date(), updatedAt: new Date() });
  await Transaction.collection.insertOne({ _id: transactionId, property: propertyId, reservation: reservationId, client: clientId, agent: agentId, finalAmount: 1000000, transactionType: 'vente', commission: { taux: 10, total: 100000, ownerPayout: 0, agencyNet: 100000 }, status: 'Paiement en attente', paymentStatus: 'confirmé', paiements: [], createdAt: new Date(), updatedAt: new Date() });
  return { propertyId, transactionId, agentId };
}

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([Transaction.syncIndexes(), Document.syncIndexes(), RealEstateReservation.syncIndexes()]);
});
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('dix finalisations simultanées créent une seule facture et un seul état final', async () => {
  const f = await fixture('concurrence');
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => finalizeRealEstateTransaction({ transactionId: f.transactionId, actorId: f.agentId, transactionMode: 'transactional' })));
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(0);
  expect(await Document.countDocuments({ businessOperationKey: `real-estate:transaction:${f.transactionId}:finalize` })).toBe(1);
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'real_estate.transaction.finalized', entityId: f.transactionId })).toBe(1);
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ status: 'Réussie', paymentStatus: 'confirmé', finalization: { status: 'completed' } });
  expect(await Property.findById(f.propertyId)).toMatchObject({ availability: 'Vendu', isPublished: false });
});

test('le fallback compense une interruption puis reprend avec la même clé', async () => {
  const f = await fixture('fallback');
  const faultInjector = async (point) => { if (point === 'finalization.after_property') throw new Error('CRASH_AFTER_PROPERTY'); };
  await expect(finalizeRealEstateTransaction({ transactionId: f.transactionId, actorId: f.agentId, transactionMode: 'fallback', faultInjector })).rejects.toThrow('CRASH_AFTER_PROPERTY');
  expect(await Document.countDocuments()).toBe(0);
  expect(await Property.findById(f.propertyId)).toMatchObject({ availability: 'Réservé', isPublished: true });
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ status: 'Paiement en attente', finalization: { status: 'failed' } });
  const retry = await finalizeRealEstateTransaction({ transactionId: f.transactionId, actorId: f.agentId, transactionMode: 'fallback' });
  expect(retry.idempotent).toBe(false);
  expect(await Document.countDocuments()).toBe(1);
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ status: 'Réussie', finalization: { status: 'completed' } });
});

test('un timeout après commit se rejoue sans contrepasser ni dupliquer', async () => {
  const f = await fixture('timeout');
  const faultInjector = async (point) => { if (point === 'finalization.after_ledger') throw new Error('NETWORK_TIMEOUT_AFTER_COMMIT'); };
  await expect(finalizeRealEstateTransaction({ transactionId: f.transactionId, actorId: f.agentId, transactionMode: 'fallback', faultInjector })).rejects.toThrow('NETWORK_TIMEOUT_AFTER_COMMIT');
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ status: 'Réussie', finalization: { status: 'completed' } });
  expect(await Document.countDocuments()).toBe(1);
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'real_estate.transaction.finalized' })).toBe(1);
  const replay = await finalizeRealEstateTransaction({ transactionId: f.transactionId, actorId: f.agentId, transactionMode: 'fallback' });
  expect(replay.idempotent).toBe(true);
  expect(await Document.countDocuments()).toBe(1);
  expect(await FinancialLedgerEntry.countDocuments({ eventType: 'real_estate.transaction.finalized' })).toBe(1);
});

test('dix créations du même paiement manuel produisent un paiement et deux écritures', async () => {
  const establishmentId = id(); const actorId = id(); const businessOperationKey = 'manual-payment-concurrent';
  const data = { establishmentId, amountMinor: 75000, currency: 'XAF', method: 'cash', confirmed: true };
  const results = await Promise.all(Array.from({ length: 10 }, () => createManualPayment({ data, actor: { id: actorId }, businessOperationKey, transactionMode: 'transactional' })));
  expect(new Set(results.map((payment) => String(payment._id))).size).toBe(1);
  expect(await FinancialPayment.countDocuments({ businessOperationKey })).toBe(1);
  expect(await FinancialLedgerEntry.countDocuments({ businessOperationKey: { $in: [`${businessOperationKey}:created`, `${businessOperationKey}:confirmed`] } })).toBe(2);
  await expect(createManualPayment({ data: { ...data, amountMinor: 76000 }, actor: { id: actorId }, businessOperationKey, transactionMode: 'transactional' })).rejects.toMatchObject({ code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
});
