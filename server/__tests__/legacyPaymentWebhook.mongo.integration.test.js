jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../services/actionLogService', () => ({ logAction: jest.fn(), buildAuteur: jest.fn() }));

const crypto = require('crypto');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Transaction = require('../models/Transaction');
require('../models/Property');
const PaiementTransaction = require('../models/PaiementTransaction');
const FinancialProviderEvent = require('../models/FinancialProviderEvent');
const controller = require('../controllers/paiementTransactionController');

jest.setTimeout(120000);
const id = () => new mongoose.Types.ObjectId();
const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};
const signedRequest = (body) => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', process.env.YABETOO_WEBHOOK_SECRET).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  return { body, rawBody, headers: { 'x-yabetoo-webhook-timestamp': timestamp, 'x-yabetoo-webhook-signature': `v1=${signature}` } };
};

beforeAll(async () => {
  process.env.YABETOO_WEBHOOK_SECRET = 'financial-webhook-test-secret';
  await startFinancialMongo();
  await FinancialProviderEvent.syncIndexes();
});
afterEach(clearFinancialMongo);
afterAll(async () => { delete process.env.YABETOO_WEBHOOK_SECRET; await stopFinancialMongo(); });

async function fixture() {
  const transactionId = id(); const paymentId = id(); const intentId = `intent-${id()}`;
  await Transaction.collection.insertOne({ _id: transactionId, property: id(), client: id(), agent: id(), finalAmount: 50000, transactionType: 'vente', status: 'Paiement en attente', paymentStatus: 'en_attente', paiements: [paymentId] });
  await PaiementTransaction.collection.insertOne({ _id: paymentId, transaction: transactionId, initiéPar: id(), montant: 50000, methode: 'yabetoo_momo', statut: 'En attente', yabetooIntentId: intentId });
  return { transactionId, paymentId, intentId };
}

test('une double livraison est traitée une seule fois et auditée', async () => {
  const f = await fixture();
  const body = { id: 'evt-success-1', type: 'payment_intent.succeeded', data: { id: f.intentId } };
  const first = response(); const duplicate = response();
  await controller.webhookYabetoo(signedRequest(body), first);
  await controller.webhookYabetoo(signedRequest(body), duplicate);
  expect(first.statusCode).toBe(200); expect(duplicate.body).toMatchObject({ received: true, duplicate: true });
  expect(await FinancialProviderEvent.countDocuments({ provider: 'yabetoo', providerEventId: body.id })).toBe(1);
  expect(await FinancialProviderEvent.findOne({ providerEventId: body.id })).toMatchObject({ status: 'processed', attemptCount: 1, providerTransactionId: f.intentId });
  expect(await PaiementTransaction.findById(f.paymentId)).toMatchObject({ statut: 'Payé' });
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ paymentStatus: 'confirmé' });
});

test('un événement échoué reçu après le succès ne rétrograde aucun état', async () => {
  const f = await fixture();
  await controller.webhookYabetoo(signedRequest({ id: 'evt-success-2', type: 'payment_intent.succeeded', data: { id: f.intentId } }), response());
  const lateFailure = response();
  await controller.webhookYabetoo(signedRequest({ id: 'evt-failed-late', type: 'payment_intent.failed', data: { id: f.intentId } }), lateFailure);
  expect(lateFailure.statusCode).toBe(200);
  expect(await PaiementTransaction.findById(f.paymentId)).toMatchObject({ statut: 'Payé' });
  expect(await Transaction.findById(f.transactionId)).toMatchObject({ paymentStatus: 'confirmé' });
  expect(await FinancialProviderEvent.countDocuments({ status: 'processed' })).toBe(2);
});
