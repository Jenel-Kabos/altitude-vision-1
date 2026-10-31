// ALTIMMO-PAY-SAFETY-04A — suspension de l'initiation des paiements de visite
// (Yabetoo simulé, données synthétiques, MongoMemory). Vérifie que seule
// l'initiation est bloquée et que les opérations engagées restent traitées.
jest.mock('../services/yabetooService', () => ({
  createIntent: jest.fn(),
  confirmIntent: jest.fn(),
  getIntent: jest.fn(),
  extractIntent: (payload) => ({ id: payload?.id, clientSecret: payload?.clientSecret, status: payload?.status }),
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { provisionPrivilegedOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const yabetooService = require('../services/yabetooService');
const User = require('../models/User');
const Property = require('../models/Property');
const Visite = require('../models/Visite');
const PaiementTransaction = require('../models/PaiementTransaction');
const paiementTransactionController = require('../controllers/paiementTransactionController');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use('/api/visites', require('../routes/visiteRoutes'));
// Gestionnaire réel du webhook Yabetoo (monté seul : `transactionRoutes` porte d'autres dépendances).
app.post('/api/transactions/paiements/webhook', paiementTransactionController.webhookYabetoo);
app.use(errorHandler);

const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
const FINANCIAL_COLLECTIONS = ['paiementtransactions', 'financialpayments', 'financialledgerentries', 'transactions', 'paiements', 'financialproviderevents'];
const countFinancial = async () => Object.fromEntries(await Promise.all(
  FINANCIAL_COLLECTIONS.map(async (name) => [name, await mongoose.connection.db.collection(name).countDocuments()]),
));
const nextBusinessDayAt = (hour) => {
  const d = new Date(Date.now() + 2 * 86400000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(`${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00+01:00`);
};

let owner; let client; let stranger; let admin; let property; let pendingVisit; let engagedVisit;
const previousFlag = process.env.VISIT_PAYMENT_INITIATION_ENABLED;

beforeAll(async () => {
  await startFinancialMongo();
  delete process.env.VISIT_PAYMENT_INITIATION_ENABLED;
  const mk = (name, role) => User.create({ name, email: `${name.toLowerCase().replace(/\s/g, '-')}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
  owner = await mk('PS04A Owner', 'Proprietaire');
  client = await mk('PS04A Client', 'Client');
  stranger = await mk('PS04A Stranger', 'Client');
  // Staff de supervision : opérateur plateforme (Vue plateforme), comme en production.
  const fixture = await createTenantFixture({ label: 'PS04A Tenant' });
  const { user: tenantAdmin } = await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Admin' }, businessRole: 'Admin' });
  admin = await mk('PS04A Admin', 'Admin');
  await provisionPrivilegedOperator({ userId: admin._id, actor: tenantAdmin, reason: 'PS04A payment supervision', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  property = await Property.create({
    owner: owner._id, title: 'PS04A Appartement', description: 'Appartement synthétique pour la suspension des paiements de visite.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 250000, fraisVisite: 5000,
    address: { street: 'Rue PS04A', city: 'Brazzaville', arrondissement: 'Moungali' }, latitude: -4.26, longitude: 15.28,
    images: ['https://placehold.co/1200x800/png?text=PS04A'], surface: 80, availability: 'Disponible',
    statusAdmin: 'Validée', isPublished: true, publicationLifecycleState: 'published',
  });
  pendingVisit = await Visite.create({ property: property._id, owner: owner._id, client: client._id, status: 'confirmee', statut: 'Confirmée', paiementStatus: 'en_attente' });
  // Paiement déjà engagé avant la suspension (intention Yabetoo existante).
  engagedVisit = await Visite.create({ property: property._id, owner: owner._id, client: client._id, status: 'confirmee', statut: 'Confirmée', paiementStatus: 'en_attente', paiementRef: 'intent_engaged_1', yabetooState: 'pending', yabetooReconciliationRequired: true });
});

afterAll(async () => {
  if (previousFlag === undefined) delete process.env.VISIT_PAYMENT_INITIATION_ENABLED;
  else process.env.VISIT_PAYMENT_INITIATION_ENABLED = previousFlag;
  await stopFinancialMongo();
});

afterEach(() => jest.clearAllMocks());

test('suspendu par défaut : nouvelle initiation refusée (503 explicite), aucun appel Yabetoo, aucune écriture', async () => {
  const before = await countFinancial();
  const visitBefore = await Visite.findById(pendingVisit._id).select('+yabetooBusinessKey').lean();
  const res = await request(app).post(`/api/visites/${pendingVisit._id}/paiement/initier`).set(bearer(client)).send({ phone: '060000000', operator: 'MTN' });
  expect(res.status).toBe(503);
  expect(res.body).toMatchObject({ status: 'fail', code: 'VISIT_PAYMENT_SUSPENDED' });
  expect(res.body.message).toMatch(/temporairement indisponible/);
  expect(yabetooService.createIntent).not.toHaveBeenCalled();
  expect(yabetooService.confirmIntent).not.toHaveBeenCalled();
  expect(await countFinancial()).toEqual(before);
  const visitAfter = await Visite.findById(pendingVisit._id).select('+yabetooBusinessKey').lean();
  expect(visitAfter).toMatchObject({ paiementStatus: visitBefore.paiementStatus, paiementRef: visitBefore.paiementRef });
  expect(visitAfter.yabetooBusinessKey ?? null).toBe(visitBefore.yabetooBusinessKey ?? null);
  expect(visitAfter.yabetooState ?? null).toBe(visitBefore.yabetooState ?? null);
});

test('toute valeur autre que "true" laisse le parcours suspendu', async () => {
  for (const value of ['', 'false', '1', 'TRUE', 'yes']) {
    process.env.VISIT_PAYMENT_INITIATION_ENABLED = value;
    const res = await request(app).post(`/api/visites/${pendingVisit._id}/paiement/initier`).set(bearer(client)).send({ phone: '060000000', operator: 'MTN' });
    expect(res.status).toBe(503);
  }
  delete process.env.VISIT_PAYMENT_INITIATION_ENABLED;
  expect(yabetooService.createIntent).not.toHaveBeenCalled();
});

test('authentification toujours exigée : sans jeton 401, sans appel Yabetoo', async () => {
  const res = await request(app).post(`/api/visites/${pendingVisit._id}/paiement/initier`).send({ phone: '060000000', operator: 'MTN' });
  expect(res.status).toBe(401);
  expect(yabetooService.createIntent).not.toHaveBeenCalled();
});

test('la liste client reste consultable et annonce le paiement indisponible', async () => {
  const res = await request(app).get('/api/visites/my-payments').set(bearer(client));
  expect(res.status).toBe(200);
  expect(res.body.data.paymentInitiationAvailable).toBe(false);
  expect(res.body.data.visites.map((v) => String(v._id))).toEqual(expect.arrayContaining([String(pendingVisit._id), String(engagedVisit._id)]));
});

test('paiement déjà engagé : la vérification et le rapprochement restent possibles', async () => {
  yabetooService.getIntent.mockResolvedValue({ id: 'intent_engaged_1', status: 'succeeded' });
  const denied = await request(app).get('/api/visites/paiement/verifier/intent_engaged_1').set(bearer(stranger));
  expect(denied.status).toBe(403);
  const res = await request(app).get('/api/visites/paiement/verifier/intent_engaged_1').set(bearer(client));
  expect(res.status).toBe(200);
  expect(res.body.data.statut).toBe('payé');
  expect(yabetooService.getIntent).toHaveBeenCalledWith('intent_engaged_1');
  const stored = await Visite.findById(engagedVisit._id).lean();
  expect(stored).toMatchObject({ paiementStatus: 'payé', paiementRef: 'intent_engaged_1', yabetooState: 'succeeded', yabetooReconciliationRequired: false });
});

test('règlement manuel par le staff (rapprochement hors ligne) toujours possible', async () => {
  const res = await request(app).patch(`/api/visites/${pendingVisit._id}/paiement`).set(bearer(admin)).send({ paiementStatus: 'exempté' });
  expect(res.status).toBe(200);
  expect((await Visite.findById(pendingVisit._id).lean()).paiementStatus).toBe('exempté');
  const forbidden = await request(app).patch(`/api/visites/${pendingVisit._id}/paiement`).set(bearer(client)).send({ paiementStatus: 'payé' });
  expect(forbidden.status).toBe(403);
});

test('webhook Yabetoo légitime d\'un paiement de transaction antérieur toujours traité', async () => {
  process.env.YABETOO_WEBHOOK_SECRET = 'ps04a-webhook-test-secret';
  const txId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('transactions').insertOne({ _id: txId, client: client._id, property: property._id, transactionType: 'location', status: 'En cours', paymentStatus: 'en_attente' });
  await mongoose.connection.db.collection('paiementtransactions').insertOne({ transaction: txId, initiéPar: client._id, montant: 250000, methode: 'yabetoo_momo', statut: 'En attente', yabetooIntentId: 'intent_tx_1', yabetooState: 'pending', yabetooReconciliationRequired: true });
  const body = JSON.stringify({ id: 'evt_ps04a_1', type: 'payment_intent.succeeded', data: { id: 'intent_tx_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', process.env.YABETOO_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  const res = await request(app).post('/api/transactions/paiements/webhook')
    .set('Content-Type', 'application/json').set('x-yabetoo-webhook-timestamp', timestamp).set('x-yabetoo-webhook-signature', `v1=${signature}`)
    .send(body);
  expect(res.status).toBe(200);
  expect(res.body.received).toBe(true);
  const paiement = await PaiementTransaction.findOne({ yabetooIntentId: 'intent_tx_1' }).lean();
  expect(paiement).toMatchObject({ statut: 'Payé', yabetooState: 'succeeded', yabetooReconciliationRequired: false });
  const replay = await request(app).post('/api/transactions/paiements/webhook')
    .set('Content-Type', 'application/json').set('x-yabetoo-webhook-timestamp', timestamp).set('x-yabetoo-webhook-signature', `v1=${signature}`)
    .send(body);
  expect(replay.status).toBe(200);
  expect(replay.body.duplicate).toBe(true);
  expect(yabetooService.createIntent).not.toHaveBeenCalled();
});

test('les demandes de visite restent utilisables', async () => {
  const res = await request(app).post('/api/visites').set(bearer(stranger)).send({ propertyId: property._id, requestedDate: nextBusinessDayAt(10).toISOString() });
  expect(res.status).toBe(201);
  expect(res.body.data.visite.paiementStatus ?? 'non_requis').toBe('non_requis');
});

test('réactivation explicite (VISIT_PAYMENT_INITIATION_ENABLED=true) : le flux existant est inchangé', async () => {
  process.env.VISIT_PAYMENT_INITIATION_ENABLED = 'true';
  try {
    const visit = await Visite.create({ property: property._id, owner: owner._id, client: client._id, status: 'confirmee', statut: 'Confirmée', paiementStatus: 'en_attente' });
    yabetooService.createIntent.mockResolvedValue({ id: 'intent_new_1', clientSecret: 'cs_synthetic' });
    yabetooService.confirmIntent.mockResolvedValue({ id: 'intent_new_1', status: 'processing' });
    const res = await request(app).post(`/api/visites/${visit._id}/paiement/initier`).set(bearer(client)).send({ phone: '060000000', operator: 'MTN' });
    expect(res.status).toBe(200);
    // Barème existant inchangé : 80 % du prix (location) + fraisVisite.
    expect(yabetooService.createIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: Math.round(250000 * 0.8) + 5000 }));
    expect((await request(app).get('/api/visites/my-payments').set(bearer(client))).body.data.paymentInitiationAvailable).toBe(true);
  } finally {
    delete process.env.VISIT_PAYMENT_INITIATION_ENABLED;
  }
});
