// GL-LIFE-1 — PUT /api/contrats/:id : toute demande de changement de
// `statut` sur un bail de location passe désormais par la machine d'état
// centralisée (rentalLeaseLifecycleService) — jamais un écrasement direct.
// Les contrats de vente restent inchangés (hors périmètre du cycle de vie
// locatif) et les champs non liés au statut restent modifiables comme avant.
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
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Utilisateur Test', email: `contratlife${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

async function buildLeaseFixture() {
  const admin = await makeUser({ role: 'Admin' });
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa Update Guard', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { admin, contrat };
}

test('PUT statut illégal (actif → en_attente) est rejeté par la machine d\'état, jamais un écrasement silencieux', async () => {
  const { admin, contrat } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/${contrat._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ statut: 'en_attente' });
  expect(res.status).toBe(409);
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.statut).toBe('actif'); // inchangé
});

test('PUT statut légal (actif → résilié) synchronise cycleVie', async () => {
  const { admin, contrat } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/${contrat._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ statut: 'résilié' });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.statut).toBe('résilié');
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.cycleVie).toBe('resilie');
});

test('PUT sans changement de statut modifie les autres champs comme avant (aucune régression)', async () => {
  const { admin, contrat } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/${contrat._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ montantLoyer: 350000 });
  expect(res.status).toBe(200);
  expect(res.body.data.contrat.montantLoyer).toBe(350000);
});

test('PUT statut identique au statut actuel ne déclenche aucune transition', async () => {
  const { admin, contrat } = await buildLeaseFixture();
  const res = await request(app).put(`/api/contrats/${contrat._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ statut: 'actif', montantLoyer: 310000 });
  expect(res.status).toBe(200);
  const fresh = await Contrat.findById(contrat._id);
  expect(fresh.cycleHistory).toHaveLength(0);
  expect(fresh.montantLoyer).toBe(310000);
});
