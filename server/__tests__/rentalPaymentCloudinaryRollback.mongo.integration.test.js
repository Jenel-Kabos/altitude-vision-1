// GL-DEBT-1 — Phase 10 : preuve de paiement, upload Cloudinary + écriture DB.
// Si l'écriture finale échoue après un upload réussi, le fichier Cloudinary
// doit être supprimé (rollback) — jamais laissé orphelin, et jamais masquer
// l'erreur métier d'origine si le rollback lui-même échoue.

const mockUploadToCloudinary = jest.fn();
const mockDestroyFromCloudinary = jest.fn();
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  cloudinary: { ...jest.requireActual('../config/cloudinary').cloudinary, uploader: { ...jest.requireActual('../config/cloudinary').cloudinary.uploader, destroy: (...args) => mockDestroyFromCloudinary(...args) } },
  uploadToCloudinary: (...args) => mockUploadToCloudinary(...args),
  destroyFromCloudinary: (...args) => mockDestroyFromCloudinary(...args),
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

// Simule une CAS perdue (findOneAndUpdate → null) tout en restant compatible
// avec `withSession(query)` du contrôleur, qui appelle `.session(session)`
// sur le retour de `Paiement.findOneAndUpdate(...)` avant de l'attendre —
// un simple `mockResolvedValueOnce(null)` renvoie une Promise nue sans
// méthode `.session`, ce qui casse ce chaînage (`query.session is not a
// function`) plutôt que de simuler la perte de concurrence recherchée.
function lostCasQuery() {
  const p = Promise.resolve(null);
  p.session = () => p;
  return p;
}

beforeAll(startFinancialMongo);
afterEach(async () => {
  await clearFinancialMongo();
  mockUploadToCloudinary.mockReset();
  mockDestroyFromCloudinary.mockReset();
});
afterAll(stopFinancialMongo);

async function fixtureEcheance() {
  const admin = await User.create({ name: 'Admin', email: `rollback${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin' });
  const contrat = await Contrat.create({ type: 'location', statut: 'actif', adresseBien: 'Test Rollback', montantLoyer: 150000 });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 6, annee: 2027, montant: 150000, montantTotal: 150000, statut: 'impayé' });
  return { admin, contrat, paiement, adminToken: signToken(admin._id) };
}

test('upload réussi + écriture DB réussie : le fichier reste, aucun rollback appelé', async () => {
  mockUploadToCloudinary.mockResolvedValue({ secure_url: 'https://cdn.test/ok.jpg', public_id: 'ok-id', resource_type: 'image', version: 1, format: 'jpg', bytes: 3 });
  const { paiement, adminToken } = await fixtureEcheance();
  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .field('montantRecu', '150000').field('datePaiement', '2027-06-10').field('modePaiement', 'espèces')
    .attach('preuve', Buffer.from('img'), { filename: 'preuve.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(200);
  expect(mockDestroyFromCloudinary).not.toHaveBeenCalled();
  const stored = await Paiement.findById(paiement._id).select('+preuvePaiement.asset.publicId +preuvePaiement.asset.deliveryType');
  expect(stored.preuvePaiement.asset).toMatchObject({ publicId: 'ok-id', deliveryType: 'authenticated' });
  expect(stored.preuvePaiement.url).toBeUndefined();
});

// Note méthodologique : les deux tests suivants forçaient initialement le
// chemin "l'écriture finale échoue" via une vraie course (deux requêtes
// HTTP concurrentes). Bisection faite : la combinaison [vraie course +
// rollback Cloudinary qui échoue lui-même] déclenche un artefact de
// nettoyage de session propre à mongodb-memory-server sous charge de
// transactions concurrentes répétées (le test suivant dans le même fichier
// voit alors "MongoExpiredSessionError" au niveau de clearFinancialMongo) —
// jamais une assertion en échec : les 4 tests passent individuellement et
// en sous-combinaisons, uniquement l'enchaînement complet du fichier
// déclenche ce bruit d'infrastructure de test. Le comportement applicatif
// (rollback appelé, erreur métier propagée) est déjà prouvé par le test de
// double-soumission réel dans gestionLocativePaiements...test.js ; ici, un
// spy déterministe sur Paiement.findOneAndUpdate isole strictement le
// comportement de rollback Cloudinary, sans dépendre d'une vraie course.
test('upload réussi + écriture DB échoue (CAS perdue) : rollback Cloudinary appelé, erreur 409 propagée', async () => {
  mockUploadToCloudinary.mockResolvedValue({ secure_url: 'https://cdn.test/rollback-me.jpg', public_id: 'rollback-me-id', resource_type: 'image', version: 1, format: 'jpg', bytes: 3 });
  mockDestroyFromCloudinary.mockResolvedValue();
  const { paiement, adminToken } = await fixtureEcheance();
  const spy = jest.spyOn(Paiement, 'findOneAndUpdate').mockImplementationOnce(lostCasQuery);

  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .field('montantRecu', '150000').field('datePaiement', '2027-06-10').field('modePaiement', 'espèces')
    .attach('preuve', Buffer.from('img'), { filename: 'preuve.jpg', contentType: 'image/jpeg' });

  expect(res.status).toBe(409);
  expect(mockDestroyFromCloudinary).toHaveBeenCalledWith('rollback-me-id', expect.objectContaining({ type: 'authenticated', resource_type: 'image' }));
  expect(mockDestroyFromCloudinary).toHaveBeenCalledTimes(1);
  expect(await RentalPaymentReceipt.countDocuments({ paiement: paiement._id })).toBe(0);
  spy.mockRestore();
});

test('upload réussi + écriture DB échoue + le rollback Cloudinary échoue aussi : l’erreur métier d’origine reste renvoyée', async () => {
  mockUploadToCloudinary.mockResolvedValue({ secure_url: 'https://cdn.test/double-fail.jpg', public_id: 'double-fail-id', resource_type: 'image', version: 1, format: 'jpg', bytes: 3 });
  mockDestroyFromCloudinary.mockRejectedValue(new Error('Cloudinary indisponible'));
  const { paiement, adminToken } = await fixtureEcheance();
  const spy = jest.spyOn(Paiement, 'findOneAndUpdate').mockImplementationOnce(lostCasQuery);

  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .field('montantRecu', '150000').field('datePaiement', '2027-06-10').field('modePaiement', 'espèces')
    .attach('preuve', Buffer.from('img'), { filename: 'preuve.jpg', contentType: 'image/jpeg' });

  // L'échec du rollback ne doit jamais masquer l'erreur métier réelle (409
  // concurrence), ni faire planter la requête (pas de 500 inattendu).
  expect(res.status).toBe(409);
  expect(mockDestroyFromCloudinary).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test('aucune double suppression Cloudinary sur un seul échec', async () => {
  mockUploadToCloudinary.mockResolvedValue({ secure_url: 'https://cdn.test/once.jpg', public_id: 'once-id', resource_type: 'image', version: 1, format: 'jpg', bytes: 3 });
  mockDestroyFromCloudinary.mockResolvedValue();
  const { paiement, adminToken } = await fixtureEcheance();
  await Paiement.findByIdAndUpdate(paiement._id, { statut: 'payé', montantRecu: 150000 });

  const res = await request(app).post(`/api/paiements/${paiement._id}/marquer-paye`).set('Authorization', `Bearer ${adminToken}`)
    .field('montantRecu', '150000').field('datePaiement', '2027-06-10').field('modePaiement', 'espèces')
    .attach('preuve', Buffer.from('img'), { filename: 'preuve.jpg', contentType: 'image/jpeg' });

  expect(res.status).toBe(409); // PAYMENT_ALREADY_PAID
  // Ce cas échoue AVANT l'upload (contrôle métier précoce) — aucun rollback à faire.
  expect(mockUploadToCloudinary).not.toHaveBeenCalled();
  expect(mockDestroyFromCloudinary).not.toHaveBeenCalled();
});
