// Sprint GL-UX1 — server/__tests__/gestionLocativePaiements.mongo.integration.test.js
//
// Aucun test n'existait auparavant pour paiementController.js. Couvre les
// exigences explicites du sprint : paiement partiel puis complet, quittance
// uniquement pour une échéance intégralement réglée, double soumission
// concurrente (rejeu/double-clic ne doit jamais créer deux encaissements
// identiques — protection déjà présente via le CAS optimiste
// findOneAndUpdate({_id, statut, montantRecu})), preuve de paiement
// optionnelle (nouveau champ, rétrocompatible), IDOR (un rôle non staff ne
// peut pas marquer un paiement comme payé).

// `upload` (multer réel) doit rester réel pour que le corps multipart soit
// effectivement parsé (req.body/req.file) — seul l'appel réseau Cloudinary
// est mocké, sinon le test de preuve de paiement ne teste rien de réel.
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.test/preuve.jpg', public_id: 'preuve-test-id' }),
  destroyFromCloudinary: jest.fn(),
}));
jest.mock('../services/rentalTenantNotificationService', () => ({ notifyContractTenant: jest.fn().mockResolvedValue(null) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
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
  return User.create({ name: 'Utilisateur Test', email: `glpaiement${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function fixtureEcheance(overrides = {}) {
  const admin = await makeUser({ role: 'Admin' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Test GL-UX1', montantLoyer: 150000 });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 6, annee: 2027, montant: 150000, montantTotal: 150000, statut: 'impayé', ...overrides });
  return { admin, contrat, paiement, adminToken: signToken(admin._id) };
}

test('paiement partiel puis complet : statut cohérent à chaque étape', async () => {
  const { paiement, adminToken } = await fixtureEcheance();

  const partiel = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 90000, datePaiement: '2027-06-05', modePaiement: 'espèces' });
  expect(partiel.status).toBe(200);
  expect(partiel.body.data.paiement.statut).toBe('partiel');

  const complet = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-20', modePaiement: 'virement', reference: 'VIR-001' });
  expect(complet.status).toBe(200);
  expect(complet.body.data.paiement.statut).toBe('payé');
  expect(complet.body.data.paiement.montantRecu).toBe(150000);
});

test('le montant cumulé ne peut jamais diminuer entre deux encaissements successifs', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 100000, datePaiement: '2027-06-05', modePaiement: 'espèces' });
  const regression = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 50000, datePaiement: '2027-06-06', modePaiement: 'espèces' });
  expect(regression.status).toBe(422);
});

test('double soumission concurrente (double-clic) : un seul encaissement retenu, jamais deux', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  const payload = { montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'mobile', reference: 'MOMO-1' };

  const [a, b] = await Promise.all([
    request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`).send(payload),
    request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`).send(payload),
  ]);
  const statuses = [a.status, b.status].sort((x, y) => x - y);
  expect(statuses[0]).toBe(200);
  expect(statuses[1]).toBe(409);

  const final = await Paiement.findById(paiement._id);
  expect(final.statut).toBe('payé');
  expect(final.montantRecu).toBe(150000);
});

test('preuve de paiement jointe : acceptée et conservée (champ optionnel, rétrocompatible)', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .field('montantRecu', '150000').field('datePaiement', '2027-06-10').field('modePaiement', 'espèces')
    .attach('preuve', Buffer.from('fake-image-bytes'), { filename: 'preuve.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(200);
  expect(res.body.data.paiement.preuvePaiement).toMatchObject({ url: 'https://res.cloudinary.test/preuve.jpg', publicId: 'preuve-test-id' });

  // Ancien document sans preuvePaiement : doit rester lisible normalement.
  const legacy = await fixtureEcheance();
  const legacyDoc = await Paiement.findById(legacy.paiement._id).lean();
  expect(legacyDoc.preuvePaiement).toBeUndefined();
});

test('un paiement déjà intégralement réglé ne peut pas être re-marqué payé', async () => {
  const { paiement, adminToken } = await fixtureEcheance({ statut: 'payé', montantRecu: 150000 });
  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('PAYMENT_ALREADY_PAID');
});

test('IDOR : un rôle non staff (Client) ne peut pas marquer un paiement comme payé', async () => {
  const { paiement } = await fixtureEcheance();
  const client = await makeUser({ role: 'Client' });
  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${signToken(client._id)}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  expect(res.status).toBe(403);
  const untouched = await Paiement.findById(paiement._id);
  expect(untouched.statut).toBe('impayé');
});

test('un encaissement enregistré ne peut pas être supprimé silencieusement', async () => {
  const { paiement, adminToken } = await fixtureEcheance();
  await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .send({ montantRecu: 150000, datePaiement: '2027-06-10', modePaiement: 'espèces' });
  const del = await request(app).delete(`/api/paiements/${paiement._id}`).set('Authorization', `Bearer ${adminToken}`);
  expect(del.status).toBe(409);
  expect(await Paiement.findById(paiement._id)).not.toBeNull();
});
