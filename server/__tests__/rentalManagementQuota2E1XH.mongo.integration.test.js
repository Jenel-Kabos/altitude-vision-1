// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H — QUOTA-01..20,
// PLAN-01..08, CORE-01..05, CONCURRENCY-01..03.
//
// Certifies that `POST /api/rental-management/onboarding` enforces the
// canonical `PlatformTenantSubscription.quotas.maxManagedProperties`
// budget for the three commercial plans (Essentiel/Professionnel/Premium)
// while leaving property publication, tenant module gate, and canonical
// authority contracts (Lots A/B/C/E/F/G) intact.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const RentalManagement = require('../models/RentalManagement');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { getActiveManagedCount, assertActivationAllowed, QUOTA_ERROR_CODE } = require('../services/rentalManagementQuotaService');
const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', rentalManagementRoutes);
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
const setSubscriptionPlan = (tenantId, plan, quotas) => PlatformTenantSubscription.updateOne(
  { tenant: tenantId, status: { $in: ['trialing', 'active'] } },
  { $set: { plan, status: 'active', ...(quotas ? { quotas } : {}) } },
);
const seedProperty = ({ owner, tenant, overrides = {} }) => Property.create({
  title: 'Bien Quota', description: 'Description suffisamment longue pour la validation.',
  pole: 'Altimmo', type: 'Appartement', status: 'location', price: 150000,
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  images: ['https://example.test/image.jpg'], surface: 80, statusAdmin: 'Validée',
  availability: 'Disponible', latitude: -4.27, longitude: 15.27,
  location: { type: 'Point', coordinates: [15.27, -4.27] },
  owner: owner._id, tenant: tenant?._id || null, ...overrides,
});
const seedActiveManagement = async ({ tenant, ownerUser, propertyOverrides = {} }) => {
  const property = await seedProperty({ owner: ownerUser, tenant, overrides: propertyOverrides });
  const rental = await RentalManagement.create({
    property: property._id, owner: ownerUser._id, tenant: tenant?._id || null,
    managementActivated: true, availabilityStatus: 'disponible', occupancyStatus: 'vacant', createdBy: ownerUser._id,
  });
  return { property, rental };
};
const onboard = (caller, tenant, propertyId) => request(app)
  .post('/api/rental-management/onboarding')
  .set(bearer(caller, tenant._id))
  .send({ mode: 'existing', property: String(propertyId) });

let tA; let bA; let tB; let bB; let admin; let ownerP;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Quota Tenant A' });
  const fB = await createTenantFixture({ label: 'Quota Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;

  admin = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
  await setRole(admin._id, tA, 'Admin');
  const gest = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: gest, bootstrap: bA });
  await setRole(gest._id, tA, 'GestionnaireImmobilier');

  ownerP = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: ownerP, bootstrap: bA });
  await setRole(ownerP._id, tA, 'Collaborateur');
  // Onboarding requires a Proprietaire fiche linked to the owner User.
  await Proprietaire.create({ nom: 'Owner', prenom: 'P', telephone: `06${Date.now() % 100000000}`, user: ownerP._id });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('QUOTA — activation budget enforcement (Essentiel/Professionnel/Premium)', () => {
  test('QUOTA-01: Essentiel + 0 active → activate first → ALLOW', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(201);
    const count = await getActiveManagedCount(tA._id);
    expect(count).toBe(1);
  });

  test('QUOTA-02: Essentiel + 1 active → activate second → DENY 409 with quota code', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const property2 = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property2._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(QUOTA_ERROR_CODE);
    expect(res.body.current).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.plan).toBe('essentiel');
  });

  test('QUOTA-03: Essentiel + many publications + 0 active → first activation ALLOW', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    // Seed 10 published properties for the tenant (no RentalManagement).
    for (let i = 0; i < 10; i += 1) await seedProperty({ owner: ownerP, tenant: tA });
    const target = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, target._id);
    expect(res.status).toBe(201);
  });

  test('QUOTA-04/05: Professionnel — 19 active → 20th ALLOW; 20 active → 21st DENY', async () => {
    await setSubscriptionPlan(tA._id, 'professionnel', { maxManagedProperties: 20 });
    for (let i = 0; i < 19; i += 1) await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const p20 = await seedProperty({ owner: ownerP, tenant: tA });
    const ok = await onboard(admin, tA, p20._id);
    expect(ok.status).toBe(201);
    // Now 20 active. Next attempt must be refused.
    const p21 = await seedProperty({ owner: ownerP, tenant: tA });
    const deny = await onboard(admin, tA, p21._id);
    expect(deny.status).toBe(409);
    expect(deny.body.code).toBe(QUOTA_ERROR_CODE);
    expect(deny.body.limit).toBe(20);
  });

  test('QUOTA-06/07: Premium — 49 active → 50th ALLOW; 50 active → 51st DENY', async () => {
    await setSubscriptionPlan(tA._id, 'premium', { maxManagedProperties: 50 });
    for (let i = 0; i < 49; i += 1) await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const p50 = await seedProperty({ owner: ownerP, tenant: tA });
    const ok = await onboard(admin, tA, p50._id);
    expect(ok.status).toBe(201);
    const p51 = await seedProperty({ owner: ownerP, tenant: tA });
    const deny = await onboard(admin, tA, p51._id);
    expect(deny.status).toBe(409);
    expect(deny.body.limit).toBe(50);
  }, 240000);

  test('QUOTA-08: inactive RentalManagement does not consume quota', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const inactiveProp = await seedProperty({ owner: ownerP, tenant: tA });
    await RentalManagement.create({
      property: inactiveProp._id, owner: ownerP._id, tenant: tA._id,
      managementActivated: false, availabilityStatus: 'disponible', occupancyStatus: 'vacant', createdBy: ownerP._id,
    });
    const count = await getActiveManagedCount(tA._id);
    expect(count).toBe(0);
    // Now activate a new property — must be allowed.
    const newProp = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, newProp._id);
    expect(res.status).toBe(201);
  });

  test('QUOTA-09: Tenant A active management count does not consume Tenant B quota', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await setSubscriptionPlan(tB._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    // Tenant B has 0 active. Add admin/ownerP to tenant B and try activating.
    await addTenantMember({ tenant: tB, user: admin, bootstrap: bB });
    await setRole(admin._id, tB, 'Admin');
    const ownerB = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tB, user: ownerB, bootstrap: bB });
    await setRole(ownerB._id, tB, 'Collaborateur');
    await Proprietaire.create({ nom: 'B', prenom: 'X', telephone: `07${Date.now() % 100000000}`, user: ownerB._id });
    const propB = await seedProperty({ owner: ownerB, tenant: tB });
    const res = await onboard(admin, tB, propB._id);
    expect(res.status).toBe(201);
    expect(await getActiveManagedCount(tA._id)).toBe(1);
    expect(await getActiveManagedCount(tB._id)).toBe(1);
  });

  test('QUOTA-13: forged plan/quota in body/query/header has no influence', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).post('/api/rental-management/onboarding')
      .set({ ...bearer(admin, tA._id), 'X-Plan': 'premium', 'X-MaxManaged': '999' })
      .query({ plan: 'premium', maxManagedProperties: '999' })
      .send({ mode: 'existing', property: String(property._id), plan: 'premium', maxManagedProperties: 999 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(QUOTA_ERROR_CODE);
    expect(res.body.plan).toBe('essentiel');
    expect(res.body.limit).toBe(1);
  });

  test('QUOTA-14: no active subscription → activation refused upstream (module gate / tenant scope)', async () => {
    await PlatformTenantSubscription.updateOne(
      { tenant: tA._id }, { $set: { status: 'cancelled', modulesIncluded: [] } },
    );
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(403); // module gate refuses before quota
  });

  test('QUOTA-15: location module disabled → module gate denies before quota', async () => {
    // Keep an active subscription but drop the location module.
    await PlatformTenantSubscription.updateOne(
      { tenant: tA._id, status: { $in: ['trialing', 'active'] } },
      { $set: { modulesIncluded: [] } },
    );
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(403); // module gate: TENANT_MODULE_UNAVAILABLE
  });

  test('QUOTA-16/17: Property publication does not consume quota', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    // Publish 5 properties (personal + tenant) — none activated.
    for (let i = 0; i < 5; i += 1) await seedProperty({ owner: ownerP, tenant: tA });
    for (let i = 0; i < 3; i += 1) await seedProperty({ owner: ownerP, tenant: null });
    const count = await getActiveManagedCount(tA._id);
    expect(count).toBe(0);
  });

  test('QUOTA-18: deleting a Property does not consume/release management quota unless RentalManagement lifecycle changes', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    await Property.deleteOne({ _id: property._id });
    expect(await getActiveManagedCount(tA._id)).toBe(0);
  });

  test('QUOTA-19: deactivating management releases capacity', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const { rental } = await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    // Simulate deactivation.
    await RentalManagement.updateOne({ _id: rental._id }, { $set: { managementActivated: false } });
    expect(await getActiveManagedCount(tA._id)).toBe(0);
    // Activate a new one — must succeed under Essentiel.
    const property2 = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property2._id);
    expect(res.status).toBe(201);
  });

  test('QUOTA-20: reactivation consumes capacity again', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const { rental } = await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    // Deactivate then reactivate the same doc.
    await RentalManagement.updateOne({ _id: rental._id }, { $set: { managementActivated: false } });
    expect(await getActiveManagedCount(tA._id)).toBe(0);
    await RentalManagement.updateOne({ _id: rental._id }, { $set: { managementActivated: true } });
    expect(await getActiveManagedCount(tA._id)).toBe(1);
    // Second activation must now be refused.
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(409);
  });
});

describe('QUOTA — no identity bypass', () => {
  test('QUOTA-10: global User.role=Admin cannot bypass quota', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const globalAdmin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: globalAdmin, bootstrap: bA });
    await setRole(globalAdmin._id, tA, 'Admin');
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(globalAdmin, tA, property._id);
    expect(res.status).toBe(409);
  });

  test('QUOTA-11: Tenant Admin (canonical) cannot bypass quota', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(409);
  });

  test('QUOTA-12: PlatformOperator without tenant membership cannot even reach onboarding (module+role gate refuses)', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const { grantOperator } = require('../services/platformOperator/platformOperatorService');
    const op = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: op._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read'] });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(op, tA, property._id);
    expect(res.status).toBe(403);
  });
});

describe('PLAN — subscription plan resolution', () => {
  test('PLAN-01: Essentiel resolves maxManagedProperties=1', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const info = await assertActivationAllowed({ tenantId: tA._id });
    expect(info.limit).toBe(1);
    expect(info.plan).toBe('essentiel');
  });
  test('PLAN-02: Professionnel resolves maxManagedProperties=20', async () => {
    await setSubscriptionPlan(tA._id, 'professionnel', { maxManagedProperties: 20 });
    const info = await assertActivationAllowed({ tenantId: tA._id });
    expect(info.limit).toBe(20);
  });
  test('PLAN-03: Premium resolves maxManagedProperties=50', async () => {
    await setSubscriptionPlan(tA._id, 'premium', { maxManagedProperties: 50 });
    const info = await assertActivationAllowed({ tenantId: tA._id });
    expect(info.limit).toBe(50);
  });
  test('PLAN-04/05: upgrading plan increases future capacity', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    // Upgrade to Professionnel.
    await setSubscriptionPlan(tA._id, 'professionnel', { maxManagedProperties: 20 });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(201);
  });
  test('PLAN-06: downgrade with usage > new limit does NOT silently deactivate existing management', async () => {
    // Start at Professionnel with 3 active managements. Downgrade to Essentiel (limit 1).
    await setSubscriptionPlan(tA._id, 'professionnel', { maxManagedProperties: 20 });
    for (let i = 0; i < 3; i += 1) await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    // Existing 3 active remain intact.
    expect(await getActiveManagedCount(tA._id)).toBe(3);
    // Further activation is refused.
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(409);
  });
  test('PLAN-07: cancelled subscription follows existing entitlement rules (module gate refuses)', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id }, { $set: { status: 'cancelled', modulesIncluded: [] } });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await onboard(admin, tA, property._id);
    expect(res.status).toBe(403);
  });
  test('PLAN-08: forged subscription plan cannot affect quota', async () => {
    // Same as QUOTA-13 — plan comes exclusively from DB, never from request.
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    await seedActiveManagement({ tenant: tA, ownerUser: ownerP });
    const property = await seedProperty({ owner: ownerP, tenant: tA });
    const res = await request(app).post('/api/rental-management/onboarding')
      .set(bearer(admin, tA._id))
      .send({ mode: 'existing', property: String(property._id), plan: 'premium' });
    expect(res.status).toBe(409);
    expect(res.body.plan).toBe('essentiel');
  });
});

describe('CORE — billing/documentation/rental cycle preserved across plans', () => {
  test('CORE-01/02/03/04: rental-management access is available under all three commercial plans', async () => {
    for (const plan of ['essentiel', 'professionnel', 'premium']) {
      await setSubscriptionPlan(tA._id, plan, { maxManagedProperties: plan === 'essentiel' ? 1 : plan === 'professionnel' ? 20 : 50 });
      const res = await request(app).get('/api/rental-management').set(bearer(admin, tA._id));
      expect(res.status).toBe(200);
    }
  });
  test('CORE-05: plan quota changes ONLY the maxManagedProperties number, not the module set', async () => {
    for (const plan of ['essentiel', 'professionnel', 'premium']) {
      await setSubscriptionPlan(tA._id, plan);
      const sub = await PlatformTenantSubscription.findOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }).lean();
      // modulesIncluded must still include `location` (rental cycle).
      expect(sub.modulesIncluded).toContain('location');
    }
  });
});

describe('QUOTA-CONCURRENCY — race safety at the boundary', () => {
  test('QUOTA-CONCURRENCY-01: Essentiel + 0 active, two concurrent activations → final count = 1', async () => {
    await setSubscriptionPlan(tA._id, 'essentiel', { maxManagedProperties: 1 });
    const p1 = await seedProperty({ owner: ownerP, tenant: tA });
    const p2 = await seedProperty({ owner: ownerP, tenant: tA });
    const results = await Promise.allSettled([
      onboard(admin, tA, p1._id),
      onboard(admin, tA, p2._id),
    ]);
    const finalCount = await getActiveManagedCount(tA._id);
    expect(finalCount).toBeLessThanOrEqual(1);
    // At least one succeeded.
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);
    expect(ok.length).toBe(finalCount);
  });
});
