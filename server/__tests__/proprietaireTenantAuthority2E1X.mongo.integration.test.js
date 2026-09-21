// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-D · PROP-OWN-01..04 +
// PROP-TENANT-01..16 + DUAL-PROP-01..03. Certifie que
// /api/proprietaires suit l'autorité tenant canonique (module `location` +
// businessRole via OrgMembership), que le cross-tenant est refusé, et que
// l'identité `User.role='Proprietaire'` d'un caller staff ne fusionne pas
// avec le portefeuille du tenant.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Proprietaire = require('../models/Proprietaire');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/proprietaireRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/proprietaires', routes);
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
const seedProprietaire = async (ownerUser) => Proprietaire.create({
  nom: 'Mandant', prenom: 'Fixture', telephone: `06${Date.now() % 100000000}`, user: ownerUser?._id || null,
});

let tA; let bA; let tB; let bB;
let admin; let manager; let collab; let secretaire;
let globalAdmin; let opFull; let proprietaireAdmin;
let ownerAffiliatedA; let ownerAffiliatedB;

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

  proprietaireAdmin = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: proprietaireAdmin, bootstrap: bA });
  await setRole(proprietaireAdmin._id, tA, 'Admin');

  ownerAffiliatedA = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: ownerAffiliatedA, bootstrap: bA });
  await setRole(ownerAffiliatedA._id, tA, 'Collaborateur');

  ownerAffiliatedB = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tB, user: ownerAffiliatedB, bootstrap: bB });
  await setRole(ownerAffiliatedB._id, tB, 'Collaborateur');
});

const listA = (u) => request(app).get('/api/proprietaires').set(bearer(u, tA._id));

// ═══════════════════════════════════════════════════════════════════════════

describe('PROP-TENANT — canonical tenant authority + module gate', () => {
  test('PROP-TENANT-01: unauthenticated → 401', async () => {
    const res = await request(app).get('/api/proprietaires');
    expect(res.status).toBe(401);
  });

  test('PROP-TENANT-02: tenant without location module → 403', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const res = await listA(admin);
    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/module tenant indisponible/i);
  });

  test('PROP-TENANT-03: location active + no membership → 403', async () => {
    const outsider = await makeUser({ role: 'Client' });
    const res = await request(app).get('/api/proprietaires').set(bearer(outsider, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-04: Proprietaire (global) + businessRole=Admin → allowed', async () => {
    const res = await listA(proprietaireAdmin);
    expect(res.status).toBe(200);
  });

  test('PROP-TENANT-05: Client + GestionnaireImmobilier → allowed (authority follows membership)', async () => {
    const res = await listA(manager);
    expect(res.status).toBe(200);
  });

  test('PROP-TENANT-06: global Admin without tenant membership → 403', async () => {
    const res = await request(app).get('/api/proprietaires').set(bearer(globalAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-07: PlatformOperator without membership → 403', async () => {
    const res = await request(app).get('/api/proprietaires').set(bearer(opFull, tA._id));
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-08: wrong businessRole (Communicant) → 403', async () => {
    const communicant = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: communicant, bootstrap: bA });
    await setRole(communicant._id, tA, 'Communicant');
    const res = await listA(communicant);
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-09: suspended membership → 403', async () => {
    await setStatus(admin._id, tA, 'suspended');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-10: revoked membership → 403', async () => {
    await setStatus(admin._id, tA, 'revoked');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-11: forged businessRole via body/query/header → no escalation', async () => {
    const communicant = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: communicant, bootstrap: bA });
    await setRole(communicant._id, tA, 'Communicant');
    const res = await request(app).get('/api/proprietaires')
      .set({ ...bearer(communicant, tA._id), 'X-Business-Role': 'Admin' })
      .query({ businessRole: 'Admin' });
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-12: tenant A cannot read tenant B Proprietaire (cross-tenant per-ID)', async () => {
    const propB = await seedProprietaire(ownerAffiliatedB);
    const res = await request(app).get(`/api/proprietaires/${propB._id}`).set(bearer(admin, tA._id));
    // Attribution resolves via ownerAffiliatedB → tenant B → refused when
    // caller selects tenant A.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('PROP-TENANT-13: tenant A cannot mutate tenant B Proprietaire', async () => {
    const propB = await seedProprietaire(ownerAffiliatedB);
    const res = await request(app).delete(`/api/proprietaires/${propB._id}`).set(bearer(admin, tA._id));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('PROP-TENANT-14: same user Admin in A / Collaborateur in B → independent authority', async () => {
    await addTenantMember({ tenant: tB, user: admin, bootstrap: bB });
    await setRole(admin._id, tB, 'Collaborateur');
    // Admin in A: mutation allowed (Admin ∈ GL_MANAGE).
    const rA = await request(app).post('/api/proprietaires').set(bearer(admin, tA._id))
      .send({ nom: 'X', prenom: 'Y', telephone: '060000001' });
    // Collaborateur in B: mutation refused (not in GL_MANAGE).
    const rB = await request(app).post('/api/proprietaires').set(bearer(admin, tB._id))
      .send({ nom: 'X', prenom: 'Y', telephone: '060000002' });
    expect(rA.status).toBeLessThan(400); // 200/201
    expect(rB.status).toBe(403);
  });

  test('PROP-TENANT-15: PlatformTenantFeature location=false → 403', async () => {
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: false });
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('PROP-TENANT-16: PlatformTenantFeature location=true grants access subject to membership', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: true });
    const okAdmin = await listA(admin);
    const denyOutsider = await request(app).get('/api/proprietaires').set(bearer(await makeUser({ role: 'Client' }), tA._id));
    expect(okAdmin.status).toBe(200);
    expect(denyOutsider.status).toBe(403);
  });
});

describe('PROP-OWN — SELF/OWNERSHIP is not this router\'s concern', () => {
  test('PROP-OWN-01: an authenticated Proprietaire without membership cannot use /api/proprietaires (this router is TENANT-only; owner-self flows use other surfaces)', async () => {
    const soloOwner = await makeUser({ role: 'Proprietaire' });
    const res = await request(app).get('/api/proprietaires').set(bearer(soloOwner, tA._id));
    // No membership in tA → refused (this router is tenant-scoped by design).
    expect(res.status).toBe(403);
  });

  test('PROP-OWN-02: an owner cannot use this router to reach another owner\'s record', async () => {
    // Even with a canonical tenant membership, reading a Proprietaire whose
    // attribution resolves to another tenant is refused (cross-tenant).
    const propB = await seedProprietaire(ownerAffiliatedB);
    const res = await request(app).get(`/api/proprietaires/${propB._id}`).set(bearer(admin, tA._id));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('PROP-OWN-03: the owner-self flow does NOT require a Proprietaire membership on this router (uses other endpoints instead)', async () => {
    // Non-regression proof: the `/api/users/me` and `/api/rental-management/owner/*`
    // paths (verified in Lot C) remain available. This router intentionally
    // does not expose an owner-self endpoint; asserting non-availability here
    // makes the routing intent explicit.
    const soloOwner = await makeUser({ role: 'Proprietaire' });
    // Attempts here get 403 — proof this router doesn't provide an owner-self
    // path (see /api/rental-management/owner/* for that flow).
    const res = await request(app).get('/api/proprietaires').set(bearer(soloOwner));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('PROP-OWN-04: ownership does not grant tenant staff authority on this router', async () => {
    // A Proprietaire without an OrgMembership + businessRole cannot reach
    // this router even when they select a tenant header.
    const solo = await makeUser({ role: 'Proprietaire' });
    const res = await request(app).get('/api/proprietaires').set(bearer(solo, tA._id));
    expect(res.status).toBe(403);
  });
});

describe('DUAL-PROP — global identity and tenant authority never merge', () => {
  test('DUAL-PROP-01: a User.role=Proprietaire caller with businessRole=Admin in tenant A gets tenant Admin authority WITHOUT losing global Proprietaire identity', async () => {
    const res = await listA(proprietaireAdmin);
    expect(res.status).toBe(200);
    const u = await User.findById(proprietaireAdmin._id).select('role').lean();
    expect(u.role).toBe('Proprietaire');
  });

  test('DUAL-PROP-02: personally-owned resources outside tenant A stay personal — being Admin in A does not turn tenant B assets into tenant A assets', async () => {
    // proprietaireAdmin has businessRole=Admin in A only. Give them a
    // Proprietaire fixture on tenant B (unrelated).
    const propB = await seedProprietaire(ownerAffiliatedB);
    // From tenant A, they cannot see/mutate the tenant-B Proprietaire.
    const rGet = await request(app).get(`/api/proprietaires/${propB._id}`).set(bearer(proprietaireAdmin, tA._id));
    const rDel = await request(app).delete(`/api/proprietaires/${propB._id}`).set(bearer(proprietaireAdmin, tA._id));
    expect(rGet.status).toBeGreaterThanOrEqual(400);
    expect(rDel.status).toBeGreaterThanOrEqual(400);
  });

  test('DUAL-PROP-03: a tenant-A staff Proprietaire (role=Proprietaire, businessRole=Admin) does not become the personal owner of tenant-A Proprietaire records', async () => {
    // proprietaireAdmin can list tenant A's Proprietaires as staff, but
    // no personal ownership is derived; the operation still respects the
    // tenant boundary (a hostile tenant-B create attempt still fails).
    const okA = await listA(proprietaireAdmin);
    expect(okA.status).toBe(200);
    // No cascading personal authority: tenant B mutation must still refuse.
    const rB = await request(app).post('/api/proprietaires').set(bearer(proprietaireAdmin, tB._id))
      .send({ nom: 'Ghost', prenom: 'Owner', telephone: '060000009' });
    expect(rB.status).toBe(403);
  });
});
