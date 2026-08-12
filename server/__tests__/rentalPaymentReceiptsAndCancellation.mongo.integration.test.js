// GL-DEBT-1 — Phases 5-9 : historique granulaire des encaissements
// (RentalPaymentReceipt), plusieurs versements sur une même échéance,
// idempotence par clé, annulation contrôlée avec recalcul de l'échéance et
// invalidation de la quittance devenue invalide.

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
const gestionDocumentController = require('../controllers/gestionDocumentController');
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
  return User.create({ name: 'Utilisateur Test', email: `receipt${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

// autoIndex:false côté connexion de test (voir financialMongoEnvironment.js)
// — l'index unique partiel d'idempotence doit être construit explicitement.
beforeAll(async () => { await startFinancialMongo(); await RentalPaymentReceipt.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixtureEcheance(overrides = {}) {
  const admin = await makeUser({ role: 'Admin' });
  const gestionnaire = await makeUser({ role: 'GestionnaireImmobilier' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Test GL-DEBT-1', montantLoyer: 150000 });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 6, annee: 2027, montant: 150000, montantTotal: 150000, statut: 'impayé', ...overrides });
  return { admin, gestionnaire, contrat, paiement, adminToken: signToken(admin._id), gestionnaireToken: signToken(gestionnaire._id) };
}

test('plusieurs encaissements successifs sur la même échéance créent un reçu chacun', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 60000, datePaiement: '2027-06-05', modePaiement: 'espèces' });
  const second = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-20', modePaiement: 'virement', reference: 'VIR-1' });

  expect(second.status).toBe(200);
  expect(second.body.data.receipt.montant).toBe(90000); // 150000 - 60000 (part incrémentale, pas le cumul)

  const receipts = await request(app).get(`/api/paiements/${paiement._id}/receipts`).set('Authorization', `Bearer ${adminToken}`);
  expect(receipts.body.results).toBe(2);
  expect(receipts.body.data.receipts.reduce((s, r) => s + r.montant, 0)).toBe(150000);
});

test('idempotence par clé : rejouer la même requête avec la même clé ne crée pas un second reçu', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  const payload = { montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'mobile', idempotencyKey: 'test-key-abc' };
  const first = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`).send(payload);
  expect(first.status).toBe(200);

  // Rejeu direct au niveau modèle avec la même clé — doit être bloqué par
  // l'index unique partiel {paiement, idempotencyKey}.
  await expect(RentalPaymentReceipt.create({
    paiement: paiement._id, contrat: paiement.contrat, montant: 150000, datePaiement: new Date(),
    modePaiement: 'mobile', auteur: (await User.findOne({ role: 'Admin' }))._id, idempotencyKey: 'test-key-abc',
  })).rejects.toThrow(/E11000|duplicate key/);
});

test('annulation d’un encaissement : recalcule l’échéance et repasse en impayé/partiel', async () => {
  const { paiement, adminToken, gestionnaireToken } = await fixtureEcheance();
  const record = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  expect(record.body.data.paiement.statut).toBe('payé');
  const receiptId = record.body.data.receipt._id;

  const cancelled = await request(app).post(`/api/paiements/${paiement._id}/receipts/${receiptId}/cancel`).set('Authorization', `Bearer ${gestionnaireToken}`)
    .send({ reason: 'Chèque rejeté par la banque' });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.data.paiement.statut).toBe('impayé');
  expect(cancelled.body.data.paiement.montantRecu).toBe(0);

  const inDb = await Paiement.findById(paiement._id);
  expect(inDb.statut).toBe('impayé');
  const receiptInDb = await RentalPaymentReceipt.findById(receiptId);
  expect(receiptInDb.statut).toBe('cancelled');
  expect(receiptInDb.cancelledReason).toBe('Chèque rejeté par la banque');
});

test('annulation d’un seul encaissement parmi plusieurs repasse l’échéance en partiel, pas en impayé', async () => {
  const { paiement, adminToken, gestionnaireToken } = await fixtureEcheance();
  const first = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 60000, datePaiement: '2027-06-05', modePaiement: 'espèces' });
  await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-20', modePaiement: 'virement' });

  const firstReceiptId = first.body.data.receipt._id;
  const cancelled = await request(app).post(`/api/paiements/${paiement._id}/receipts/${firstReceiptId}/cancel`).set('Authorization', `Bearer ${gestionnaireToken}`)
    .send({ reason: 'Doublon de saisie' });
  expect(cancelled.body.data.paiement.statut).toBe('partiel');
  expect(cancelled.body.data.paiement.montantRecu).toBe(90000);
});

test('un motif d’annulation est obligatoire', async () => {
  const { paiement, adminToken, gestionnaireToken } = await fixtureEcheance();
  const record = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  const res = await request(app).post(`/api/paiements/${paiement._id}/receipts/${record.body.data.receipt._id}/cancel`).set('Authorization', `Bearer ${gestionnaireToken}`).send({});
  expect(res.status).toBe(422);
});

test('IDOR/permissions : Secretaire (ROLES_PAIEMENTS mais pas CANCEL_ROLES) ne peut pas annuler', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  const secretaire = await makeUser({ role: 'Secretaire' });
  const record = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  const res = await request(app).post(`/api/paiements/${paiement._id}/receipts/${record.body.data.receipt._id}/cancel`).set('Authorization', `Bearer ${signToken(secretaire._id)}`)
    .send({ reason: 'Test non autorisé' });
  expect(res.status).toBe(403);
  expect((await Paiement.findById(paiement._id)).statut).toBe('payé');
});

test('double annulation du même reçu : la seconde échoue proprement (pas de double-recalcul)', async () => {
  const { paiement, adminToken, gestionnaireToken } = await fixtureEcheance();
  const record = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  const receiptId = record.body.data.receipt._id;

  const [a, b] = await Promise.all([
    request(app).post(`/api/paiements/${paiement._id}/receipts/${receiptId}/cancel`).set('Authorization', `Bearer ${gestionnaireToken}`).send({ reason: 'Annulation concurrente A' }),
    request(app).post(`/api/paiements/${paiement._id}/receipts/${receiptId}/cancel`).set('Authorization', `Bearer ${gestionnaireToken}`).send({ reason: 'Annulation concurrente B' }),
  ]);
  const statuses = [a.status, b.status].sort((x, y) => x - y);
  expect(statuses).toEqual([200, 409]);
  expect((await Paiement.findById(paiement._id)).statut).toBe('impayé');
});

test('quittance générée puis encaissement annulé : la quittance est invalidée, jamais supprimée', async () => {
  const { paiement, contrat, adminToken } = await fixtureEcheance();
  const record = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  const admin = await User.findOne({ role: 'Admin' });

  // gestionDocumentController.generateQuittance exige req.user (résolu par
  // auth.protect sur la vraie route, déjà testé ailleurs) — appelé
  // directement ici pour rester focalisé sur l'invalidation, pas l'auth.
  const fakeReq = { params: { paiementId: String(paiement._id) }, user: { id: admin._id, role: 'Admin' } };
  const fakeRes = { json: () => {}, status: () => fakeRes };
  await gestionDocumentController.generateQuittance(fakeReq, fakeRes);

  const contratApresQuittance = await Contrat.findById(contrat._id);
  const quittance = contratApresQuittance.documents.find((d) => d.type === 'quittance');
  expect(quittance).toBeDefined();
  expect(quittance.invalidated).toBe(false);

  await request(app).post(`/api/paiements/${paiement._id}/receipts/${record.body.data.receipt._id}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Paiement finalement refusé' });

  const contratApresAnnulation = await Contrat.findById(contrat._id);
  const quittanceInvalidee = contratApresAnnulation.documents.find((d) => d.type === 'quittance');
  expect(quittanceInvalidee.invalidated).toBe(true);
  expect(quittanceInvalidee.invalidatedReason).toContain('Paiement finalement refusé');
  // Le document original n'est ni supprimé ni modifié dans son contenu (url/nom intacts).
  expect(quittanceInvalidee.url).toBe(quittance.url);
});

test('ancien Paiement sans reçu associé reste lisible (compatibilité)', async () => {
  const { paiement, adminToken } = await fixtureEcheance({ statut: 'payé', montantRecu: 150000 });
  const res = await request(app).get(`/api/paiements/${paiement._id}/receipts`).set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.results).toBe(0);
  expect(res.body.data.receipts).toEqual([]);
});
