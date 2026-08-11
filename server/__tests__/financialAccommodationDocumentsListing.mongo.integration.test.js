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
const AccommodationReservation = require('../models/AccommodationReservation');
const HotelReservation = require('../models/HotelReservation');
const financialRoutes = require('../routes/financialRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/financial', financialRoutes);
app.use(errorHandler);

const signToken = (id, tokenVersion = 0) => jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
let tenantFixture;
const makeUser = async (overrides = {}) => {
  counter += 1;
  const user = await User.create({ name: 'Test User', email: `finacc${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
  await addTenantMember({ tenant: tenantFixture.tenant, user, bootstrap: tenantFixture.bootstrap });
  return user;
};

const makeAccommodationInvoice = (createdBy, overrides = {}) => FinancialDocument.create({
  tenant: tenantFixture.tenant._id,
  domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: new mongoose.Types.ObjectId(),
  documentType: 'invoice', status: 'issued', currency: 'XAF',
  subjectType: 'AccommodationReservation', subjectId: new mongoose.Types.ObjectId(),
  totalMinor: 5000000, businessOperationKey: `test:accommodation-invoice:${Date.now()}:${Math.random()}`,
  createdBy,
  ...overrides,
});

beforeAll(startFinancialMongo);
beforeEach(async () => { tenantFixture = await createTenantFixture({ label: 'Financial accommodation documents' }); });
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
    tenant: tenantFixture.tenant._id,
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

test('un voyageur peut lire uniquement la facture de sa réservation Accommodation', async () => {
  const guest = await makeUser({ role: 'Client' }); const outsider = await makeUser({ role: 'Client' });
  const owner = await makeUser({ role: 'Proprietaire' }); const reservationId = new mongoose.Types.ObjectId();
  const invoice = await makeAccommodationInvoice(owner._id, { subjectId: reservationId });
  await AccommodationReservation.create({
    _id: reservationId, tenant: tenantFixture.tenant._id, accommodation: invoice.establishmentId, guest: guest._id, owner: owner._id,
    checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-03'), nights: 2,
    guestCount: 1, adults: 1, total: 5000000, financialDocument: invoice._id, createdBy: guest._id,
  });

  const allowed = await request(app).get(`/api/financial/documents/${invoice._id}`).set('Authorization', `Bearer ${signToken(guest._id)}`);
  expect(allowed.status).toBe(200);
  expect(allowed.body.data.document.id).toBe(String(invoice._id));

  const denied = await request(app).get(`/api/financial/documents/${invoice._id}`).set('Authorization', `Bearer ${signToken(outsider._id)}`);
  expect(denied.status).toBe(403);
});

test('un voyageur hôtel peut lire uniquement la facture de sa propre réservation', async () => {
  const guest = await makeUser({ role: 'Client' }); const outsider = await makeUser({ role: 'Client' });
  const hotelId = new mongoose.Types.ObjectId();
  const reservation = await HotelReservation.create({
    tenant: tenantFixture.tenant._id, hotel: hotelId, roomCategory: new mongoose.Types.ObjectId(), guestUser: guest._id,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', country: 'CG' },
    checkInDate: new Date('2026-10-01'), checkOutDate: new Date('2026-10-03'), roomsCount: 1, adults: 1,
    unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF',
    rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 },
    status: 'confirmed', source: 'owner_dashboard', createdBy: guest._id,
  });
  const invoice = await FinancialDocument.create({
    tenant: tenantFixture.tenant._id, domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, documentType: 'invoice', status: 'issued', currency: 'XAF',
    subjectType: 'HotelReservation', subjectId: reservation._id, totalMinor: 60000,
    businessOperationKey: `test:hotel-personal:${Date.now()}`, createdBy: guest._id,
  });

  const allowed = await request(app).get(`/api/financial/documents/${invoice._id}`).set('Authorization', `Bearer ${signToken(guest._id)}`);
  expect(allowed.status).toBe(200);
  const denied = await request(app).get(`/api/financial/documents/${invoice._id}`).set('Authorization', `Bearer ${signToken(outsider._id)}`);
  expect(denied.status).toBe(403);
});
