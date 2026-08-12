// GL-DEBT-1.1 — Clôture des allocations locatives : un encaissement peut
// désormais couvrir PLUSIEURS échéances du même contrat en un seul appel
// (POST /api/paiements/encaisser-multiple), tout-ou-rien, idempotent, et
// avec la même concurrence contrôlée (CAS) que marquerPaye. L'annulation
// reste à la granularité de l'échéance (RentalPaymentReceipt.cancelReceipt,
// déjà couvert par rentalPaymentReceiptsAndCancellation) — ce fichier
// vérifie spécifiquement que la réversion d'UNE ligne d'un encaissement
// multi-échéances n'affecte pas les autres.

jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.test/preuve.jpg', public_id: 'preuve-test-id', resource_type: 'image', version: 1, format: 'jpg', bytes: 16 }),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));
jest.mock('../services/rentalTenantNotificationService', () => ({ notifyContractTenant: jest.fn().mockResolvedValue(null) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
const paiementRoutes = require('../routes/paiementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/paiements', paiementRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `multi${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(async () => { await startFinancialMongo(); await RentalPaymentReceipt.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixtureDeuxEcheances() {
  const admin = await makeUser({ role: 'Admin' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Test GL-DEBT-1.1', montantLoyer: 100000 });
  const paiementJuin = await Paiement.create({ contrat: contrat._id, mois: 6, annee: 2027, montant: 100000, montantTotal: 100000, statut: 'impayé' });
  const paiementJuillet = await Paiement.create({ contrat: contrat._id, mois: 7, annee: 2027, montant: 100000, montantTotal: 100000, statut: 'impayé' });
  return { admin, contrat, paiementJuin, paiementJuillet, adminToken: signToken(admin._id) };
}

test('un encaissement unique couvrant deux échéances crée un reçu par échéance et solde les deux', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();

  const res = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({
    contrat: contrat._id,
    allocations: [
      { paiementId: paiementJuin._id, montant: 100000 },
      { paiementId: paiementJuillet._id, montant: 100000 },
    ],
    datePaiement: '2027-07-15', modePaiement: 'virement', reference: 'VIR-DOUBLE',
  });

  expect(res.status).toBe(200);
  expect(res.body.data.receipts).toHaveLength(2);
  const encaissementIds = new Set(res.body.data.receipts.map((r) => r.encaissementId));
  expect(encaissementIds.size).toBe(1); // même regroupement pour les deux lignes

  const juin = await Paiement.findById(paiementJuin._id);
  const juillet = await Paiement.findById(paiementJuillet._id);
  expect(juin.statut).toBe('payé');
  expect(juillet.statut).toBe('payé');
});

test('encaissement partiel réparti sur deux échéances : chacune passe à "partiel" avec le bon reste dû', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();

  const res = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({
    contrat: contrat._id,
    allocations: [
      { paiementId: paiementJuin._id, montant: 40000 },
      { paiementId: paiementJuillet._id, montant: 30000 },
    ],
    datePaiement: '2027-07-15', modePaiement: 'espèces',
  });

  expect(res.status).toBe(200);
  const juin = await Paiement.findById(paiementJuin._id);
  const juillet = await Paiement.findById(paiementJuillet._id);
  expect(juin.statut).toBe('partiel');
  expect(juin.montantRecu).toBe(40000);
  expect(juillet.statut).toBe('partiel');
  expect(juillet.montantRecu).toBe(30000);
});

test('tout-ou-rien : une ligne invalide (montant > solde dû) annule l\'encaissement entier, aucune échéance modifiée', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();

  const res = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({
    contrat: contrat._id,
    allocations: [
      { paiementId: paiementJuin._id, montant: 100000 },
      { paiementId: paiementJuillet._id, montant: 999999 }, // dépasse le solde dû
    ],
    datePaiement: '2027-07-15', modePaiement: 'espèces',
  });

  expect(res.status).toBe(422);
  const juin = await Paiement.findById(paiementJuin._id);
  expect(juin.statut).toBe('impayé'); // pas touché malgré une allocation valide
  expect(await RentalPaymentReceipt.countDocuments({ contrat: contrat._id })).toBe(0);
});

test('idempotence : rejouer le même encaissement multi-échéances avec la même clé ne double pas les montants', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();
  const payload = {
    contrat: contrat._id,
    allocations: [
      { paiementId: paiementJuin._id, montant: 50000 },
      { paiementId: paiementJuillet._id, montant: 50000 },
    ],
    datePaiement: '2027-07-15', modePaiement: 'mobile', idempotencyKey: 'multi-key-1',
  };

  const first = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send(payload);
  const replay = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send(payload);

  expect(first.status).toBe(200);
  expect(replay.status).toBe(200);
  expect(replay.body.idempotentReplay).toBe(true);
  expect(await RentalPaymentReceipt.countDocuments({ contrat: contrat._id })).toBe(2);
  const juin = await Paiement.findById(paiementJuin._id);
  expect(juin.montantRecu).toBe(50000); // pas 100000
});

test('concurrence : deux encaissements multi-échéances simultanés visant la même échéance — un seul réussit, l\'autre 409', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();

  const payloadA = { contrat: contrat._id, allocations: [{ paiementId: paiementJuin._id, montant: 100000 }], datePaiement: '2027-07-01', modePaiement: 'espèces' };
  const payloadB = { contrat: contrat._id, allocations: [{ paiementId: paiementJuin._id, montant: 100000 }], datePaiement: '2027-07-02', modePaiement: 'virement' };

  const [resA, resB] = await Promise.all([
    request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send(payloadA),
    request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send(payloadB),
  ]);

  const statuses = [resA.status, resB.status].sort();
  expect(statuses).toEqual([200, 409]);
  const juin = await Paiement.findById(paiementJuin._id);
  expect(juin.statut).toBe('payé');
  expect(juin.montantRecu).toBe(100000); // une seule fois, pas 200000
  expect(await RentalPaymentReceipt.countDocuments({ paiement: paiementJuin._id, statut: 'confirmed' })).toBe(1);
  void paiementJuillet;
});

test('annulation d\'une ligne d\'un encaissement multi-échéances ne réverse que cette échéance', async () => {
  const { contrat, paiementJuin, paiementJuillet, adminToken } = await fixtureDeuxEcheances();

  const res = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({
    contrat: contrat._id,
    allocations: [
      { paiementId: paiementJuin._id, montant: 100000 },
      { paiementId: paiementJuillet._id, montant: 100000 },
    ],
    datePaiement: '2027-07-15', modePaiement: 'espèces',
  });
  const receiptJuin = res.body.data.receipts.find((r) => r.paiement === String(paiementJuin._id));

  const cancelRes = await request(app)
    .post(`/api/paiements/${paiementJuin._id}/receipts/${receiptJuin._id}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Erreur de saisie sur juin' });

  expect(cancelRes.status).toBe(200);
  const juin = await Paiement.findById(paiementJuin._id);
  const juillet = await Paiement.findById(paiementJuillet._id);
  expect(juin.statut).toBe('impayé'); // réversé
  expect(juin.montantRecu).toBe(0);
  expect(juillet.statut).toBe('payé'); // non affecté par l'annulation de l'autre ligne
  expect(juillet.montantRecu).toBe(100000);
});

test('validation : allocations vides, montant négatif, ou échéance dupliquée sont rejetées (422)', async () => {
  const { contrat, paiementJuin, adminToken } = await fixtureDeuxEcheances();

  const vide = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({ contrat: contrat._id, allocations: [] });
  expect(vide.status).toBe(422);

  const negatif = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({ contrat: contrat._id, allocations: [{ paiementId: paiementJuin._id, montant: -5 }] });
  expect(negatif.status).toBe(422);

  const doublon = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${adminToken}`).send({
    contrat: contrat._id,
    allocations: [{ paiementId: paiementJuin._id, montant: 10000 }, { paiementId: paiementJuin._id, montant: 20000 }],
  });
  expect(doublon.status).toBe(422);
});

test('rôle non autorisé (Client, hors ROLES_PAIEMENTS) : 403 sur encaisser-multiple', async () => {
  const client = await makeUser({ role: 'Client' });
  const { contrat, paiementJuin } = await fixtureDeuxEcheances();

  const res = await request(app).post('/api/paiements/encaisser-multiple').set('Authorization', `Bearer ${signToken(client._id)}`).send({
    contrat: contrat._id, allocations: [{ paiementId: paiementJuin._id, montant: 100000 }],
  });
  expect(res.status).toBe(403);
});
