jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue({}) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const IndividualSubscription = require('../models/IndividualSubscription');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express();
app.use(express.json());
app.use('/api/paiements/location', require('../routes/paiementLocationRoutes'));
app.use(errorHandler);

let seq = 0;
const makeOwner = () => User.create({ name: `Penalty Owner ${++seq}`, email: `c210c-penalty-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
const as = (actor) => ({ Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

async function seedPayment(owner, key, tenant = null) {
  const property = await Property.create({
    title: `Penalty ${key}`, description: 'Description suffisamment longue pour validation.', pole: 'Altimmo', type: 'Appartement', status: 'location', price: 100000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/p.jpg'], surface: 45,
    statusAdmin: 'Validée', availability: 'Disponible', latitude: -4.27, longitude: 15.27, owner: owner._id, tenant,
  });
  const contrat = await Contrat.create({ type: 'location', bien: property._id, statut: 'actif', dateEntree: '2020-01-01', dateFinBail: '2030-12-31', montantLoyer: 100000 });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 1, annee: 2020, montant: 100000, montantTotal: 100000, statut: 'impayé' });
  return { property, contrat, paiement };
}

beforeAll(async () => { await startFinancialMongo(); await IndividualSubscription.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await Promise.all([Paiement.deleteMany({}), Contrat.deleteMany({}), Property.deleteMany({}), IndividualSubscription.deleteMany({}), User.deleteMany({})]);
});

test('Individual A calcule uniquement ses pénalités, jamais Individual B ni Tenant X', async () => {
  const [ownerA, ownerB] = await Promise.all([makeOwner(), makeOwner()]);
  const [a, b, tenantX] = await Promise.all([
    seedPayment(ownerA, 'A'),
    seedPayment(ownerB, 'B'),
    seedPayment(ownerA, 'TENANT-X', new mongoose.Types.ObjectId()),
  ]);
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  const res = await request(app).post('/api/paiements/location/calculer-penalites?scope=individual').set(as(ownerA));
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ verifies: 1, penalites: 1 });
  expect((await Paiement.findById(a.paiement._id)).penaliteAppliquee).toBe(true);
  expect((await Paiement.findById(b.paiement._id)).penaliteAppliquee).not.toBe(true);
  expect((await Paiement.findById(tenantX.paiement._id)).penaliteAppliquee).not.toBe(true);
});

test('abonnement expiré refuse le calcul sans altérer le paiement', async () => {
  const ownerA = await makeOwner();
  const a = await seedPayment(ownerA, 'EXPIRED');
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'past_due', modulesIncluded: ['location'] });

  const res = await request(app).post('/api/paiements/location/calculer-penalites?scope=individual').set(as(ownerA));
  expect(res.status).toBe(403);
  const unchanged = await Paiement.findById(a.paiement._id);
  expect(unchanged.statut).toBe('impayé');
  expect(unchanged.penaliteAppliquee).not.toBe(true);
});
