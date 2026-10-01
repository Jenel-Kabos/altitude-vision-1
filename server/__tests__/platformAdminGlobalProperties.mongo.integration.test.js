const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const bearer = (user, tenant = null) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id || tenant) } : {}),
});

let sequence = 0;
const makeUser = ({ role = 'Client', label = 'user' } = {}) => {
  sequence += 1;
  return User.create({
    name: `PA03 ${label}`,
    email: `pa03-${label}-${sequence}-${Date.now()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
    isEmailVerified: true,
  });
};

const propertyPayload = ({ title, owner, tenant = null, status = 'vente', type = 'Villa', city = 'Brazzaville', price, createdAt }) => ({
  title,
  description: `${title} description administrative complète`,
  pole: 'Altimmo',
  type,
  status,
  statusAdmin: title.includes('B1') ? 'En attente' : 'Validée',
  isPublished: !title.includes('B1'),
  availability: 'Disponible',
  price,
  owner,
  tenant,
  address: { city, arrondissement: title.includes('U1') ? 'Indépendante' : 'Centre' },
  latitude: -4.26,
  longitude: 15.24,
  images: ['https://example.test/property.jpg'],
  surface: 80,
  createdAt,
  updatedAt: createdAt,
});

let tenantA;
let tenantB;
let tenantAdminA;
let tenantAdminB;
let ownerA;
let ownerB;
let independentOwner;
let reader;
let wrongCapability;
let inactiveOperator;
let partialReader;
let legacyAdmin;
let propertyA1;
let propertyA2;
let propertyB1;
let propertyU1;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PA03 Tenant A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'PA03 Tenant B', withAdminMembership: true });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  tenantAdminA = fixtureA.bootstrap;
  tenantAdminB = fixtureB.bootstrap;
  ownerA = tenantAdminA;
  ownerB = tenantAdminB;
  independentOwner = await makeUser({ role: 'Proprietaire', label: 'independent-owner' });

  [propertyA1, propertyA2, propertyB1, propertyU1] = await Property.create([
    propertyPayload({ title: 'A1 Villa Centrale', owner: ownerA._id, tenant: tenantA._id, price: 400000, createdAt: new Date('2026-01-01T00:00:00.000Z') }),
    propertyPayload({ title: 'A2 Appartement Pointe-Noire', owner: ownerA._id, tenant: tenantA._id, status: 'location', type: 'Appartement', city: 'Pointe-Noire', price: 100000, createdAt: new Date('2026-02-01T00:00:00.000Z') }),
    propertyPayload({ title: 'B1 Villa En Attente', owner: ownerB._id, tenant: tenantB._id, price: 300000, createdAt: new Date('2026-03-01T00:00:00.000Z') }),
    propertyPayload({ title: 'U1 Maison Indépendante', owner: independentOwner._id, type: 'Maison', price: 200000, createdAt: new Date('2026-04-01T00:00:00.000Z') }),
  ]);

  reader = await makeUser({ label: 'properties-reader' });
  wrongCapability = await makeUser({ label: 'wrong-capability' });
  inactiveOperator = await makeUser({ label: 'inactive-operator' });
  partialReader = await makeUser({ label: 'partial-reader' });
  legacyAdmin = await makeUser({ role: 'Admin', label: 'legacy-admin' });
  // PLATFORM-ADMIN-04A — le registre global relève de la Vue plateforme :
  // lecteur éligible (toutes les capabilities requises, dont properties.read).
  await grantOperator({ userId: reader._id, actor: tenantAdminA, reason: 'PA03 read', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  await grantOperator({ userId: partialReader._id, actor: tenantAdminA, reason: 'PA04A partial reader', capabilities: ['platform.properties.read'] });
  await grantOperator({ userId: wrongCapability._id, actor: tenantAdminA, reason: 'PA03 wrong capability', capabilities: ['platform.users.read'] });
  await grantOperator({ userId: inactiveOperator._id, actor: tenantAdminA, reason: 'PA03 inactive', capabilities: ['platform.properties.read'] });
  await PlatformOperator.updateOne({ user: inactiveOperator._id }, { $set: { status: 'suspended' } });
});

afterAll(async () => stopFinancialMongo());

const registry = (query = '') => `/api/properties?dashboardRegistry=1${query ? `&${query}` : ''}`;
const ids = (res) => res.body.data.properties.map((item) => String(item._id));

describe('PLATFORM-ADMIN-03 — authority and property populations', () => {
  test('active properties reader sees Tenant A, Tenant B and tenant:null exactly once', async () => {
    const res = await request(app).get(registry('limit=20')).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expect.arrayContaining([
      String(propertyA1._id), String(propertyA2._id), String(propertyB1._id), String(propertyU1._id),
    ]));
    expect(new Set(ids(res)).size).toBe(ids(res).length);
  });

  test('PA-04A — properties.read seul (opérateur partiel) ne donne plus accès au registre global', async () => {
    const res = await request(app).get(registry()).set(bearer(partialReader));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
  });

  test('wrong capability, inactive operator and legacy Admin are denied globally', async () => {
    const [wrong, inactive, admin] = await Promise.all([
      request(app).get(registry()).set(bearer(wrongCapability)),
      request(app).get(registry()).set(bearer(inactiveOperator)),
      request(app).get(registry()).set(bearer(legacyAdmin)),
    ]);
    expect([wrong.status, inactive.status, admin.status]).toEqual([403, 403, 403]);
  });

  test('Tenant A and Tenant B remain isolated and neither receives tenant:null', async () => {
    const [a, b] = await Promise.all([
      request(app).get(registry('limit=20')).set(bearer(tenantAdminA, tenantA)),
      request(app).get(registry('limit=20')).set(bearer(tenantAdminB, tenantB)),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(ids(a)).toEqual(expect.arrayContaining([String(propertyA1._id), String(propertyA2._id)]));
    expect(ids(a)).not.toEqual(expect.arrayContaining([String(propertyB1._id), String(propertyU1._id)]));
    expect(ids(b)).toEqual([String(propertyB1._id)]);
    expect(ids(b)).not.toContain(String(propertyU1._id));
  });

  test('Tenant Admin without an explicit tenant remains auto-resolved to its sole tenant, never global', async () => {
    const res = await request(app).get(registry()).set(bearer(tenantAdminA));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expect.arrayContaining([String(propertyA1._id), String(propertyA2._id)]));
    expect(ids(res)).not.toEqual(expect.arrayContaining([String(propertyB1._id), String(propertyU1._id)]));
  });

  test('a caller tenant query cannot override the server-resolved tenant', async () => {
    const res = await request(app).get(registry(`tenant=${tenantB._id}&limit=20`)).set(bearer(tenantAdminA, tenantA));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expect.arrayContaining([String(propertyA1._id), String(propertyA2._id)]));
    expect(ids(res)).not.toContain(String(propertyB1._id));
  });
});

describe('PLATFORM-ADMIN-03 — bounded server query contract', () => {
  test('returns reliable page metadata and second page rows', async () => {
    const res = await request(app).get(registry('page=2&limit=2&sort=oldest')).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
    expect(ids(res)).toEqual([String(propertyB1._id), String(propertyU1._id)]);
  });

  test('search is server-side and escaped through the existing search contract', async () => {
    const res = await request(app).get(registry('search=Ind%C3%A9pendante&limit=20')).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([String(propertyU1._id)]);
    expect(res.body.data.total).toBe(1);
  });

  test.each([
    ['offerType=location', () => [String(propertyA2._id)]],
    ['propertyType=Maison', () => [String(propertyU1._id)]],
    ['city=Pointe-Noire', () => [String(propertyA2._id)]],
  ])('filter %s is applied before total and pagination', async (query, expected) => {
    const res = await request(app).get(registry(`${query}&limit=20`)).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expected());
    expect(res.body.data.total).toBe(1);
  });

  test.each([
    ['newest', () => [propertyU1, propertyB1, propertyA2, propertyA1]],
    ['oldest', () => [propertyA1, propertyA2, propertyB1, propertyU1]],
    ['title', () => [propertyA1, propertyA2, propertyB1, propertyU1]],
    ['priceAsc', () => [propertyA2, propertyU1, propertyB1, propertyA1]],
    ['priceDesc', () => [propertyA1, propertyB1, propertyU1, propertyA2]],
    ['status', () => [propertyB1, propertyA1, propertyA2, propertyU1]],
  ])('sort %s maps to a fixed ordering', async (sort, expected) => {
    const res = await request(app).get(registry(`sort=${sort}&limit=20`)).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expected().map((item) => String(item._id)));
  });

  test.each(['sort=owner.password', 'page=0', 'page=abc', 'limit=101'])('rejects invalid registry query %s', async (query) => {
    const res = await request(app).get(registry(query)).set(bearer(reader));
    expect(res.status).toBe(400);
  });
});

describe('PLATFORM-ADMIN-03 — safe display projection', () => {
  test('projects only safe owner and tenant display fields and preserves tenant:null', async () => {
    const res = await request(app).get(registry('limit=20&sort=oldest')).set(bearer(reader));
    expect(res.status).toBe(200);
    const a1 = res.body.data.properties.find((item) => String(item._id) === String(propertyA1._id));
    const u1 = res.body.data.properties.find((item) => String(item._id) === String(propertyU1._id));
    expect(a1.owner).toEqual({ _id: String(ownerA._id), name: ownerA.name });
    expect(a1.tenant).toEqual(expect.objectContaining({
      _id: String(tenantA._id), name: tenantA.name, status: tenantA.status,
    }));
    expect(Object.keys(a1.tenant).sort()).toEqual(['_id', 'name', 'status']);
    expect(u1.owner).toEqual({ _id: String(independentOwner._id), name: independentOwner.name });
    expect(u1.tenant).toBeNull();

    const serialized = JSON.stringify(res.body.data.properties);
    [
      'password', 'passwordResetToken', 'passwordResetExpires',
      'emailVerificationToken', 'tokenVersion', 'pushToken',
      'capabilities', 'secret', 'refreshToken',
    ].forEach((forbidden) => expect(serialized).not.toContain(`"${forbidden}"`));
  });

  test('keeps a property visible with null display fallbacks when referenced documents are missing', async () => {
    const dangling = await Property.create(propertyPayload({
      title: 'Z1 Références absentes',
      owner: new (require('mongoose').Types.ObjectId)(),
      tenant: new (require('mongoose').Types.ObjectId)(),
      price: 500000,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    }));
    try {
      const res = await request(app).get(registry('search=R%C3%A9f%C3%A9rences&limit=20')).set(bearer(reader));
      expect(res.status).toBe(200);
      const row = res.body.data.properties.find((item) => String(item._id) === String(dangling._id));
      expect(row).toBeDefined();
      expect(row.owner).toBeNull();
      expect(row.tenant).toBeNull();
    } finally {
      await Property.deleteOne({ _id: dangling._id });
    }
  });
});
