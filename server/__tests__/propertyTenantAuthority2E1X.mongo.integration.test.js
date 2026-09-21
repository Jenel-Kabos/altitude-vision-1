// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-E — Property authority matrix.
// Only `GET /portfolio` is migrated in Lot E (the sole clean TENANT
// endpoint on this router). Ownership, PUBLIC, MIXED, MODERATION paths are
// deferred with documented classification — the tests below verify that
// the migrated endpoint enforces the canonical chain and that ownership /
// public flows still work.

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

jest.setTimeout(180000);

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
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true,
  ...over,
});
const setRole = (uid, t, br) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit, status: 'active' }, { $set: { businessRole: br } },
);
const setStatus = (uid, t, status) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit }, { $set: { status } },
);
const seedProperty = async ({ owner, tenant, overrides = {} }) => Property.create({
  title: 'Bien Prop', description: 'Description suffisamment longue pour la validation.',
  pole: 'Altimmo', type: 'Appartement', status: overrides.status || 'vente', price: 150000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
  availability: 'Disponible', latitude: -4.27, longitude: 15.27,
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  isPublished: overrides.isPublished !== undefined ? overrides.isPublished : true,
  owner: owner._id, tenant: tenant?._id || null,
  ...overrides,
});

let tA; let bA; let tB; let bB;
let admin; let manager; let collab; let secretaire;
let globalAdmin; let opFull; let ownerP;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Prop Tenant A' });
  const fB = await createTenantFixture({ label: 'Prop Tenant B' });
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

  secretaire = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: secretaire, bootstrap: bA });
  await setRole(secretaire._id, tA, 'Secretaire');

  globalAdmin = await makeUser({ role: 'Admin' });
  opFull = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opFull._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read', 'platform.users.read', 'platform.users.manage'] });

  ownerP = await makeUser({ role: 'Proprietaire' });
});

const portfolioA = (u) => request(app).get('/api/properties/portfolio').set(bearer(u, tA._id));

// ═══════════════════════════════════════════════════════════════════════════

describe('PROPERTY-TENANT — migrated /portfolio endpoint', () => {
  test('PROPERTY-TENANT-01: unauthenticated → 401', async () => {
    const res = await request(app).get('/api/properties/portfolio');
    expect(res.status).toBe(401);
  });

  test('PROPERTY-TENANT-02: tenant without immobilier module → 403', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const res = await portfolioA(admin);
    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/module tenant indisponible/i);
  });

  test('PROPERTY-TENANT-03: module active + no membership → 403', async () => {
    const outsider = await makeUser({ role: 'Client' });
    const res = await request(app).get('/api/properties/portfolio').set(bearer(outsider, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-04: Proprietaire (global) + businessRole=Admin → allowed', async () => {
    const proprietaireAdmin = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tA, user: proprietaireAdmin, bootstrap: bA });
    await setRole(proprietaireAdmin._id, tA, 'Admin');
    const res = await portfolioA(proprietaireAdmin);
    expect(res.status).toBe(200);
    // Global identity preserved
    const u = await User.findById(proprietaireAdmin._id).select('role').lean();
    expect(u.role).toBe('Proprietaire');
  });

  test('PROPERTY-TENANT-05: Client + GestionnaireImmobilier → allowed (authority follows membership)', async () => {
    const res = await portfolioA(manager);
    expect(res.status).toBe(200);
  });

  test('PROPERTY-TENANT-06: global Admin without membership → 403', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(globalAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-07: PlatformOperator without membership → 403', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(opFull, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-08: wrong businessRole (Secretaire) → 403', async () => {
    const res = await portfolioA(secretaire);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-09: suspended membership → 403', async () => {
    await setStatus(admin._id, tA, 'suspended');
    const res = await portfolioA(admin);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-10: revoked membership → 403', async () => {
    await setStatus(admin._id, tA, 'revoked');
    const res = await portfolioA(admin);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-11: forged businessRole via body/query/header → no escalation', async () => {
    const res = await request(app).get('/api/properties/portfolio')
      .set({ ...bearer(secretaire, tA._id), 'X-Business-Role': 'Admin' })
      .query({ businessRole: 'Admin' });
    expect(res.status).toBe(403); // still refused despite forged headers
  });

  test('PROPERTY-TENANT-14: same user Admin in A / Collaborateur in B → independent authority', async () => {
    await addTenantMember({ tenant: tB, user: admin, bootstrap: bB });
    await setRole(admin._id, tB, 'Collaborateur');
    const okA = await request(app).get('/api/properties/portfolio').set(bearer(admin, tA._id));
    const okB = await request(app).get('/api/properties/portfolio').set(bearer(admin, tB._id));
    // Both are in the read set, so both are 200 — but the portfolio content
    // (checked below in PROPERTY-MULTI) is tenant-scoped.
    expect(okA.status).toBe(200);
    expect(okB.status).toBe(200);
  });

  test('PROPERTY-TENANT-15: PlatformTenantFeature immobilier=false → 403', async () => {
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'immobilier', enabled: false });
    const res = await portfolioA(admin);
    expect(res.status).toBe(403);
  });

  test('PROPERTY-TENANT-16: PlatformTenantFeature immobilier=true grants access subject to membership', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'immobilier', enabled: true });
    const okAdmin = await portfolioA(admin);
    const denyOutsider = await request(app).get('/api/properties/portfolio').set(bearer(await makeUser({ role: 'Client' }), tA._id));
    expect(okAdmin.status).toBe(200);
    expect(denyOutsider.status).toBe(403);
  });
});

describe('PROPERTY-OWN — ownership + public flows preserved (non-migrated paths)', () => {
  test('PROPERTY-OWN-01: an owner can list their own properties via /my-properties (protect + controller filter)', async () => {
    await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).get('/api/properties/my-properties').set(bearer(ownerP));
    expect(res.status).toBe(200);
  });

  test('PROPERTY-OWN-03: ownership path does not require a tenant OrgMembership', async () => {
    // ownerP has no membership anywhere. /my-properties still 200.
    const memberships = await OrgMembership.countDocuments({ user: ownerP._id });
    expect(memberships).toBe(0);
    const res = await request(app).get('/api/properties/my-properties').set(bearer(ownerP));
    expect(res.status).toBe(200);
  });

  test('PROPERTY-OWN-04: ownership does not grant tenant staff authority on /portfolio', async () => {
    await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).get('/api/properties/portfolio').set(bearer(ownerP, tA._id));
    expect(res.status).toBe(403); // no membership → tenant path refuses
  });

  test('PROPERTY-OWN-05: tenant Admin membership does not turn a personal property into a tenant property', async () => {
    // proprietaireAdmin is tenant A Admin AND owns a PERSONAL property (no
    // tenant attribution). Their global identity stays Proprietaire, and the
    // personal property remains unattached to tenant A.
    const proprietaireAdmin = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tA, user: proprietaireAdmin, bootstrap: bA });
    await setRole(proprietaireAdmin._id, tA, 'Admin');
    const personal = await seedProperty({ owner: proprietaireAdmin, tenant: null });
    // Ownership self-list still shows it
    const own = await request(app).get('/api/properties/my-properties').set(bearer(proprietaireAdmin));
    expect(own.status).toBe(200);
    // The property record itself has tenant=null (personal), NOT tA._id.
    const fresh = await Property.findById(personal._id).select('tenant owner').lean();
    expect(fresh.tenant).toBeNull();
    expect(String(fresh.owner)).toBe(String(proprietaireAdmin._id));
  });
});

describe('PROPERTY-MULTI — multi-tenant + personal property attribution', () => {
  test('PROPERTY-MULTI-01/02/03/04/05/06: portfolio isolation across tenants and personal', async () => {
    // ownerP is a member of both tenants (Collaborateur in each), which
    // exercises the multi-tenant attribution.
    await addTenantMember({ tenant: tA, user: ownerP, bootstrap: bA });
    await setRole(ownerP._id, tA, 'Collaborateur');
    await addTenantMember({ tenant: tB, user: ownerP, bootstrap: bB });
    await setRole(ownerP._id, tB, 'Collaborateur');

    // Seed three properties: A (attribué à tA), B (attribué à tB), C (perso).
    const propA = await seedProperty({ owner: ownerP, tenant: tA });
    const propB = await seedProperty({ owner: ownerP, tenant: tB });
    const propC = await seedProperty({ owner: ownerP, tenant: null });

    // Tenant A staff (admin) reads portfolio: only propA appears.
    const resA = await portfolioA(admin);
    expect(resA.status).toBe(200);
    const propertyIds = (resA.body.data?.items || []).map((p) => String(p._id));
    expect(propertyIds).toContain(String(propA._id));
    // Property B (attribué à tB) never leaks into tenant A's portfolio:
    expect(propertyIds).not.toContain(String(propB._id));
    // Property C (personal, no tenant attribution) does not leak into tenant
    // A's portfolio just because its owner has a membership in A:
    expect(propertyIds).not.toContain(String(propC._id));
  });
});

describe('PROPERTY endpoint classification — deferred paths still accessible', () => {
  test('MIXED — POST / (create) still accepts a Proprietaire via restrictTo', async () => {
    // The MIXED classification is documented; the route contract is
    // preserved verbatim. This spot-check asserts we did not accidentally
    // break the creation path.
    const res = await request(app).post('/api/properties')
      .set(bearer(ownerP))
      .field('title', 'Bien créé').field('description', 'Description valide bien longue pour passer la validation.')
      .field('pole', 'Altimmo').field('type', 'Appartement').field('status', 'vente').field('price', '150000')
      .field('surface', '80').field('address', JSON.stringify({ city: 'Brazzaville', arrondissement: 'Poto-Poto' }))
      .field('latitude', '-4.27').field('longitude', '15.27');
    // Whatever the controller decides (400 for validation, 201 for success),
    // it is NOT a 403 — the route still authorises a Proprietaire.
    expect(res.status).not.toBe(403);
  });

  test('MODERATION — PATCH /admin/:id/:action still requires User.role=Admin (deferred)', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    // A Client without global Admin → 403 (restrictTo still active).
    const client = await makeUser({ role: 'Client' });
    const res = await request(app).patch(`/api/properties/admin/${prop._id}/validate`).set(bearer(client));
    expect(res.status).toBe(403);
  });

  test('PUBLIC — GET /:id remains publicly readable', async () => {
    const prop = await seedProperty({ owner: ownerP, tenant: null });
    const res = await request(app).get(`/api/properties/${prop._id}`);
    expect([200, 404]).toContain(res.status); // controller decides visibility
  });

  test('PUBLIC — GET /latest and /recommended remain unauthenticated', async () => {
    const r1 = await request(app).get('/api/properties/latest');
    const r2 = await request(app).get('/api/properties/recommended');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
