// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1 · PROMOTE-01..PROMOTE-08.
// Certifie que la promotion d'un membre par un Tenant Admin ne modifie
// QUE `OrgMembership.businessRole`. Aucun toucher à `User.role`,
// `roleInUnit`, `PlatformOperator`, ni aucune capability globale. Le
// last-admin invariant reste actif à la démotion/retrait.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const memberRoutes = require('../routes/tenantMemberRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/members', memberRoutes);
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
const getM = (uid, t) => OrgMembership.findOne({ user: uid, orgUnit: t.rootOrgUnit, status: 'active' }).lean();

let tA; let bA; let tB; let bB; let admin; let admin2; let collab;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;

  admin = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
  await setRole(admin._id, tA, 'Admin');

  admin2 = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin2, bootstrap: bA });
  await setRole(admin2._id, tA, 'Admin');

  collab = await makeUser({ role: 'Client' }); // global role = Client, not staff
  await addTenantMember({ tenant: tA, user: collab, bootstrap: bA });
  await setRole(collab._id, tA, 'Collaborateur');
});

describe('PROMOTE — Tenant Admin business-role promotion contract', () => {
  test('PROMOTE-01: Tenant Admin promotes Collaborateur → Admin (allowed)', async () => {
    const m = await getM(collab._id, tA);
    const res = await request(app).patch(`/api/members/${m._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.member.businessRole).toBe('Admin');
  });

  test('PROMOTE-02: promoted user global User.role unchanged', async () => {
    const before = await User.findById(collab._id).select('role isActive status').lean();
    const m = await getM(collab._id, tA);
    await request(app).patch(`/api/members/${m._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    const after = await User.findById(collab._id).select('role isActive status').lean();
    expect(after.role).toBe(before.role);
    expect(after.role).toBe('Client');
    expect(after.isActive).toBe(before.isActive);
    expect(after.status).toBe(before.status);
  });

  test('PROMOTE-03: promoted Admin gets tenant Admin authority', async () => {
    const m = await getM(collab._id, tA);
    await request(app).patch(`/api/members/${m._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    // Collab is now tenant Admin: they can list members (an Admin-only endpoint).
    const list = await request(app).get('/api/members').set(bearer(collab, tA._id));
    expect(list.status).toBe(200);
  });

  test('PROMOTE-04: promoted Admin gets NO global authority', async () => {
    const m = await getM(collab._id, tA);
    await request(app).patch(`/api/members/${m._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    // No PlatformOperator record should exist for collab.
    const op = await PlatformOperator.findOne({ user: collab._id }).lean();
    expect(op).toBeNull();
  });

  test('PROMOTE-05: roleInUnit stays unchanged', async () => {
    const before = await getM(collab._id, tA);
    await request(app).patch(`/api/members/${before._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    const after = await getM(collab._id, tA);
    expect(after.roleInUnit).toBe(before.roleInUnit);
    expect(String(after.orgUnit)).toBe(String(before.orgUnit));
    expect(String(after.user)).toBe(String(before.user));
  });

  test('PROMOTE-06: non-Admin tenant member cannot promote another member to Admin', async () => {
    // Add another Collaborateur in tenant A and let *them* attempt a promotion.
    const secondCollab = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: secondCollab, bootstrap: bA });
    await setRole(secondCollab._id, tA, 'Collaborateur');
    const target = await getM(secondCollab._id, tA);
    const res = await request(app).patch(`/api/members/${target._id}`).set(bearer(collab, tA._id)).send({ businessRole: 'Admin' });
    expect(res.status).toBe(403);
  });

  test('PROMOTE-07: cross-tenant promotion denied (Admin of A cannot mutate B)', async () => {
    const outsider = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tB, user: outsider, bootstrap: bB });
    await setRole(outsider._id, tB, 'Collaborateur');
    const m = await OrgMembership.findOne({ user: outsider._id, orgUnit: tB.rootOrgUnit }).lean();
    const res = await request(app).patch(`/api/members/${m._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Admin' });
    // The membership belongs to another tenant — /api/members refuses.
    expect([403, 404]).toContain(res.status);
  });

  test('PROMOTE-08: last-admin invariant remains protected on demotion & removal', async () => {
    // Only one Admin left: demote admin2 first, then try to demote admin.
    const mA2 = await getM(admin2._id, tA);
    await request(app).patch(`/api/members/${mA2._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Collaborateur' });
    const mA = await getM(admin._id, tA);
    const demote = await request(app).patch(`/api/members/${mA._id}`).set(bearer(admin, tA._id)).send({ businessRole: 'Collaborateur' });
    expect(demote.status).toBe(409);
    expect(demote.body.code).toBe('LAST_TENANT_ADMIN');
    const del = await request(app).delete(`/api/members/${mA._id}`).set(bearer(admin, tA._id));
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('LAST_TENANT_ADMIN');
  });
});
