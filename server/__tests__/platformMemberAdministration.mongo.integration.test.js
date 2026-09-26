// PLATFORM-SUPER-ADMIN OPTION-3 — matrice P-MEMBER-01…16.
//
// Prouve la composition d'autorité mise en place sur /api/members :
//   PATH A : OrgMembership Admin dans le tenant sélectionné.
//   PATH B : PlatformOperator actif + platform.users.read/manage +
//            tenant explicitement sélectionné.
//
// Aucun bypass User.role, aucun OrgMembership artificiel, aucune atteinte
// à l'invariant last-admin (protection distribuée conservée par le service).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const memberRoutes = require('../routes/tenantMemberRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/members', memberRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User',
  email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!',
  role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

const setRole = (userId, tenant, businessRole) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

let tenantA; let tenantB; let bootstrapA; let bootstrapB;
let tenantAdminA; let tenantAdminA2; let tenantAdminB;
let candidateA; let candidateB;
let platformGrantor; let operatorManage; let operatorReadOnly; let operatorNoCap; let operatorSuspended;
let bareGlobalAdmin;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'PMEM Tenant A' });
  const fB = await createTenantFixture({ label: 'PMEM Tenant B' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;

  // Two canonical Admins in Tenant A (so last-admin protection has a valid
  // "still one Admin left" reference point in most mutation tests).
  tenantAdminA = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantA, user: tenantAdminA, bootstrap: bootstrapA });
  await setRole(tenantAdminA._id, tenantA, 'Admin');
  tenantAdminA2 = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantA, user: tenantAdminA2, bootstrap: bootstrapA });
  await setRole(tenantAdminA2._id, tenantA, 'Admin');

  tenantAdminB = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tenantB, user: tenantAdminB, bootstrap: bootstrapB });
  await setRole(tenantAdminB._id, tenantB, 'Admin');

  // Candidates for add/manage tests. Not members of any tenant yet.
  candidateA = await makeUser({ role: 'Collaborateur' });
  candidateB = await makeUser({ role: 'Collaborateur' });

  // Platform operator scaffolding — grantOperator forbids self-grant, so we
  // use a separate grantor account with platform.operators.manage.
  platformGrantor = await makeUser({ role: 'Admin' });
  await PlatformOperator.create({
    user: platformGrantor._id, status: 'active',
    capabilities: ['platform.operators.manage'],
    grantedBy: platformGrantor._id, grantReason: 'PMEM bootstrap grantor',
  });

  operatorManage = await makeUser({ role: 'Admin' });
  await grantOperator({
    userId: operatorManage._id, actor: platformGrantor,
    capabilities: ['platform.users.manage', 'platform.tenants.read'],
    reason: 'PMEM operator with users.manage',
  });

  operatorReadOnly = await makeUser({ role: 'Admin' });
  await grantOperator({
    userId: operatorReadOnly._id, actor: platformGrantor,
    capabilities: ['platform.users.read'],
    reason: 'PMEM operator with users.read only',
  });

  operatorNoCap = await makeUser({ role: 'Admin' });
  await grantOperator({
    userId: operatorNoCap._id, actor: platformGrantor,
    capabilities: ['platform.tenants.read'],
    reason: 'PMEM operator without users.* capability',
  });

  operatorSuspended = await makeUser({ role: 'Admin' });
  await grantOperator({
    userId: operatorSuspended._id, actor: platformGrantor,
    capabilities: ['platform.users.manage'],
    reason: 'PMEM operator to be suspended',
  });
  await PlatformOperator.updateOne(
    { user: operatorSuspended._id },
    { $set: { status: 'suspended', suspendedBy: platformGrantor._id, suspendedAt: new Date(), suspensionReason: 'PMEM' } },
  );

  bareGlobalAdmin = await makeUser({ role: 'Admin' });
});

// ─── P-MEMBER-01/02/03 — cross-tenant listing ──────────────────────────────

test('P-MEMBER-01: PlatformOperator + platform.users.read lists Tenant A members', async () => {
  const res = await request(app).get('/api/members').set(bearer(operatorReadOnly, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data.members;
  expect(Array.isArray(list)).toBe(true);
  expect(list.length).toBeGreaterThan(0);
  // Every returned membership belongs to Tenant A rootOrgUnit.
  for (const m of list) {
    const doc = await OrgMembership.findById(m.membershipId).lean();
    expect(doc).toBeTruthy();
    expect(String(doc.orgUnit)).toBe(String(tenantA.rootOrgUnit));
  }
});

test('P-MEMBER-02: same operator lists Tenant B members', async () => {
  const res = await request(app).get('/api/members').set(bearer(operatorReadOnly, tenantB._id));
  expect(res.status).toBe(200);
  const list = res.body.data.members;
  expect(Array.isArray(list)).toBe(true);
  expect(list.length).toBeGreaterThan(0);
  for (const m of list) {
    const doc = await OrgMembership.findById(m.membershipId).lean();
    expect(doc).toBeTruthy();
    expect(String(doc.orgUnit)).toBe(String(tenantB.rootOrgUnit));
  }
});

test('P-MEMBER-03: Tenant A response contains no Tenant B membership', async () => {
  const res = await request(app).get('/api/members').set(bearer(operatorReadOnly, tenantA._id));
  expect(res.status).toBe(200);
  const list = res.body.data.members;
  // tenantAdminB is only in Tenant B; must never leak into A's response.
  expect(list.some((m) => String(m.user?.id) === String(tenantAdminB._id))).toBe(false);
});

// ─── P-MEMBER-04/05/06 — read vs write capability ──────────────────────────

test('P-MEMBER-04: platform.users.read cannot mutate membership', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorReadOnly, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(403);
  const active = await OrgMembership.countDocuments({ user: candidateA._id, orgUnit: tenantA.rootOrgUnit, status: 'active' });
  expect(active).toBe(0);
});

test('P-MEMBER-05: platform.users.manage adds a member to Tenant A', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorManage, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(201);
  const active = await OrgMembership.findOne({ user: candidateA._id, orgUnit: tenantA.rootOrgUnit, status: 'active' });
  expect(active).toBeTruthy();
  expect(active.businessRole).toBe('Collaborateur');
});

test('P-MEMBER-06: same capability adds a member to Tenant B', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorManage, tenantB._id))
    .send({ userId: String(candidateB._id), businessRole: 'GestionnaireImmobilier' });
  expect(res.status).toBe(201);
  const active = await OrgMembership.findOne({ user: candidateB._id, orgUnit: tenantB.rootOrgUnit, status: 'active' });
  expect(active).toBeTruthy();
  expect(active.businessRole).toBe('GestionnaireImmobilier');
});

// ─── P-MEMBER-07/08/09/10 — negative authority paths ───────────────────────

test('P-MEMBER-07: operator without platform.users.manage cannot mutate', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorNoCap, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(403);
});

test('P-MEMBER-08: suspended PlatformOperator cannot mutate', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorSuspended, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(403);
});

test('P-MEMBER-09: User.role Admin without PlatformOperator and without membership cannot mutate', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(bareGlobalAdmin, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(403);
});

test('P-MEMBER-10: no selected tenant fails closed', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(operatorManage)) // no X-Platform-Tenant-Id
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(403);
});

// ─── P-MEMBER-11 — cross-tenant membershipId protection ───────────────────

test('P-MEMBER-11: Tenant A context + Tenant B membershipId cannot mutate B', async () => {
  const memB = await OrgMembership.findOne({ user: tenantAdminB._id, orgUnit: tenantB.rootOrgUnit, status: 'active' }).lean();
  expect(memB).toBeTruthy();
  const res = await request(app).patch(`/api/members/${memB._id}`)
    .set(bearer(operatorManage, tenantA._id))
    .send({ businessRole: 'Collaborateur' });
  expect(res.status).toBe(404);
  const reread = await OrgMembership.findById(memB._id).lean();
  expect(reread.businessRole).toBe('Admin');
});

// ─── P-MEMBER-12/13/14 — last-admin invariant preserved even for operators ─

test('P-MEMBER-12: last Admin of Tenant B cannot be demoted by PlatformOperator', async () => {
  const memB = await OrgMembership.findOne({ user: tenantAdminB._id, orgUnit: tenantB.rootOrgUnit, status: 'active' }).lean();
  const res = await request(app).patch(`/api/members/${memB._id}`)
    .set(bearer(operatorManage, tenantB._id))
    .send({ businessRole: 'Collaborateur' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('LAST_TENANT_ADMIN');
  const reread = await OrgMembership.findById(memB._id).lean();
  expect(reread.businessRole).toBe('Admin');
});

test('P-MEMBER-13: last Admin of Tenant B cannot be suspended by PlatformOperator', async () => {
  const memB = await OrgMembership.findOne({ user: tenantAdminB._id, orgUnit: tenantB.rootOrgUnit, status: 'active' }).lean();
  const res = await request(app).post(`/api/members/${memB._id}/suspend`)
    .set(bearer(operatorManage, tenantB._id))
    .send({ reason: 'test' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('LAST_TENANT_ADMIN');
});

test('P-MEMBER-14: last Admin of Tenant B cannot be revoked by PlatformOperator', async () => {
  const memB = await OrgMembership.findOne({ user: tenantAdminB._id, orgUnit: tenantB.rootOrgUnit, status: 'active' }).lean();
  const res = await request(app).delete(`/api/members/${memB._id}`)
    .set(bearer(operatorManage, tenantB._id))
    .send({ reason: 'test' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('LAST_TENANT_ADMIN');
});

// ─── P-MEMBER-15/16 — invariants preserved ─────────────────────────────────

test('P-MEMBER-15: PlatformOperator add-member changes OrgMembership only, never User.role', async () => {
  const beforeRole = (await User.findById(candidateA._id).lean()).role;
  const res = await request(app).post('/api/members')
    .set(bearer(operatorManage, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(201);
  const afterRole = (await User.findById(candidateA._id).lean()).role;
  expect(afterRole).toBe(beforeRole);
});

test('P-MEMBER-16: normal Tenant Admin behavior unchanged (add member via PATH A still works)', async () => {
  const res = await request(app).post('/api/members')
    .set(bearer(tenantAdminA, tenantA._id))
    .send({ userId: String(candidateA._id), businessRole: 'Collaborateur' });
  expect(res.status).toBe(201);
});
