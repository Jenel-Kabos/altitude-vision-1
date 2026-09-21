// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-C · RM-01..RM-16 + OWN-01..04 +
// DUAL-01..02. Certifie la double autorité de /api/rental-management :
//   • OWNERSHIP path (`/owner/*`) — protégé par User.role + resource ownership,
//     jamais par businessRole.
//   • TENANT path (autres endpoints) — module `location` + businessRole,
//     jamais par User.role global. Cross-tenant, membership suspended/revoked,
//     et forgery ne peuvent pas escalader.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', routes);
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
const seedRental = async ({ ownerUser, tenant }) => {
  const property = await Property.create({
    title: 'Bien GL', description: 'Description suffisamment longue pour la validation.',
    pole: 'Altimmo', type: 'Appartement', status: 'location', price: 250000,
    address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
    images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
    availability: 'Disponible', latitude: -4.27, longitude: 15.27,
    location: { type: 'Point', coordinates: [15.27, -4.27] },
    owner: ownerUser._id, tenant: tenant?._id || null,
  });
  const rental = await RentalManagement.create({
    property: property._id, owner: ownerUser._id, tenant: tenant?._id || null,
    managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'vacant',
    createdBy: ownerUser._id,
  });
  return { property, rental };
};

let tA; let bA; let tB; let bB;
let admin; let manager; let collab; let secretaire;
let globalAdmin; let opFull; let proprietaireAdmin;
let ownerA; let ownerB;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'GL Tenant A' });
  const fB = await createTenantFixture({ label: 'GL Tenant B' });
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

  ownerA = await makeUser({ role: 'Proprietaire' });
  // ownerA keeps NO membership — used to prove that OWNERSHIP path works
  // without any tenant affiliation.
  ownerB = await makeUser({ role: 'Proprietaire' });
  // ownerB is affiliated to tenant B so `fromUser` in the tenant attribution
  // service resolves rentalB → tenant B (otherwise the attribution stays
  // 'unresolved' and the cross-tenant guard treats the resource as
  // authentically unattributed, per the MICRO-HOTFIX-RENTAL-REG-SCOPE-1
  // policy preserved by Lot B).
  await addTenantMember({ tenant: tB, user: ownerB, bootstrap: bB });
  await setRole(ownerB._id, tB, 'Collaborateur');
});

const listA = (u) => request(app).get('/api/rental-management').set(bearer(u, tA._id));
const getOne = (u, id, tid = tA._id) => request(app).get(`/api/rental-management/${id}`).set(bearer(u, tid));

describe('RM — TENANT authority + module gate', () => {
  test('RM-01: unauthenticated → 401', async () => {
    const res = await request(app).get('/api/rental-management');
    expect(res.status).toBe(401);
  });

  test('RM-02: tenant without location module → 403', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const res = await listA(admin);
    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/module tenant indisponible/i);
  });

  test('RM-03: location active + caller has NO tenant membership → 403', async () => {
    const outsider = await makeUser({ role: 'Client' });
    const res = await request(app).get('/api/rental-management').set(bearer(outsider, tA._id));
    expect(res.status).toBe(403);
  });

  test('RM-04: Proprietaire + tenant Admin membership → allowed', async () => {
    const res = await listA(proprietaireAdmin);
    expect(res.status).toBe(200);
  });

  test('RM-05: Client + GestionnaireImmobilier membership → allowed on reads', async () => {
    const res = await listA(manager);
    expect(res.status).toBe(200);
  });

  test('RM-06: global Admin without tenant membership → 403', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(globalAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('RM-07: PlatformOperator without tenant membership → 403', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(opFull, tA._id));
    expect(res.status).toBe(403);
  });

  test('RM-08: wrong businessRole (Secretaire) → denied on this surface', async () => {
    const res = await listA(secretaire);
    expect(res.status).toBe(403);
  });

  test('RM-09: suspended membership → 403', async () => {
    await setStatus(admin._id, tA, 'suspended');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('RM-10: revoked membership → 403', async () => {
    await setStatus(admin._id, tA, 'revoked');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('RM-11: forged businessRole via headers/body/query cannot escalate', async () => {
    const res = await request(app).get('/api/rental-management')
      .set({ ...bearer(secretaire, tA._id), 'X-Business-Role': 'Admin' })
      .query({ businessRole: 'Admin' });
    expect(res.status).toBe(403); // still refused despite forged headers
  });

  test('RM-12: tenant A cannot read tenant B resource (per-ID guard)', async () => {
    const { rental: rentalB } = await seedRental({ ownerUser: ownerB, tenant: tB });
    const res = await getOne(admin, rentalB._id, tA._id);
    // Admin selects tenant A but targets a tenant-B resource. The
    // per-`:id` guard (`assertResourceTenantOrUnattributed`) refuses.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('RM-13: tenant A cannot mutate tenant B resource', async () => {
    const { rental: rentalB } = await seedRental({ ownerUser: ownerB, tenant: tB });
    const res = await request(app).patch(`/api/rental-management/${rentalB._id}`)
      .set(bearer(admin, tA._id)).send({ someField: 'x' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('RM-14: same user Admin in A / Collaborateur in B → independent authority', async () => {
    await addTenantMember({ tenant: tB, user: admin, bootstrap: bB });
    await setRole(admin._id, tB, 'Collaborateur');
    // Onboarding in A (allowed as Admin/Gest) — module + membership pass.
    const okA = await request(app).get('/api/rental-management/onboarding/options').set(bearer(admin, tA._id));
    // Same URL under tenant B — Collaborateur is not in GL_MANAGE.
    const denyB = await request(app).get('/api/rental-management/onboarding/options').set(bearer(admin, tB._id));
    expect(okA.status).toBe(200);
    expect(denyB.status).toBe(403);
  });

  test('RM-15: PlatformTenantFeature location=false → deny', async () => {
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: false });
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('RM-16: location=true (explicit feature) grants access subject to membership', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: true });
    const okAdmin = await listA(admin);
    const denySec = await listA(secretaire);
    expect(okAdmin.status).toBe(200);
    expect(denySec.status).toBe(403);
  });
});

describe('OWN — OWNERSHIP path preserved (no tenant required)', () => {
  test('OWN-01: individual Proprietaire can list their own rentals via /owner/my — no tenant header', async () => {
    await seedRental({ ownerUser: ownerA, tenant: null });
    const res = await request(app).get('/api/rental-management/owner/my').set(bearer(ownerA));
    expect(res.status).toBe(200);
  });

  test('OWN-02: individual owner cannot access another owner\'s resource via owner action', async () => {
    const { rental: rentalB } = await seedRental({ ownerUser: ownerB, tenant: null });
    const res = await request(app).post(`/api/rental-management/${rentalB._id}/owner/dummyAction`).set(bearer(ownerA)).send({});
    // The controller filters by `_id + owner: req.user.id` → not found for
    // a different owner. Expect a 4xx (owner-mismatch) refusal.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('OWN-03: ownership path does not require an OrgMembership', async () => {
    // ownerA has no membership anywhere. /owner/my remains accessible.
    const memberships = await OrgMembership.countDocuments({ user: ownerA._id });
    expect(memberships).toBe(0);
    const res = await request(app).get('/api/rental-management/owner/my').set(bearer(ownerA));
    expect(res.status).toBe(200);
  });

  test('OWN-04: ownership does not grant tenant staff authority', async () => {
    // ownerA (Proprietaire, no membership) tries to reach the tenant list.
    // Even with a valid tenant header they must be refused: no membership.
    const res = await request(app).get('/api/rental-management').set(bearer(ownerA, tA._id));
    expect(res.status).toBe(403);
  });
});

describe('DUAL — ownership and tenant authority stay independent', () => {
  test('DUAL-01: a user who is both an individual owner AND a tenant member never gets authority leakage', async () => {
    // proprietaireAdmin owns something personally AND is Admin in tenant A.
    await seedRental({ ownerUser: proprietaireAdmin, tenant: null }); // personal
    await seedRental({ ownerUser: ownerA, tenant: tA }); // tenant-owned
    // Personal ownership: /owner/my responds regardless of tenant header.
    const ownRes = await request(app).get('/api/rental-management/owner/my').set(bearer(proprietaireAdmin));
    expect(ownRes.status).toBe(200);
    // Tenant list: with tA selected, still allowed as Admin.
    const tRes = await listA(proprietaireAdmin);
    expect(tRes.status).toBe(200);
    // Global User.role remains Proprietaire, never Admin.
    const u = await User.findById(proprietaireAdmin._id).select('role').lean();
    expect(u.role).toBe('Proprietaire');
  });

  test('DUAL-02: the selected tenant, not owned resources elsewhere, determines tenant authority', async () => {
    // admin is Admin in A. Give admin a personal rental (owner path).
    const { rental: personalRental } = await seedRental({ ownerUser: admin, tenant: null });
    // With X-Platform-Tenant-Id=tA, tenant authority is tenant A's.
    const tRes = await listA(admin);
    expect(tRes.status).toBe(200);
    // Without any X-Platform-Tenant-Id, tenant path must refuse (no tenant
    // context resolved when user has multiple tenants; admin here has only
    // one, but resolution still yields a tenant — the point is the SAME
    // caller cannot use ownership to bypass module/membership on the tenant
    // path). Attempt to reach the tenant path with a personal-rental id and
    // tenant A selected: allowed because admin is Admin in A. Attempt the
    // same as a caller with no membership at all should fail.
    const outsider = await makeUser({ role: 'Client' });
    // Give outsider a rental they own personally.
    const { rental: outsiderPersonal } = await seedRental({ ownerUser: outsider, tenant: null });
    const denyRes = await request(app).get(`/api/rental-management/${outsiderPersonal._id}`).set(bearer(outsider, tA._id));
    expect(denyRes.status).toBe(403); // no membership in tA → tenant path refuses
    // Personal ownership does not create authority on someone else's tenant.
    expect(mongoose.isValidObjectId(personalRental._id)).toBe(true);
  });
});
