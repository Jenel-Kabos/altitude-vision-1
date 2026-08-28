const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialDocument = require('../models/FinancialDocument');
const dashboardAnalyticsRoutes = require('../routes/dashboardAnalyticsRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/dashboard-analytics', dashboardAnalyticsRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const oid = () => new mongoose.Types.ObjectId();
const sentinels = { A: 111, B: 777 };
let tenantA;
let tenantB;
let adminA;
let adminB;
let operatorUser;
let plainAdmin;
let client;
let proprietor;
let accommodationA;

async function insertTenantAnalytics({ tenant, owner, amount, suffix }) {
  const salePropertyId = oid();
  const rentalPropertyId = oid();
  const accommodationPropertyId = oid();
  const hotelPropertyId = oid();
  const accommodationId = oid();
  const hotelId = oid();
  const contractId = oid();

  await Property.collection.insertMany([
    { _id: salePropertyId, owner: owner._id, title: `Sale ${suffix}`, status: 'vente', pole: 'Altimmo', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible' },
    { _id: rentalPropertyId, owner: owner._id, title: `Rental ${suffix}`, status: 'location', pole: 'Altimmo', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible' },
    { _id: accommodationPropertyId, owner: owner._id, title: `Accommodation ${suffix}`, status: 'hebergement', pole: 'Altimmo', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible' },
    { _id: hotelPropertyId, owner: owner._id, title: `Hotel ${suffix}`, status: 'hebergement', pole: 'Altimmo', statusAdmin: 'Validée', isPublished: true, availability: 'Disponible' },
  ]);
  await Transaction.collection.insertOne({ _id: oid(), property: salePropertyId, reservation: oid(), transactionType: 'vente', status: 'Réussie', finalAmount: amount, commission: { agencyNet: amount }, transactionDate: new Date() });
  await RentalManagement.collection.insertOne({ _id: oid(), property: rentalPropertyId, managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'libre' });
  await Contrat.collection.insertOne({ _id: contractId, bien: rentalPropertyId, type: 'location', statut: 'actif', dateFinBail: new Date(Date.now() + 10 * 86400000) });
  await Paiement.collection.insertOne({ _id: oid(), contrat: contractId, montantRecu: amount, montantTotal: amount, statut: 'payé' });
  await Accommodation.collection.insertOne({ _id: accommodationId, tenant: tenant._id, property: accommodationPropertyId, accommodationType: 'appartement_meuble', publicationStatus: 'publie', createdBy: owner._id });
  await Hotel.collection.insertOne({ _id: hotelId, tenant: tenant._id, property: hotelPropertyId, name: `Hotel ${suffix}`, manager: owner._id, createdBy: owner._id, publicationStatus: 'publie', status: 'actif', active: true });
  await Room.collection.insertOne({ _id: oid(), hotel: hotelId, roomNumber: `R-${suffix}`, active: true, status: 'available' });
  await PaymentAllocation.collection.insertMany([
    { _id: oid(), domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: accommodationId, status: 'active', amountMinor: amount },
    { _id: oid(), domain: 'hotel', establishmentType: 'Hotel', establishmentId: hotelId, status: 'active', amountMinor: amount },
  ]);
  await FinancialDocument.collection.insertMany([
    { _id: oid(), domain: 'real_estate', businessOperationKey: `analytics-accommodation-${suffix}`, establishmentType: 'Accommodation', establishmentId: accommodationId, subjectType: 'AccommodationReservation', status: 'issued', paymentStatus: 'unpaid', balanceMinor: amount },
    { _id: oid(), domain: 'hotel', businessOperationKey: `analytics-hotel-${suffix}`, establishmentType: 'Hotel', establishmentId: hotelId, status: 'issued', balanceMinor: amount },
  ]);
  return { accommodationId, hotelId };
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Analytics tenant A' });
  const fixtureB = await createTenantFixture({ label: 'Analytics tenant B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  const a = await insertTenantAnalytics({ tenant: tenantA, owner: adminA, amount: sentinels.A, suffix: 'A' });
  await insertTenantAnalytics({ tenant: tenantB, owner: adminB, amount: sentinels.B, suffix: 'B' });
  accommodationA = a.accommodationId;

  const standalone = async (name, role = 'Admin') => User.create({
    name, email: `${name.toLowerCase()}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
  plainAdmin = await standalone('AnalyticsPlainAdmin');
  operatorUser = await standalone('AnalyticsOperator');
  client = await standalone('AnalyticsClient', 'Client');
  proprietor = await standalone('AnalyticsOwner', 'Proprietaire');
  await grantOperator({ userId: operatorUser._id, actor: plainAdmin, reason: 'Analytics tenant test', capabilities: ['platform.reporting.read'] });
});

afterAll(stopFinancialMongo);

describe('reproduction cross-tenant — Admin A ne reçoit jamais la sentinelle B', () => {
  test('sales', async () => {
    const res = await request(app).get('/api/dashboard-analytics/sales').set(bearer(adminA));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.salesAmount).toBe(sentinels.A);
    expect(res.body.data.kpis.total).toBe(1);
  });

  test('rentals', async () => {
    const res = await request(app).get('/api/dashboard-analytics/rentals').set(bearer(adminA));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.rentCollected).toBe(sentinels.A);
  });

  test('accommodations — agrégat financier inclus', async () => {
    const res = await request(app).get('/api/dashboard-analytics/accommodations').set(bearer(adminA));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.grossAmountCollected).toBe(sentinels.A);
    expect(res.body.data.kpis.total).toBe(1);
  });

  test('hotels — agrégat financier inclus', async () => {
    const res = await request(app).get('/api/dashboard-analytics/hotels').set(bearer(adminA));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.grossAmountCollected).toBe(sentinels.A);
    expect(res.body.data.kpis.activeHotels).toBe(1);
  });
});

describe('matrice tenant et PlatformOperator', () => {
  test('Admin B reçoit uniquement B', async () => {
    const res = await request(app).get('/api/dashboard-analytics/accommodations').set(bearer(adminB));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.grossAmountCollected).toBe(sentinels.B);
  });

  test('Admin A ne peut pas sélectionner Tenant B', async () => {
    const res = await request(app).get('/api/dashboard-analytics/sales').set(bearer(adminA, tenantB));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  test('Admin sans tenant échoue fermé', async () => {
    const res = await request(app).get('/api/dashboard-analytics/hotels').set(bearer(plainAdmin));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  test('PlatformOperator global conserve le total A+B', async () => {
    const res = await request(app).get('/api/dashboard-analytics/accommodations').set(bearer(operatorUser));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.grossAmountCollected).toBe(sentinels.A + sentinels.B);
  });

  test.each([
    ['A', () => tenantA, sentinels.A],
    ['B', () => tenantB, sentinels.B],
  ])('PlatformOperator scoped %s reçoit uniquement ce tenant', async (_label, getTenant, expected) => {
    const res = await request(app).get('/api/dashboard-analytics/accommodations').set(bearer(operatorUser, getTenant()));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.grossAmountCollected).toBe(expected);
  });

  test('anonymous reste 401', async () => {
    const res = await request(app).get('/api/dashboard-analytics/sales');
    expect(res.status).toBe(401);
  });

  test('rôle non autorisé reste 403', async () => {
    const res = await request(app).get('/api/dashboard-analytics/sales').set(bearer(client));
    expect(res.status).toBe(403);
  });

  test('tenant suspendu échoue fermé', async () => {
    await PlatformTenant.updateOne({ _id: tenantB._id }, { status: 'suspended' });
    const res = await request(app).get('/api/dashboard-analytics/accommodations').set(bearer(adminB));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TENANT_CONTEXT_REQUIRED');
    await PlatformTenant.updateOne({ _id: tenantB._id }, { status: 'trial' });
  });

  test('Proprietaire sans tenant conserve son contrat owner', async () => {
    await Property.collection.updateOne({ _id: (await Accommodation.findById(accommodationA).lean()).property }, { $set: { owner: proprietor._id } });
    await Accommodation.collection.updateOne({ _id: accommodationA }, { $set: { createdBy: proprietor._id } });
    const res = await request(app).get('/api/dashboard-analytics/accommodations').query({ accommodationId: String(accommodationA) }).set(bearer(proprietor));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.total).toBe(1);
  });
});
