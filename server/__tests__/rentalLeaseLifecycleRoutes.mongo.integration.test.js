// GL-LIFE-1 — Couche HTTP/RBAC du cycle de vie du bail : mêmes rôles que
// contratRoutes.js (STAFF_IMMO), même convention que
// dossierRoutes.mongo.integration.test.js pour l'app Express de test.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const rentalLeaseLifecycleRoutes = require('../routes/rentalLeaseLifecycleRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/rental-lease-lifecycle', rentalLeaseLifecycleRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `gllifer${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

async function buildActiveLease() {
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa Route GL-LIFE-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { owner, property, proprietaire, locataire, contrat };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('401 sans authentification', async () => {
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard');
  expect(res.status).toBe(401);
});

test('403 pour un rôle hors STAFF_IMMO (ex: Secretaire)', async () => {
  const secretaire = await makeUser({ role: 'Secretaire' });
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
  expect(res.status).toBe(403);
});

test('GET /dashboard renvoie la forme attendue pour un Admin', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const res = await request(app).get('/api/rental-lease-lifecycle/dashboard').set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.dashboard).toHaveProperty('bauxAEcheance');
  expect(res.body.data.dashboard).toHaveProperty('cautionsARestituer');
  expect(res.body.data.dashboard).toHaveProperty('dossiersBloques');
});

test('POST /:id/transition applique une transition légale', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'preavis' });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.cycleVie).toBe('preavis');
});

test('POST /:id/transition rejette une transition illégale (409)', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'archive' });
  expect(res.status).toBe(409);
});

// GL-UX-1 — ces deux endpoints existent uniquement pour que le frontend
// n'ait jamais à dupliquer la table de transitions ni la logique de diff
// ("aucune logique métier dans React").
test('GET /:id/available-transitions renvoie les cibles légales depuis l\'étape actuelle', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).get(`/api/rental-lease-lifecycle/${contrat._id}/available-transitions`).set('Authorization', `Bearer ${signToken(admin._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.cycleVie).toBe('actif');
  expect(res.body.data.allowed).toEqual(expect.arrayContaining(['preavis', 'resilie']));
});

test('POST /:id/renew/preview ne persiste rien et renvoie le mode + le diff', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew/preview`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ dateFinBail: '2028-12-31', montantLoyer: 330000 });
  expect(res.status).toBe(200);
  expect(res.body.data.preview.mode).toBe('prolongation');
  expect(res.body.data.preview.champsModifies.map((c) => c.champ)).toEqual(expect.arrayContaining(['dateFinBail', 'montantLoyer']));

  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.avenants).toHaveLength(0); // aperçu uniquement, aucune écriture
  expect(fresh.montantLoyer).toBe(300000);
});

test('POST /:id/renew/preview détecte un changement majeur (nouveau locataire) sans rien persister', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const autreLocataire = await Locataire.create({ nom: 'Loemba', prenom: 'Marie', telephone: '+242060000097' });
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew/preview`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ locataire: String(autreLocataire._id) });
  expect(res.status).toBe(200);
  expect(res.body.data.preview.mode).toBe('nouveau_contrat');

  const fresh = await Contrat.findById(contrat._id);
  expect(String(fresh.locataire)).toBe(String(contrat.locataire)); // inchangé
  expect(fresh.renouvelePar).toBeNull();
  const totalContrats = await Contrat.countDocuments({ bien: contrat.bien });
  expect(totalContrats).toBe(1); // aucun nouveau Contrat créé par un simple aperçu
});

test('POST /:id/avenants crée un avenant', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/avenants`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ type: 'loyer', changes: { montantLoyer: 350000 } });
  expect(res.status).toBe(201);
  expect(res.body.data.contrat.montantLoyer).toBe(350000);
});

test('POST /:id/renew (prolongation) renvoie mode=prolongation', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  const res = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/renew`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ dateFinBail: '2028-12-31' });
  expect(res.status).toBe(200);
  expect(res.body.data.mode).toBe('prolongation');
});

test('POST /:id/caution/encaisser puis /bloquer puis /restituer', async () => {
  const admin = await makeUser({ role: 'Admin' });
  const { contrat } = await buildActiveLease();
  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/encaisser`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({});
  const blocRes = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/bloquer`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({});
  expect(blocRes.status).toBe(200);
  expect(blocRes.body.data.contrat.caution.statut).toBe('bloquee');

  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'preavis' });
  await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/transition`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ target: 'inspection_sortie' });

  const restRes = await request(app).post(`/api/rental-lease-lifecycle/${contrat._id}/caution/restituer`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ montant: 600000 });
  expect(restRes.status).toBe(200);
  expect(restRes.body.data.contrat.caution.statut).toBe('restituee');
  expect(restRes.body.data.contrat.cycleVie).toBe('resilie');
});
