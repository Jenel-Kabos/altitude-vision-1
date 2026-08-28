const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const routes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', routes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let ownerA;
let ownerB;
let operator;
let client;
let propertiesA;
let propertiesB;

async function makeProperty({ tenant, owner, suffix, statusAdmin, isPublished, status, type, price, createdAt }) {
  return Property.create({
    tenant: tenant._id,
    title: `HZ07-${suffix}`,
    description: `Description synthétique suffisamment longue pour HZ07 ${suffix}.`,
    pole: 'Altimmo',
    type,
    status,
    statusAdmin,
    isPublished,
    price,
    address: { street: `Rue ${suffix}`, city: suffix.startsWith('A') ? 'Brazzaville' : 'Pointe-Noire', arrondissement: 'Centre' },
    latitude: -4.26,
    longitude: 15.24,
    images: [`https://placehold.co/1200x800/png?text=${suffix}`],
    surface: 90,
    availability: 'Disponible',
    owner: owner._id,
    createdAt,
    updatedAt: createdAt,
  });
}

const rootIds = (response) => response.body.data.properties.map((item) => String(item._id));
const expectedIds = (items) => items.map((item) => String(item._id));

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'HZ07 A' });
  const fixtureB = await createTenantFixture({ label: 'HZ07 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: ownerA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Proprietaire' } }));
  ({ user: ownerB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } }));
  operator = await User.create({ name: 'HZ07 Operator', email: 'hz07-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  client = await User.create({ name: 'HZ07 Client', email: 'hz07-client@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HZ07 property moderation certification', capabilities: [] });

  propertiesA = [
    await makeProperty({ tenant: tenantA, owner: ownerA, suffix: 'A-PENDING', statusAdmin: 'En attente', isPublished: false, status: 'vente', type: 'Villa', price: 111000, createdAt: new Date('2028-01-01') }),
    await makeProperty({ tenant: tenantA, owner: ownerA, suffix: 'A-PUBLISHED', statusAdmin: 'Validée', isPublished: true, status: 'location', type: 'Parcelle', price: 112000, createdAt: new Date('2028-01-02') }),
  ];
  propertiesB = [
    await makeProperty({ tenant: tenantB, owner: ownerB, suffix: 'B-PENDING', statusAdmin: 'En attente', isPublished: false, status: 'location', type: 'Appartement', price: 777000, createdAt: new Date('2028-02-01') }),
    await makeProperty({ tenant: tenantB, owner: ownerB, suffix: 'B-APPROVED', statusAdmin: 'Validée', isPublished: false, status: 'vente', type: 'Terrain', price: 778000, createdAt: new Date('2028-02-02') }),
    await makeProperty({ tenant: tenantB, owner: ownerB, suffix: 'B-PUBLISHED', statusAdmin: 'Validée', isPublished: true, status: 'vente', type: 'Parcelle', price: 779000, createdAt: new Date('2028-02-03') }),
  ];
});

afterAll(stopFinancialMongo);

test.each([
  ['A', () => adminA, () => tenantA, () => propertiesA],
  ['B', () => adminB, () => tenantB, () => propertiesB],
])('Admin %s ne reçoit que son tenant sur la racine staff, total compris', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/properties').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(new Set(rootIds(response))).toEqual(new Set(expectedIds(expected())));
  expect(response.body.total).toBe(expected().length);
  expect(response.body.data.total).toBe(expected().length);
});

test.each([
  ['A', () => adminA, () => tenantA, () => propertiesA[0]],
  ['B', () => adminB, () => tenantB, () => propertiesB[0]],
])('Admin %s ne reçoit que son pending et son compteur', async (_label, actor, tenant, pending) => {
  const list = await request(app).get('/api/properties/status/pending').set(bearer(actor(), tenant()));
  expect(list.status).toBe(200);
  expect(rootIds(list)).toEqual([String(pending()._id)]);
  const count = await request(app).get('/api/properties/status/pending-count').set(bearer(actor(), tenant()));
  expect(count.status).toBe(200);
  expect(count.body.data.unreadCount).toBe(1);
});

test.each(['Admin', 'GestionnaireImmobilier', 'Collaborateur'])(
  'rôle staff %s sans tenant échoue fermé sur la racine',
  async (role) => {
    const user = await User.create({ name: `HZ07 ${role}`, email: `hz07-${role.toLowerCase()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
    expect((await request(app).get('/api/properties').set(bearer(user))).status).toBe(403);
  },
);

test('Admin et Collaborateur sans tenant échouent fermés sur leurs routes de file respectives', async () => {
  const collaborator = await User.create({ name: 'HZ07 Collaborator', email: 'hz07-collaborator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true });
  expect((await request(app).get('/api/properties/status/pending').set(bearer(await User.create({ name: 'HZ07 No Tenant Admin', email: 'hz07-no-tenant-admin@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true })))).status).toBe(403);
  expect((await request(app).get('/api/properties/status/pending-count').set(bearer(collaborator))).status).toBe(403);
});

test('PlatformOperator global conserve les trois lectures globales', async () => {
  const root = await request(app).get('/api/properties').set(bearer(operator));
  expect(new Set(rootIds(root))).toEqual(new Set(expectedIds([...propertiesA, ...propertiesB])));
  expect(root.body.total).toBe(5);
  const pending = await request(app).get('/api/properties/status/pending').set(bearer(operator));
  expect(new Set(rootIds(pending))).toEqual(new Set(expectedIds([propertiesA[0], propertiesB[0]])));
  expect((await request(app).get('/api/properties/status/pending-count').set(bearer(operator))).body.data.unreadCount).toBe(2);
});

test.each([
  ['A', () => tenantA, () => propertiesA],
  ['B', () => tenantB, () => propertiesB],
])('PlatformOperator scoped %s reste isolé sur les trois lectures', async (_label, tenant, expected) => {
  const root = await request(app).get('/api/properties').set(bearer(operator, tenant()));
  expect(new Set(rootIds(root))).toEqual(new Set(expectedIds(expected())));
  expect(root.body.total).toBe(expected().length);
  const pendingExpected = expected().filter((item) => item.statusAdmin === 'En attente');
  const pending = await request(app).get('/api/properties/status/pending').set(bearer(operator, tenant()));
  expect(new Set(rootIds(pending))).toEqual(new Set(expectedIds(pendingExpected)));
  expect((await request(app).get('/api/properties/status/pending-count').set(bearer(operator, tenant()))).body.data.unreadCount).toBe(pendingExpected.length);
});

test('les paramètres hostiles restent composés avec le scope serveur', async () => {
  const injected = await request(app).get(`/api/properties?tenant=${tenantB._id}`).set(bearer(adminA, tenantA));
  expect(new Set(rootIds(injected))).toEqual(new Set(expectedIds(propertiesA)));
  expect(injected.body.total).toBe(2);
  const ownerBFilter = await request(app).get(`/api/properties?owner=${ownerB._id}`).set(bearer(adminA, tenantA));
  expect(ownerBFilter.body.data.properties).toEqual([]);
  expect(ownerBFilter.body.total).toBe(0);
});

test('PII owner et données privées B ne fuient pas vers Admin A', async () => {
  const pending = await request(app).get('/api/properties/status/pending').set(bearer(adminA, tenantA));
  const serialized = JSON.stringify(pending.body);
  expect(serialized).not.toContain(ownerB.email);
  expect(serialized).not.toContain('HZ07-B');
  expect(serialized).not.toContain('777000');
});

test('public, Client et Proprietaire conservent le catalogue public historique', async () => {
  for (const headers of [{}, bearer(client), bearer(ownerA)]) {
    const response = await request(app).get('/api/properties').set(headers);
    expect(response.status).toBe(200);
    expect(new Set(rootIds(response))).toEqual(new Set(expectedIds([propertiesA[1], propertiesB[2]])));
  }
});

test.each(['validate', 'reject'])('la mutation %s cross-tenant est déjà sûre et sans effet', async (action) => {
  const target = propertiesB[0];
  const before = await Property.findById(target._id).lean();
  const notificationCount = await Notification.countDocuments();
  const response = await request(app).patch(`/api/properties/admin/${target._id}/${action}`).set(bearer(adminA, tenantA));
  expect(response.status).toBe(404);
  expect(await Property.findById(target._id).lean()).toEqual(before);
  expect(await Notification.countDocuments()).toBe(notificationCount);
});

test('vente, location, Parcelle, filtres, pagination et tri restent inchangés dans le tenant', async () => {
  const response = await request(app).get('/api/properties?type=Parcelle&page=1&limit=1&sort=-createdAt').set(bearer(adminA, tenantA));
  expect(response.status).toBe(200);
  expect(rootIds(response)).toEqual([String(propertiesA[1]._id)]);
  expect(response.body.total).toBe(1);
});
