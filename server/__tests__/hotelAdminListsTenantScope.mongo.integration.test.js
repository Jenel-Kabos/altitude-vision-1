const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const RoomCategory = require('../models/RoomCategory');
const routes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotels', routes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let staffA;
let staffB;
let operator;
let operatorNoRead;
let proprietor;
let client;
let hotelsA;
let hotelsB;

async function makeProperty({ tenant, owner, suffix, price, city, createdAt }) {
  return Property.create({
    tenant: tenant._id,
    title: `HZ06 Property ${suffix}`,
    description: `Description synthétique suffisamment longue pour le test HZ06 ${suffix}.`,
    pole: 'Altimmo', type: 'Villa', status: 'location', statusAdmin: 'Validée', isPublished: true,
    price, address: { street: `Rue ${suffix}`, city, arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24,
    images: [`https://placehold.co/1200x800/png?text=HZ06-${suffix}`],
    surface: 120, availability: 'Disponible', owner: owner._id,
    createdAt, updatedAt: createdAt,
  });
}

async function makeHotel({ tenant, manager, createdBy, property, suffix, publicationStatus, rate, createdAt }) {
  const hotel = await createTenantHotel({
    tenant, manager, createdBy,
    overrides: {
      name: `HZ06 Hotel ${suffix}`,
      property: property._id,
      publicationStatus,
      status: 'actif', active: true,
      phone: suffix.startsWith('A') ? '+242111111111' : '+242777777777',
      email: `hz06-${suffix.toLowerCase()}@example.test`,
      minNightlyRate: rate,
      maxNightlyRate: rate + 50,
      submittedAt: publicationStatus === 'soumis' ? createdAt : null,
      publishedAt: publicationStatus === 'publie' ? createdAt : null,
      createdAt, updatedAt: createdAt,
    },
  });
  await RoomCategory.create({ hotel: hotel._id, name: `HZ06 Category ${suffix}`, createdBy: createdBy._id });
  return hotel;
}

const hotelIds = (response) => response.body.data.hotels.map((item) => String(item._id));
const ids = (items) => items.map((item) => String(item._id));

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'HZ06 A' });
  const fixtureB = await createTenantFixture({ label: 'HZ06 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: staffA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Collaborateur' } }));
  ({ user: staffB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Collaborateur' } }));
  const ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Proprietaire' } })).user;
  const ownerB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
  proprietor = await User.create({ name: 'HZ06 Owner', email: 'hz06-owner@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  client = await User.create({ name: 'HZ06 Client', email: 'hz06-client@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  operator = await User.create({ name: 'HZ06 Operator', email: 'hz06-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HZ06 hotel lists certification', capabilities: ['platform.hotels.read', 'platform.hotels.manage'] });
  operatorNoRead = await User.create({ name: 'HZ06 Operator No Read', email: 'hz06-operator-no-read@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await grantOperator({ userId: operatorNoRead._id, actor: adminA, reason: 'HZ06 capability denial certification', capabilities: [] });

  const propertyA1 = await makeProperty({ tenant: tenantA, owner: ownerA, suffix: 'A1', price: 111, city: 'Brazzaville', createdAt: new Date('2028-01-01') });
  const propertyA2 = await makeProperty({ tenant: tenantA, owner: ownerA, suffix: 'A2', price: 112, city: 'Brazzaville', createdAt: new Date('2028-01-02') });
  const propertyB1 = await makeProperty({ tenant: tenantB, owner: ownerB, suffix: 'B1', price: 777, city: 'Pointe-Noire', createdAt: new Date('2028-02-01') });
  const propertyB2 = await makeProperty({ tenant: tenantB, owner: ownerB, suffix: 'B2', price: 778, city: 'Pointe-Noire', createdAt: new Date('2028-02-02') });
  hotelsA = [
    await makeHotel({ tenant: tenantA, manager: staffA, createdBy: adminA, property: propertyA1, suffix: 'A1', publicationStatus: 'soumis', rate: 111, createdAt: new Date('2028-01-01') }),
    await makeHotel({ tenant: tenantA, manager: staffA, createdBy: adminA, property: propertyA2, suffix: 'A2', publicationStatus: 'publie', rate: 112, createdAt: new Date('2028-01-02') }),
  ];
  hotelsB = [
    await makeHotel({ tenant: tenantB, manager: staffB, createdBy: adminB, property: propertyB1, suffix: 'B1', publicationStatus: 'soumis', rate: 777, createdAt: new Date('2028-02-01') }),
    await makeHotel({ tenant: tenantB, manager: staffB, createdBy: adminB, property: propertyB2, suffix: 'B2', publicationStatus: 'publie', rate: 778, createdAt: new Date('2028-02-02') }),
  ];
});

afterAll(stopFinancialMongo);

test.each([
  ['A', () => adminA, () => tenantA, () => hotelsA],
  ['B', () => adminB, () => tenantB, () => hotelsB],
])('Admin %s reçoit uniquement son tenant sur admin/list', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/hotels/admin/list').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(new Set(hotelIds(response))).toEqual(new Set(ids(expected())));
  expect(response.body.data).toMatchObject({ total: 2, page: 1, limit: 20 });
});

test.each([
  ['A', () => adminA, () => tenantA, () => hotelsA[1]],
  ['B', () => adminB, () => tenantB, () => hotelsB[1]],
])('Admin %s reçoit uniquement son portefeuille publié', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/hotels/portfolio').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(hotelIds(response)).toEqual([String(expected()._id)]);
  expect(response.body.data).toMatchObject({ total: 1, page: 1, limit: 20 });
});

test.each([
  ['A', () => adminA, () => tenantA, () => hotelsA[0]],
  ['B', () => adminB, () => tenantB, () => hotelsB[0]],
])('Admin %s reçoit uniquement sa file pending', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/hotels/status/pending').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(hotelIds(response)).toEqual([String(expected()._id)]);
});

test.each([
  ['A', () => staffA, () => tenantA, () => hotelsA],
  ['B', () => staffB, () => tenantB, () => hotelsB],
])('Staff autorisé %s conserve ses hôtels accessibles', async (_label, actor, tenant, expected) => {
  const list = await request(app).get('/api/hotels/admin/list').set(bearer(actor(), tenant()));
  expect(new Set(hotelIds(list))).toEqual(new Set(ids(expected())));
  const portfolio = await request(app).get('/api/hotels/portfolio').set(bearer(actor(), tenant()));
  expect(hotelIds(portfolio)).toEqual([String(expected()[1]._id)]);
  const pending = await request(app).get('/api/hotels/status/pending').set(bearer(actor(), tenant()));
  expect(hotelIds(pending)).toEqual([String(expected()[0]._id)]);
});

test('staff autorisé sans tenant échoue fermé sur les trois listes', async () => {
  const user = await User.create({ name: 'HZ06 No Tenant Staff', email: 'hz06-no-tenant@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true });
  for (const path of ['/admin/list', '/portfolio', '/status/pending']) {
    const response = await request(app).get(`/api/hotels${path}`).set(bearer(user));
    expect(response.status).toBe(403);
    expect(response.body.data?.hotels).toBeUndefined();
  }
});

test('PlatformOperator global conserve la portée globale historique', async () => {
  for (const [path, expected] of [['/admin/list', [...hotelsA, ...hotelsB]], ['/portfolio', [hotelsA[1], hotelsB[1]]], ['/status/pending', [hotelsA[0], hotelsB[0]]]]) {
    const response = await request(app).get(`/api/hotels${path}`).set(bearer(operator));
    expect(response.status).toBe(200);
    expect(new Set(hotelIds(response))).toEqual(new Set(ids(expected)));
  }
});

test('PlatformOperator sans platform.hotels.read est refusé en vue globale', async () => {
  const response = await request(app).get('/api/hotels/status/pending').set(bearer(operatorNoRead));
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('PLATFORM_HOTELS_READ_REQUIRED');
});

test.each([
  ['A', () => tenantA, () => hotelsA],
  ['B', () => tenantB, () => hotelsB],
])('PlatformOperator scoped %s est isolé sur les trois listes', async (_label, tenant, expected) => {
  const list = await request(app).get('/api/hotels/admin/list').set(bearer(operator, tenant()));
  expect(new Set(hotelIds(list))).toEqual(new Set(ids(expected())));
  const portfolio = await request(app).get('/api/hotels/portfolio').set(bearer(operator, tenant()));
  expect(hotelIds(portfolio)).toEqual([String(expected()[1]._id)]);
  const pending = await request(app).get('/api/hotels/status/pending').set(bearer(operator, tenant()));
  expect(hotelIds(pending)).toEqual([String(expected()[0]._id)]);
});

test('filtres, recherche, tri, pagination, total et payload restent composés avec le tenant', async () => {
  const list = await request(app).get('/api/hotels/admin/list?status=publie&search=A2&sort=ancien&page=1&limit=1').set(bearer(adminA, tenantA));
  expect(list.status).toBe(200);
  expect(hotelIds(list)).toEqual([String(hotelsA[1]._id)]);
  expect(list.body.data).toMatchObject({ total: 1, page: 1, limit: 1 });
  const portfolio = await request(app).get('/api/hotels/portfolio?city=Brazzaville&sort=nom&page=1&limit=1').set(bearer(adminA, tenantA));
  expect(portfolio.status).toBe(200);
  expect(hotelIds(portfolio)).toEqual([String(hotelsA[1]._id)]);
  expect(portfolio.body.data).toMatchObject({ total: 1, page: 1, limit: 1 });
});

test('PII, tarifs et inventaire privé B ne fuient pas vers Admin A', async () => {
  for (const path of ['/admin/list', '/portfolio', '/status/pending']) {
    const response = await request(app).get(`/api/hotels${path}`).set(bearer(adminA, tenantA));
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('HZ06 Hotel B');
    expect(serialized).not.toContain('hz06-b');
    expect(serialized).not.toContain('+242777777777');
    expect(serialized).not.toContain('778');
  }
});

test('Proprietaire et Client restent inchangés', async () => {
  for (const actor of [proprietor, client]) {
    expect((await request(app).get('/api/hotels/admin/list').set(bearer(actor))).status).toBe(403);
    expect((await request(app).get('/api/hotels/status/pending').set(bearer(actor))).status).toBe(403);
  }
});

test('les trois GET restent strictement read-only', async () => {
  const beforeHotels = await Hotel.find().sort({ _id: 1 }).lean();
  const beforeProperties = await Property.find().sort({ _id: 1 }).lean();
  for (const path of ['/admin/list', '/portfolio', '/status/pending']) {
    expect((await request(app).get(`/api/hotels${path}`).set(bearer(adminA, tenantA))).status).toBe(200);
  }
  expect(await Hotel.find().sort({ _id: 1 }).lean()).toEqual(beforeHotels);
  expect(await Property.find().sort({ _id: 1 }).lean()).toEqual(beforeProperties);
});
