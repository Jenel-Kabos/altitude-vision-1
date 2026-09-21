// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-A · MODULE-01..MODULE-10 +
// adversarial identity tests. Certifie que `requireTenantModule(...)`
// répond uniquement à "ce tenant possède-t-il ce module ?" et que la
// sémantique (PlatformTenantFeature disable > enable > subscription
// modulesIncluded) est appliquée fail-closed.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { protect } = require('../middleware/authMiddleware');
const { attachTenantContext, requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

// Minimal harness — one endpoint per test to isolate the module gate.
const app = express();
app.use(express.json());
app.get('/gated/location', protect, attachTenantContext, requireTenantScope, requireTenantModule('location'), (req, res) => res.json({ ok: true, module: req.tenantModule }));
app.get('/gated/immobilier', protect, attachTenantContext, requireTenantScope, requireTenantModule('immobilier'), (req, res) => res.json({ ok: true, module: req.tenantModule }));
app.get('/gated/either', protect, attachTenantContext, requireTenantScope, requireTenantModule('location', 'immobilier'), (req, res) => res.json({ ok: true, module: req.tenantModule }));
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
const stripModulesFromSubscription = (tenantId) => PlatformTenantSubscription.updateOne(
  { tenant: tenantId, status: { $in: ['trialing', 'active'] } },
  { $set: { modulesIncluded: [] } },
);
const cancelSubscription = (tenantId) => PlatformTenantSubscription.updateOne(
  { tenant: tenantId, status: { $in: ['trialing', 'active'] } },
  { $set: { status: 'cancelled' } },
);

let tA; let bA; let tB; let bB; let member;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
  member = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: member, bootstrap: bA });
  await setRole(member._id, tA, 'Admin');
});

describe('MODULE — requireTenantModule semantics', () => {
  test('MODULE-01: trial-complete subscription includes location → ALLOW', async () => {
    // Default fixture: PlatformTenantSubscription created by
    // createTenantFixture / platformTenantService seeds
    // modulesIncluded = TENANT_FEATURE_MODULES (trial complete).
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(200);
    expect(res.body.module).toBe('location');
  });

  test('MODULE-02: subscription without the module → DENY', async () => {
    await stripModulesFromSubscription(tA._id);
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(403);
    // Error message set by the gate references module unavailability.
    expect(String(res.body.message || '')).toMatch(/module tenant indisponible/i);
  });

  test('MODULE-03: subscription status=trialing with module included → ALLOW', async () => {
    // Force the seeded subscription into trialing (should already be default).
    await PlatformTenantSubscription.updateOne(
      { tenant: tA._id, status: { $in: ['trialing', 'active'] } },
      { $set: { status: 'trialing', modulesIncluded: ['location'] } },
    );
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(200);
  });

  test('MODULE-04: subscription cancelled → DENY even if modulesIncluded still lists it', async () => {
    await cancelSubscription(tA._id);
    // At this point no active subscription; only an explicit PlatformTenantFeature
    // enable would allow the module.
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(403);
  });

  test('MODULE-05: PlatformTenantFeature enabled=true → ALLOW (even with subscription lacking the module)', async () => {
    await stripModulesFromSubscription(tA._id);
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: true });
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(200);
  });

  test('MODULE-06: PlatformTenantFeature enabled=false overrides modulesIncluded → DENY', async () => {
    // Default subscription includes 'location'. Explicit disable must win.
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: false });
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(403);
  });

  test('MODULE-07: no tenant resolved (missing X-Platform-Tenant-Id and user has multiple tenants) → DENY', async () => {
    // Grant the same user membership in tenant B so no single tenant is
    // implicit. Without X-Platform-Tenant-Id the tenant context cannot resolve
    // and requireTenantScope refuses.
    await addTenantMember({ tenant: tB, user: member, bootstrap: bB });
    await setRole(member._id, tB, 'Admin');
    const res = await request(app).get('/gated/location').set(bearer(member)); // no tenant header
    expect(res.status).toBe(403);
  });

  test('MODULE-08: forged module via body/query/header has no influence', async () => {
    await stripModulesFromSubscription(tA._id);
    const res = await request(app).get('/gated/location?module=location')
      .set({ ...bearer(member, tA._id), 'X-Tenant-Module': 'location' })
      .send({ module: 'location' });
    expect(res.status).toBe(403); // Still DENY: module is not actually granted.
  });

  test('MODULE-09: unknown module registers a fail-fast error at gate construction time', () => {
    expect(() => requireTenantModule('module_that_does_not_exist')).toThrow(/unknown module/);
    expect(() => requireTenantModule()).toThrow(/at least one module is required/);
  });

  test('MODULE-10: tenant A has module, tenant B does not → A ALLOW / B DENY (no cross-tenant leak)', async () => {
    await stripModulesFromSubscription(tB._id);
    // Give the caller a membership in B as well so requireTenantMembershipRole is
    // not the blocker (module gate must fail first, not membership).
    await addTenantMember({ tenant: tB, user: member, bootstrap: bB });
    await setRole(member._id, tB, 'Admin');
    const resA = await request(app).get('/gated/location').set(bearer(member, tA._id));
    const resB = await request(app).get('/gated/location').set(bearer(member, tB._id));
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(403);
  });
});

describe('MODULE — adversarial identity tests (identity never changes the module answer)', () => {
  test('Global User.role=Admin alone does not grant a missing module', async () => {
    await stripModulesFromSubscription(tA._id);
    const admin = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
    await setRole(admin._id, tA, 'Admin');
    const res = await request(app).get('/gated/location').set(bearer(admin, tA._id));
    expect(res.status).toBe(403);
  });

  test('Active PlatformOperator with platform.users.manage does not grant a missing module', async () => {
    await stripModulesFromSubscription(tA._id);
    const op = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: op._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read', 'platform.users.read', 'platform.users.manage'] });
    await addTenantMember({ tenant: tA, user: op, bootstrap: bA });
    await setRole(op._id, tA, 'Admin');
    const res = await request(app).get('/gated/location').set(bearer(op, tA._id));
    expect(res.status).toBe(403);
  });

  test('Tenant Admin does not grant a missing module', async () => {
    await stripModulesFromSubscription(tA._id);
    // member already has businessRole=Admin from beforeEach.
    const res = await request(app).get('/gated/location').set(bearer(member, tA._id));
    expect(res.status).toBe(403);
  });

  test('Module gate answer depends only on the tenant, not on the caller identity', async () => {
    // Give three different identities (Client member, staff-legacy-role Client
    // member, Admin+PlatformOperator member) the same active membership in
    // tenant A. All three must receive the SAME module answer.
    const asClient = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: asClient, bootstrap: bA });
    await setRole(asClient._id, tA, 'Collaborateur');
    const asOwner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tA, user: asOwner, bootstrap: bA });
    await setRole(asOwner._id, tA, 'GestionnaireImmobilier');
    const asOp = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: asOp._id, actor: bA, reason: 'fx-op', capabilities: ['platform.support.read', 'platform.users.read', 'platform.users.manage'] });
    await addTenantMember({ tenant: tA, user: asOp, bootstrap: bA });
    await setRole(asOp._id, tA, 'Admin');

    const [r1, r2, r3] = await Promise.all([
      request(app).get('/gated/location').set(bearer(asClient, tA._id)),
      request(app).get('/gated/location').set(bearer(asOwner, tA._id)),
      request(app).get('/gated/location').set(bearer(asOp, tA._id)),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    // Now flip the module off — all three must flip to 403.
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: false });
    const [r4, r5, r6] = await Promise.all([
      request(app).get('/gated/location').set(bearer(asClient, tA._id)),
      request(app).get('/gated/location').set(bearer(asOwner, tA._id)),
      request(app).get('/gated/location').set(bearer(asOp, tA._id)),
    ]);
    expect(r4.status).toBe(403);
    expect(r5.status).toBe(403);
    expect(r6.status).toBe(403);
  });

  test('Multi-module gate: first-matching-module wins (ALLOW when either is granted)', async () => {
    // Default fixture includes both 'location' and 'immobilier'. Strip
    // 'immobilier' — the gate should still allow because 'location' is on.
    await PlatformTenantSubscription.updateOne(
      { tenant: tA._id, status: { $in: ['trialing', 'active'] } },
      { $set: { modulesIncluded: ['location'] } },
    );
    const res = await request(app).get('/gated/either').set(bearer(member, tA._id));
    expect(res.status).toBe(200);
    expect(res.body.module).toBe('location');
  });

  test('Multi-module gate DENY when none is granted', async () => {
    await stripModulesFromSubscription(tA._id);
    const res = await request(app).get('/gated/either').set(bearer(member, tA._id));
    expect(res.status).toBe(403);
  });
});
