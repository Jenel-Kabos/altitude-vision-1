const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const routes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', routes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let operator;
let client;
let proprietor;
let accommodationA1;
let accommodationA2;
let accommodationB1;
let accommodationB2;

async function makeAccommodation({ tenant, owner, suffix, status, type = 'villa_meublee', city = 'Brazzaville', submittedAt }) {
  const property = await Property.create({
    tenant: tenant._id,
    title: `HZ04 Hébergement ${suffix}`,
    description: 'Sentinelle de certification des listes administratives.',
    pole: 'Altimmo',
    type: 'Villa',
    status: 'hebergement',
    price: suffix.endsWith('1') ? 10000 : 20000,
    address: { arrondissement: 'Centre', city },
    latitude: -4.26,
    longitude: 15.28,
    images: ['https://example.test/hz04.jpg'],
    surface: 100,
    statusAdmin: 'Validée',
    availability: 'Disponible',
    owner: owner._id,
  });
  return Accommodation.create({
    tenant: tenant._id,
    property: property._id,
    accommodationType: type,
    publicationStatus: status,
    capacity: { maxAdults: 4, maxChildren: 2 },
    createdBy: owner._id,
    submittedAt,
  });
}

const ids = (response) => response.body.data.accommodations.map((item) => String(item._id));

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'HZ04 A' });
  const fixtureB = await createTenantFixture({ label: 'HZ04 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  operator = await User.create({ name: 'HZ04 Operator', email: 'hz04-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  client = await User.create({ name: 'HZ04 Client', email: 'hz04-client@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  proprietor = await User.create({ name: 'HZ04 Owner', email: 'hz04-owner@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HZ04 admin lists certification', capabilities: [] });
  accommodationA1 = await makeAccommodation({ tenant: tenantA, owner: adminA, suffix: 'A1', status: 'soumis', submittedAt: new Date('2028-01-01') });
  accommodationA2 = await makeAccommodation({ tenant: tenantA, owner: adminA, suffix: 'A2', status: 'publie', type: 'appartement_meuble', city: 'Pointe-Noire' });
  accommodationB1 = await makeAccommodation({ tenant: tenantB, owner: adminB, suffix: 'B1', status: 'soumis', submittedAt: new Date('2028-01-02') });
  accommodationB2 = await makeAccommodation({ tenant: tenantB, owner: adminB, suffix: 'B2', status: 'publie', type: 'appartement_meuble', city: 'Pointe-Noire' });
});

afterAll(stopFinancialMongo);

test.each(['/admin/list', '/status/pending'])(
  'Admin A ne reçoit aucune sentinelle du tenant B sur GET %s',
  async (path) => {
    const response = await request(app).get(`/api/accommodations${path}`).set(bearer(adminA, tenantA));
    expect(response.status).toBe(200);
    expect(new Set(ids(response))).toEqual(new Set((path === '/status/pending' ? [accommodationA1] : [accommodationA1, accommodationA2]).map((item) => String(item._id))));
  },
);

test.each(['/admin/list', '/status/pending'])(
  'Admin B ne reçoit aucune sentinelle du tenant A sur GET %s',
  async (path) => {
    const response = await request(app).get(`/api/accommodations${path}`).set(bearer(adminB, tenantB));
    expect(response.status).toBe(200);
    expect(new Set(ids(response))).toEqual(new Set((path === '/status/pending' ? [accommodationB1] : [accommodationB1, accommodationB2]).map((item) => String(item._id))));
  },
);

test.each(['Admin', 'GestionnaireImmobilier', 'Collaborateur'])(
  'rôle autorisé %s sans tenant échoue fermé sur les deux listes',
  async (role) => {
    const user = await User.create({ name: `HZ04 ${role}`, email: `hz04-${role.toLowerCase()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
    for (const path of ['/admin/list', '/status/pending']) {
      const response = await request(app).get(`/api/accommodations${path}`).set(bearer(user));
      expect(response.status).toBe(403);
      expect(response.body.data?.accommodations).toBeUndefined();
    }
  },
);

test.each(['/admin/list', '/status/pending'])('PlatformOperator global conserve la lecture globale sur GET %s', async (path) => {
  const response = await request(app).get(`/api/accommodations${path}`).set(bearer(operator));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set((path === '/status/pending' ? [accommodationA1, accommodationB1] : [accommodationA1, accommodationA2, accommodationB1, accommodationB2]).map((item) => String(item._id))));
});

test.each([
  ['A', () => tenantA, () => [accommodationA1, accommodationA2]],
  ['B', () => tenantB, () => [accommodationB1, accommodationB2]],
])('PlatformOperator scoped %s reste isolé sur les deux listes', async (_label, tenant, expected) => {
  for (const path of ['/admin/list', '/status/pending']) {
    const response = await request(app).get(`/api/accommodations${path}`).set(bearer(operator, tenant()));
    expect(response.status).toBe(200);
    const wanted = path === '/status/pending' ? expected().filter((item) => item.publicationStatus === 'soumis') : expected();
    expect(new Set(ids(response))).toEqual(new Set(wanted.map((item) => String(item._id))));
  }
});

test.each([['Client', () => client], ['Proprietaire', () => proprietor]])('%s reste refusé par le RBAC sur les deux listes', async (_role, actor) => {
  for (const path of ['/admin/list', '/status/pending']) {
    expect((await request(app).get(`/api/accommodations${path}`).set(bearer(actor()))).status).toBe(403);
  }
});

test.each(['/admin/list', '/status/pending'])('anonymous reste refusé sur GET %s', async (path) => {
  expect((await request(app).get(`/api/accommodations${path}`)).status).toBe(401);
});

test('filtres, recherche, tri, pagination, populate, total et liste vide restent inchangés', async () => {
  const filtered = await request(app)
    .get('/api/accommodations/admin/list?status=publie&type=appartement_meuble&city=Pointe-Noire&search=A2&sort=prix_desc&page=1&limit=1')
    .set(bearer(adminA, tenantA));
  expect(filtered.status).toBe(200);
  expect(ids(filtered)).toEqual([String(accommodationA2._id)]);
  expect(filtered.body.data).toMatchObject({ total: 1, page: 1, limit: 1 });
  expect(filtered.body.data.accommodations[0].property.title).toBe('HZ04 Hébergement A2');

  const empty = await request(app).get('/api/accommodations/admin/list?status=rejete').set(bearer(adminA, tenantA));
  expect(empty.status).toBe(200);
  expect(empty.body.data).toMatchObject({ accommodations: [], total: 0, page: 1, limit: 20 });
});

test('les deux listes sont strictement read-only', async () => {
  const before = await Accommodation.find().sort({ _id: 1 }).lean();
  expect((await request(app).get('/api/accommodations/admin/list').set(bearer(adminA, tenantA))).status).toBe(200);
  expect((await request(app).get('/api/accommodations/status/pending').set(bearer(adminA, tenantA))).status).toBe(200);
  expect(await Accommodation.find().sort({ _id: 1 }).lean()).toEqual(before);
});
