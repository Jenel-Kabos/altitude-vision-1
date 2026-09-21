// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — final authority matrix.
// PROPERTY-PERSONAL-01..08 + PROPERTY-TENANT-CREATE-01..10 +
// PROPERTY-TENANT-MUTATE-01..08 + PROPERTY-TENANT-MOD-01..05 +
// PROPERTY-PLATFORM-MOD-01..06.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const bearer = (u, tid) => ({
  Authorization: `Bearer ${jwt.sign({ id: u._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tid ? { 'X-Platform-Tenant-Id': String(tid) } : {}),
});
const makeUser = async (over = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  ...over,
});
const setRole = (uid, t, br) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit, status: 'active' }, { $set: { businessRole: br } },
);
const setStatus = (uid, t, status) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit }, { $set: { status } },
);
const buildPropertyPayload = (over = {}) => ({
  title: 'Bien Lot G', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: '150000',
  address: JSON.stringify({ city: 'Brazzaville', arrondissement: 'Poto-Poto' }),
  surface: '80', latitude: '-4.27', longitude: '15.27',
  availability: 'Disponible',
  ...over,
});
// Cloudinary is stubbed at the config layer so multer.array('images') calls
// do not hit the network. The stub preserves the `upload` middleware
// factory used by the routes.
jest.mock('../config/cloudinary', () => {
  const multer = require('multer');
  return {
    upload: multer({ storage: multer.memoryStorage() }),
    uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://example.test/img.png' }),
    destroyFromCloudinary: jest.fn().mockResolvedValue(),
  };
});
const postCreate = (url, user, tenantId, over = {}) => {
  const req = request(app).post(url).set(bearer(user, tenantId));
  const payload = buildPropertyPayload(over);
  Object.entries(payload).forEach(([k, v]) => req.field(k, v));
  req.attach('images', Buffer.from('fake-image'), 'test.png');
  return req;
};
const seedProperty = async ({ owner, tenant = null, overrides = {} }) => Property.create({
  title: 'Bien seed', description: 'Description suffisamment longue pour la validation.',
  pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 150000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
  availability: 'Disponible', latitude: -4.27, longitude: 15.27,
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  isPublished: true,
  owner: owner._id, tenant: tenant?._id || null,
  ...overrides,
});

let tA; let bA; let tB; let bB;
let admin; let manager; let collab;
let ownerP; let ownerQ; let anotherProprietaire;
let globalAdmin; let opNoCap; let opWithCap;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Property Tenant A' });
  const fB = await createTenantFixture({ label: 'Property Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;

  admin = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
  await setRole(admin._id, tA, 'Admin');

  manager = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: manager, bootstrap: bA });
  await setRole(manager._id, tA, 'GestionnaireImmobilier');

  collab = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: collab, bootstrap: bA });
  await setRole(collab._id, tA, 'Collaborateur');

  ownerP = await makeUser({ role: 'Proprietaire' });
  ownerQ = await makeUser({ role: 'Proprietaire' });
  anotherProprietaire = await makeUser({ role: 'Proprietaire' });

  globalAdmin = await makeUser({ role: 'Admin' });
  opNoCap = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opNoCap._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read'] });
  opWithCap = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opWithCap._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read', 'platform.properties.manage'] });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('PROPERTY-PERSONAL — personal ownership contract (POST /, POST /mobile)', () => {
  test('PROPERTY-PERSONAL-01/02: authenticated Proprietaire creates a personal Property (owner=req.user, tenant=null)', async () => {
    const res = await postCreate('/api/properties', ownerP);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const created = res.body.data?.property;
    expect(created).toBeDefined();
    expect(String(created.owner)).toBe(String(ownerP._id));
    expect(created.tenant).toBeNull();
  });

  test('PROPERTY-PERSONAL-03: tenant membership does not alter personal attribution', async () => {
    // proprietaireAdmin is Admin in tenant A. Creating via POST / must still
    // produce a personal Property with tenant=null.
    const proprietaireAdmin = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tA, user: proprietaireAdmin, bootstrap: bA });
    await setRole(proprietaireAdmin._id, tA, 'Admin');
    const res = await postCreate('/api/properties', proprietaireAdmin, tA._id);
    expect(res.status).toBeLessThan(400);
    const created = res.body.data?.property;
    expect(created.tenant).toBeNull();
  });

  test('PROPERTY-PERSONAL-04: forged tenant via body/query/header cannot attribute personal Property', async () => {
    // Forged tenant via body/query/header MUST NOT redirect the personal
    // attribution — the personal POST / route does not compose any tenant
    // context middleware, so `req.platformTenant` remains undefined.
    const req0 = request(app).post('/api/properties')
      .set({ ...bearer(ownerP), 'X-Platform-Tenant-Id': String(tA._id), 'X-Tenant-Id': String(tA._id) })
      .query({ tenant: String(tA._id) });
    Object.entries(buildPropertyPayload({ tenant: String(tA._id) })).forEach(([k, v]) => req0.field(k, v));
    req0.attach('images', Buffer.from('fake'), 'test.png');
    const res = await req0;
    expect(res.status).toBeLessThan(400);
    const created = res.body.data?.property;
    expect(created.tenant).toBeNull();
  });

  test('PROPERTY-PERSONAL-05: owner can update own personal Property', async () => {
    const personal = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).put(`/api/properties/${personal._id}`).set(bearer(ownerP)).send({ title: 'Renommé' });
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-PERSONAL-06: owner can delete own personal Property (subject to controller lifecycle rules)', async () => {
    const personal = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).delete(`/api/properties/${personal._id}`).set(bearer(ownerP));
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-PERSONAL-07: global Admin cannot mutate another user\'s tenant=null Property', async () => {
    const personal = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).put(`/api/properties/${personal._id}`).set(bearer(globalAdmin)).send({ title: 'Hack' });
    expect(res.status).toBe(403);
    // Also: DELETE refused.
    const delRes = await request(app).delete(`/api/properties/${personal._id}`).set(bearer(globalAdmin));
    expect(delRes.status).toBe(403);
  });

  test('PROPERTY-PERSONAL-08: tenant Admin cannot mutate another user\'s tenant=null Property', async () => {
    const personal = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).put(`/api/properties/${personal._id}`).set(bearer(admin, tA._id)).send({ title: 'Hack' });
    expect(res.status).toBe(403);
  });
});

describe('PROPERTY-TENANT-CREATE — POST /portfolio (new)', () => {
  test('PROPERTY-TENANT-CREATE-01: unauthenticated → 401', async () => {
    const res = await request(app).post('/api/properties/portfolio');
    expect(res.status).toBe(401);
  });

  test('PROPERTY-TENANT-CREATE-02: missing immobilier module → 403', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const res = await postCreate('/api/properties/portfolio', admin, tA._id);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-CREATE-03: no membership → 403', async () => {
    const outsider = await makeUser({ role: 'Client' });
    const res = await postCreate('/api/properties/portfolio', outsider, tA._id);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-CREATE-04: wrong businessRole (Secretaire) → 403', async () => {
    const sec = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: sec, bootstrap: bA });
    await setRole(sec._id, tA, 'Secretaire');
    const res = await postCreate('/api/properties/portfolio', sec, tA._id);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-CREATE-05: Admin → ALLOW + Property.tenant = req.platformTenant._id', async () => {
    const res = await postCreate('/api/properties/portfolio', admin, tA._id);
    expect(res.status).toBeLessThan(400);
    const created = res.body.data?.property;
    expect(String(created.tenant)).toBe(String(tA._id));
  });

  test('PROPERTY-TENANT-CREATE-06: GestionnaireImmobilier → ALLOW', async () => {
    const res = await postCreate('/api/properties/portfolio', manager, tA._id);
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-TENANT-CREATE-07: Collaborateur → ALLOW', async () => {
    const res = await postCreate('/api/properties/portfolio', collab, tA._id);
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-TENANT-CREATE-08/09: forged tenant body/query cannot redirect attribution', async () => {
    const req0 = request(app).post('/api/properties/portfolio')
      .set(bearer(admin, tA._id))
      .query({ tenant: String(tB._id) });
    Object.entries(buildPropertyPayload({ tenant: String(tB._id) })).forEach(([k, v]) => req0.field(k, v));
    req0.attach('images', Buffer.from('fake'), 'test.png');
    const res = await req0;
    expect(res.status).toBeLessThan(400);
    const created = res.body.data?.property;
    // Attribution is exclusively `req.platformTenant._id` (from header),
    // never body or query.
    expect(String(created.tenant)).toBe(String(tA._id));
  });

  test('PROPERTY-TENANT-CREATE-10: Tenant A membership cannot create into Tenant B', async () => {
    // admin has membership only in A. Selecting tenant B: no membership → 403.
    const res = await postCreate('/api/properties/portfolio', admin, tB._id);
    expect(res.status).toBe(403);
  });
});

describe('PROPERTY-TENANT-MUTATE — PUT/DELETE /:id tenant staff branch', () => {
  test('PROPERTY-TENANT-MUTATE-01: Tenant Admin can mutate a tenant-A Property', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(admin, tA._id)).send({ title: 'Update A' });
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-TENANT-MUTATE-02: Tenant A Admin cannot mutate a Tenant B Property', async () => {
    const propB = await seedProperty({ owner: ownerP, tenant: tB });
    const res = await request(app).put(`/api/properties/${propB._id}`).set(bearer(admin, tA._id)).send({ title: 'Cross-tenant' });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MUTATE-03: GestionnaireImmobilier can mutate — canonical matrix', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(manager, tA._id)).send({ title: 'Gest update' });
    expect(res.status).toBeLessThan(400);
  });

  test('PROPERTY-TENANT-MUTATE-04: Collaborateur cannot mutate (not in canonical mutate set)', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(collab, tA._id)).send({ title: 'Collab update' });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MUTATE-05: global Admin without tenant membership has no bypass', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(globalAdmin)).send({ title: 'Hack' });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MUTATE-06: PlatformOperator without tenant membership has no implicit bypass', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(opWithCap, tA._id)).send({ title: 'Op hack' });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MUTATE-07: suspended membership → DENY', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    await setStatus(admin._id, tA, 'suspended');
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(admin, tA._id)).send({ title: 'Suspended' });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MUTATE-08: revoked membership → DENY', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    await setStatus(admin._id, tA, 'revoked');
    const res = await request(app).put(`/api/properties/${propA._id}`).set(bearer(admin, tA._id)).send({ title: 'Revoked' });
    expect(res.status).toBe(403);
  });
});

describe('PROPERTY-TENANT-MOD — pending queue + admin validate/reject', () => {
  test('PROPERTY-TENANT-MOD-01: Tenant Admin can list pending on their tenant', async () => {
    const res = await request(app).get('/api/properties/status/pending').set(bearer(admin, tA._id));
    expect(res.status).toBe(200);
  });

  test('PROPERTY-TENANT-MOD-03: Tenant A Admin cannot validate/reject a Tenant B property', async () => {
    const propB = await seedProperty({ owner: ownerP, tenant: tB, overrides: { statusAdmin: 'En attente', isPublished: false } });
    const res = await request(app).patch(`/api/properties/admin/${propB._id}/validate`).set(bearer(admin, tA._id));
    // Cross-tenant: either 403 module/role, 404 attribution-refuse, or 4xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('PROPERTY-TENANT-MOD-04: GestionnaireImmobilier cannot perform Admin moderation', async () => {
    const propA = await seedProperty({ owner: ownerP, tenant: tA, overrides: { statusAdmin: 'En attente' } });
    const res = await request(app).patch(`/api/properties/admin/${propA._id}/validate`).set(bearer(manager, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-MOD-05: global Admin alone cannot bypass tenant moderation', async () => {
    const res = await request(app).get('/api/properties/status/pending').set(bearer(globalAdmin));
    expect(res.status).toBe(403);
  });
});

describe('PROPERTY-PLATFORM-MOD — global marketplace recommandé flag', () => {
  test('PROPERTY-PLATFORM-MOD-01: Tenant Admin cannot mark globally recommended', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).patch(`/api/properties/${prop._id}/recommande`).set(bearer(admin, tA._id)).send({ recommande: true });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-PLATFORM-MOD-02: global Admin without PlatformOperator cannot mark globally recommended', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).patch(`/api/properties/${prop._id}/recommande`).set(bearer(globalAdmin)).send({ recommande: true });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-PLATFORM-MOD-03: PlatformOperator without exact capability cannot mark globally recommended', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).patch(`/api/properties/${prop._id}/recommande`).set(bearer(opNoCap)).send({ recommande: true });
    expect(res.status).toBe(403);
  });

  test('PROPERTY-PLATFORM-MOD-04: Admin + active PlatformOperator + platform.properties.manage → allowed (not 403)', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).patch(`/api/properties/${prop._id}/recommande`).set(bearer(opWithCap)).send({ recommande: true });
    // Authority passes; controller may return 200 or higher status depending
    // on downstream validation, but never 403 for the authority reason.
    expect(res.status).not.toBe(403);
  });

  test('PROPERTY-PLATFORM-MOD-05: platform moderation does not alter Property.tenant', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: tA });
    const before = await Property.findById(prop._id).select('tenant owner').lean();
    await request(app).patch(`/api/properties/${prop._id}/recommande`).set(bearer(opWithCap)).send({ recommande: true });
    const after = await Property.findById(prop._id).select('tenant owner').lean();
    expect(String(after.tenant || '')).toBe(String(before.tenant || ''));
    expect(String(after.owner)).toBe(String(before.owner));
  });

  test('PROPERTY-PLATFORM-MOD-06: platform moderation cannot silently transfer ownership', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    const before = await Property.findById(prop._id).select('owner').lean();
    // Try to sneak an owner change via body — the controller must ignore it.
    await request(app).patch(`/api/properties/${prop._id}/recommande`)
      .set(bearer(opWithCap))
      .send({ recommande: true, owner: String(ownerQ._id) });
    const after = await Property.findById(prop._id).select('owner').lean();
    expect(String(after.owner)).toBe(String(before.owner));
  });
});

describe('PROPERTY-STATIC — legacy User.role tenant-authority scan', () => {
  test('Migrated routes have no live `req.user.role === "Admin"` bypass reachable via /:id mutate', async () => {
    // globalAdmin has User.role='Admin' but no membership. On a tenant-attributed
    // property they must be refused.
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const putRes = await request(app).put(`/api/properties/${propA._id}`).set(bearer(globalAdmin, tA._id)).send({ title: 'x' });
    const delRes = await request(app).delete(`/api/properties/${propA._id}`).set(bearer(globalAdmin, tA._id));
    expect(putRes.status).toBe(403);
    expect(delRes.status).toBe(403);
  });
});
