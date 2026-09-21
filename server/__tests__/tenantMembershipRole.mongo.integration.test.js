// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1C — adversarial matrix for the
// canonical requireTenantMembershipRole middleware. Runs on a real
// MongoMemoryReplSet with real users, platform tenants, org memberships,
// and platform operators.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { protect } = require('../middleware/authMiddleware');
const { attachTenantContext } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

// A tiny probe app: /admin requires businessRole in {Admin},
// /rem requires businessRole in {GestionnaireImmobilier}, /legacy uses opt-in fallback.
const app = express();
app.use(express.json());
app.get('/admin', protect, attachTenantContext, requireTenantMembershipRole('Admin'),
  (req, res) => res.json({ ok: true, businessRole: req.tenantBusinessRole, source: req.tenantMembershipSource, tenant: String(req.platformTenant?._id) }));
app.get('/rem', protect, attachTenantContext, requireTenantMembershipRole('GestionnaireImmobilier'),
  (req, res) => res.json({ ok: true, businessRole: req.tenantBusinessRole }));
app.get('/staff', protect, attachTenantContext, requireTenantMembershipRole('Admin', 'Collaborateur'),
  (req, res) => res.json({ ok: true, businessRole: req.tenantBusinessRole }));
app.get('/legacy', protect, attachTenantContext, requireTenantMembershipRole({ roles: ['Admin'], allowLegacyRoleFallback: true }),
  (req, res) => res.json({ ok: true, businessRole: req.tenantBusinessRole, source: req.tenantMembershipSource }));
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

const setBusinessRole = (userId, tenant, businessRole) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

let tA; let tB; let tC; let bA; let bB; let bC;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  const fC = await createTenantFixture({ label: 'Tenant C' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
  tC = fC.tenant; bC = fC.bootstrap;
});

describe('AUTH — configuration + authentication gates', () => {
  test('AUTH-18: middleware factory refuses invalid businessRole configuration', () => {
    expect(() => requireTenantMembershipRole()).toThrow(/at least one/i);
    expect(() => requireTenantMembershipRole('Proprietaire')).toThrow(/invalid role/i);
    expect(() => requireTenantMembershipRole('Client')).toThrow(/invalid role/i);
    expect(() => requireTenantMembershipRole({ roles: ['Prestataire'] })).toThrow(/invalid role/i);
    // Accepted:
    expect(() => requireTenantMembershipRole('Admin', 'Collaborateur')).not.toThrow();
    expect(() => requireTenantMembershipRole({ roles: ['GestionnaireImmobilier'], allowLegacyRoleFallback: true })).not.toThrow();
  });

  test('AUTH-01: no authentication → 401', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });
});

describe('AUTH — active membership matrix', () => {
  test('AUTH-02: authenticated user without tenant membership → 403', async () => {
    const u = await makeUser();
    // add no OrgMembership at all
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    // No membership → tenantContext refuses first (403 with TENANT_CONTEXT_REQUIRED semantics).
    // Either 403 code from tenantContext OR from our middleware — both acceptable outcomes.
    expect(res.status).toBe(403);
  });

  test('AUTH-03: active membership + allowed role → 200', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Admin');
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, businessRole: 'Admin', source: 'membership_business_role' });
  });

  test('AUTH-04: active membership + wrong role → 403', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Collaborateur');
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });

  test('AUTH-05: suspended membership → 403', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Admin');
    await OrgMembership.updateOne({ user: u._id, orgUnit: tA.rootOrgUnit }, { $set: { status: 'suspended' } });
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });

  test('AUTH-06: revoked membership → 403', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Admin');
    await OrgMembership.updateOne({ user: u._id, orgUnit: tA.rootOrgUnit }, { $set: { status: 'revoked' } });
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });
});

describe('AUTH — forgery and cross-tenant', () => {
  test('AUTH-07: forged X-Platform-Tenant-Id (tenant B) by member of tenant A → 403', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Admin');
    // U is NOT a member of tenant B. Requesting B → tenantContext fails to resolve.
    const res = await request(app).get('/admin').set(bearer(u, tB._id));
    expect(res.status).toBe(403);
  });

  test('AUTH-08: forged body tenant does NOT reroute authority', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Collaborateur');
    // Even if body contains a tenantId=A, requiring Admin on the correct tenant fails.
    const res = await request(app).get('/admin').set(bearer(u, tA._id)).send({ tenantId: String(tA._id), tenant: String(tA._id) });
    expect(res.status).toBe(403);
  });

  test('AUTH-09: Generic User.role="Admin" without OrgMembership → 403', async () => {
    const u = await makeUser({ role: 'Admin' });
    // No OrgMembership on any tenant.
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });

  test('AUTH-10 · AUTH-11: PlatformOperator without membership → 403 (capability does NOT satisfy tenant role)', async () => {
    const op = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: op._id, actor: bA, reason: 'op fixture', capabilities: ['platform.support.read', 'platform.users.manage'] });
    // No OrgMembership on tenant A.
    const res = await request(app).get('/admin').set(bearer(op, tA._id));
    expect(res.status).toBe(403);
  });
});

describe('AUTH — multi-tenant same identity', () => {
  test('AUTH-12: same User Admin in A / Collaborateur in B / GestionnaireImmobilier in C — isolated', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: tB, user: u, bootstrap: bB });
    await addTenantMember({ tenant: tC, user: u, bootstrap: bC });
    await setBusinessRole(u._id, tA, 'Admin');
    await setBusinessRole(u._id, tB, 'Collaborateur');
    await setBusinessRole(u._id, tC, 'GestionnaireImmobilier');
    // scope A / require Admin → 200
    expect((await request(app).get('/admin').set(bearer(u, tA._id))).status).toBe(200);
    // scope B / require Admin → 403
    expect((await request(app).get('/admin').set(bearer(u, tB._id))).status).toBe(403);
    // scope B / require Admin OR Collaborateur → 200
    expect((await request(app).get('/staff').set(bearer(u, tB._id))).status).toBe(200);
    // scope C / require GestionnaireImmobilier → 200
    expect((await request(app).get('/rem').set(bearer(u, tC._id))).status).toBe(200);
    // scope C / require Admin OR Collaborateur → 403
    expect((await request(app).get('/staff').set(bearer(u, tC._id))).status).toBe(403);
  });
});

describe('AUTH — ambiguous storage and legacy fallback', () => {
  test('AUTH-13: two active memberships (different roleInUnit) on same tenant → fail closed (403)', async () => {
    const u = await makeUser();
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setBusinessRole(u._id, tA, 'Admin');
    // Insert a SECOND active membership with a DIFFERENT roleInUnit — allowed by the
    // existing partial-unique index (user, orgUnit, roleInUnit).
    await OrgMembership.create({
      user: u._id, orgUnit: tA.rootOrgUnit, roleInUnit: 'manager', status: 'active', businessRole: 'Collaborateur',
    });
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
    // The specific error code should surface via errorHandler (JSON body message check).
    // We accept any 403 for this contract; the code is verified elsewhere.
  });

  test('AUTH-14/15/16: external Client / Proprietaire / Prestataire without membership → 403', async () => {
    for (const role of ['Client', 'Proprietaire', 'Prestataire']) {
      const u = await makeUser({ role });
      const res = await request(app).get('/admin').set(bearer(u, tA._id));
      expect(res.status).toBe(403);
    }
  });

  test('AUTH-17: businessRole null + User.role="Admin" + fallback DISABLED (default) → 403', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    // membership present, businessRole null, User.role="Admin", fallback OFF on /admin
    const res = await request(app).get('/admin').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });

  test('FALLBACK-01: ancien opt-in middleware ne réactive plus User.role → businessRole', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const res = await request(app).get('/legacy').set(bearer(u, tA._id));
    expect(res.status).toBe(403);
  });
});
