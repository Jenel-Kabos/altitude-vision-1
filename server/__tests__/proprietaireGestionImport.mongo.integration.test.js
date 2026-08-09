const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const proprietaireRoutes = require('../routes/proprietaireRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/proprietaires', proprietaireRoutes);
app.use(errorHandler);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('GL-PROPERTY-FLOW-1 — l’ancien import biensPropres est fermé et ne crée aucune donnée', async () => {
  const admin = await User.create({
    name: 'Admin Test',
    email: 'gl-property-flow-admin@example.test',
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role: 'Admin',
  });
  const proprietaire = await Proprietaire.create({
    nom: 'Nkounkou',
    prenom: 'Pauline',
    telephone: '+242061234567',
    biensPropres: [{
      typeBien: 'location',
      titre: 'Bien historique',
      type: 'Appartement',
      adresse: 'Avenue Test 12',
      ville: 'Brazzaville',
      prixLoyer: 200000,
    }],
  });
  const token = jwt.sign({ id: admin._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const response = await request(app)
    .post(`/api/proprietaires/${proprietaire._id}/biens/0/importer-gestion`)
    .set('Authorization', `Bearer ${token}`)
    .send({ latitude: -4.26, longitude: 15.28 });

  expect(response.status).toBe(404);
  expect(await Property.countDocuments()).toBe(0);
  expect(await RentalManagement.countDocuments()).toBe(0);
});
