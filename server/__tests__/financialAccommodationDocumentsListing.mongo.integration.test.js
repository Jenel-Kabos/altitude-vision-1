// DOC-ARCH-2 — GET /api/financial/accommodations/documents : projection en
// lecture seule pour le Centre documentaire (Altimmo → Hébergements →
// Factures). N'écrit jamais, ne duplique jamais FinancialDocument (source de
// vérité conservée, ADR-FIN-003/007).
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const FinancialDocument = require('../models/FinancialDocument');
const financialRoutes = require('../routes/financialRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/financial', financialRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `finacc${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

const makeAccommodationInvoice = (createdBy, overrides = {}) => FinancialDocument.create({
  domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: new mongoose.Types.ObjectId(),
  documentType: 'invoice', status: 'issued', currency: 'XAF',
  subjectType: 'AccommodationReservation', subjectId: new mongoose.Types.ObjectId(),
  totalMinor: 5000000, businessOperationKey: `test:accommodation-invoice:${Date.now()}:${Math.random()}`,
  createdBy,
  ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('401 sans authentification', async () => {
  const res = await request(app).get('/api/financial/accommodations/documents');
  expect(res.status).toBe(401);
});

test('403 — un Client ne peut pas lister les factures hébergement', async () => {
  const client = await makeUser({ role: 'Client' });
  const res = await request(app).get('/api/financial/accommodations/documents').set('Authorization', `Bearer ${signToken(client._id)}`);
  expect(res.status).toBe(403);
});

test.each(['Admin', 'GestionnaireImmobilier', 'Collaborateur'])('200 — %s peut lister les factures hébergement, jamais celles d’un autre domaine (hôtel)', async (role) => {
  const staff = await makeUser({ role });
  const invoice = await makeAccommodationInvoice(staff._id);
  await FinancialDocument.create({
    domain: 'hotel', establishmentType: 'Hotel', establishmentId: new mongoose.Types.ObjectId(), documentType: 'invoice',
    status: 'issued', currency: 'XAF', subjectType: 'HotelReservation', subjectId: new mongoose.Types.ObjectId(),
    totalMinor: 1000, businessOperationKey: `test:hotel-invoice:${Date.now()}`, createdBy: staff._id,
  });

  const res = await request(app).get('/api/financial/accommodations/documents').set('Authorization', `Bearer ${signToken(staff._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.documents).toHaveLength(1);
  expect(res.body.data.documents[0].id).toBe(String(invoice._id));
});

test('filtre par statut fonctionne (?status=issued exclut les brouillons)', async () => {
  const staff = await makeUser({ role: 'Admin' });
  const issued = await makeAccommodationInvoice(staff._id, { status: 'issued' });
  await makeAccommodationInvoice(staff._id, { status: 'draft' });

  const res = await request(app).get('/api/financial/accommodations/documents').query({ status: 'issued' }).set('Authorization', `Bearer ${signToken(staff._id)}`);
  expect(res.status).toBe(200);
  expect(res.body.data.documents).toHaveLength(1);
  expect(res.body.data.documents[0].id).toBe(String(issued._id));
});
