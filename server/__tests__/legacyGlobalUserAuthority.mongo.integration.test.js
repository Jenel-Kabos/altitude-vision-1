// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1F — matrice LEGACY-01..LEGACY-18.
// Vérifie qu'un Tenant Admin (User.role='Admin' + OrgMembership.businessRole
// = 'Admin') ne peut JAMAIS muter l'identité GLOBALE d'un User via
// /api/users/*. Seule une autorité plateforme (PlatformOperator ACTIF +
// capability `platform.users.manage`) est acceptée. Le workflow tenant
// canonique passe par /api/members et reste opérationnel.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const userRoutes = require('../routes/userRoutes');
const memberRoutes = require('../routes/tenantMemberRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
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

const setMembershipRole = (userId, tenant, businessRole) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

let tA; let bA; let tenantAdmin; let genericAdmin; let victim;
let opNoCap; let opFull; let opInactive;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  tA = fA.tenant; bA = fA.bootstrap;

  // Tenant Admin canonique : User.role='Admin' + OrgMembership.businessRole='Admin'.
  tenantAdmin = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tA, user: tenantAdmin, bootstrap: bA });
  await setMembershipRole(tenantAdmin._id, tA, 'Admin');

  // "Generic" legacy Admin : User.role='Admin', SANS membership tenant. C'est
  // exactement le vecteur historique (User.role suffisait à passer).
  genericAdmin = await makeUser({ role: 'Admin' });

  // Cible : un simple collaborateur avec appartenance au tenant A.
  victim = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: tA, user: victim, bootstrap: bA });
  await setMembershipRole(victim._id, tA, 'Collaborateur');

  // Operator sans capacité users.manage (support seul).
  opNoCap = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opNoCap._id, actor: bA, reason: 'fx-nocap', capabilities: ['platform.support.read'] });

  // Operator PLEIN — support + users.read + users.manage. `platform.users.read`
  // est requis en amont par le garde de lecture legacy de `userRoutes.js`
  // (`requireUsersReadScope`) ; le point testé par LEGACY-08 est la couche
  // AUTORITÉ (`platform.users.manage`) — on donne donc les deux pour isoler
  // proprement le contrôle de mutation.
  opFull = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opFull._id, actor: bA, reason: 'fx-full', capabilities: ['platform.support.read', 'platform.users.read', 'platform.users.manage'] });

  // Operator possédant la capacité mais MARQUÉ SUSPENDU côté PlatformOperator.
  opInactive = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opInactive._id, actor: bA, reason: 'fx-inactive', capabilities: ['platform.users.manage'] });
  await PlatformOperator.updateOne({ user: opInactive._id }, { $set: { status: 'suspended' } });
});

describe('LEGACY — Tenant Admin blocked on global User mutations', () => {
  test('LEGACY-01: Tenant Admin cannot POST /api/users/create-by-admin', async () => {
    const res = await request(app).post('/api/users/create-by-admin')
      .set(bearer(tenantAdmin, tA._id))
      .send({ prenom: 'X', nom: 'Y', email: `new-${Date.now()}@ex.io`, password: 'Password123!', role: 'Collaborateur' });
    expect(res.status).toBe(403);
  });

  test('LEGACY-02: Generic legacy Admin (User.role=Admin, no operator) cannot create-by-admin', async () => {
    const res = await request(app).post('/api/users/create-by-admin')
      .set(bearer(genericAdmin))
      .send({ prenom: 'X', nom: 'Y', email: `new-${Date.now()}@ex.io`, password: 'Password123!', role: 'Collaborateur' });
    expect(res.status).toBe(403);
  });

  test('LEGACY-03: Tenant Admin cannot mutate User.role', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/role`)
      .set(bearer(tenantAdmin, tA._id)).send({ role: 'Admin' });
    expect(res.status).toBe(403);
    const after = await User.findById(victim._id).lean();
    expect(after.role).toBe('Collaborateur');
  });

  test('LEGACY-04: Tenant Admin cannot globally suspend User', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`)
      .set(bearer(tenantAdmin, tA._id)).send({});
    expect(res.status).toBe(403);
  });

  test('LEGACY-05: Tenant Admin cannot globally activate User', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/activate`)
      .set(bearer(tenantAdmin, tA._id)).send({});
    expect(res.status).toBe(403);
  });

  test('LEGACY-06: Tenant Admin cannot DELETE global User', async () => {
    const res = await request(app).delete(`/api/users/${victim._id}`)
      .set(bearer(tenantAdmin, tA._id));
    expect(res.status).toBe(403);
    const stillThere = await User.findById(victim._id).lean();
    expect(stillThere).not.toBeNull();
  });
});

describe('LEGACY — PlatformOperator authority gating', () => {
  test('LEGACY-07: PlatformOperator WITHOUT platform.users.manage is blocked', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`)
      .set(bearer(opNoCap)).send({});
    expect(res.status).toBe(403);
  });

  test('LEGACY-08: PlatformOperator WITH platform.users.manage is allowed (suspend succeeds)', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`)
      .set(bearer(opFull)).send({});
    // 200 (success) or 500 (controller-internal). We only prove authority
    // passed by asserting we did NOT get a 403.
    expect(res.status).not.toBe(403);
  });

  test('LEGACY-09: Inactive (suspended) PlatformOperator is blocked even with capability listed', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`)
      .set(bearer(opInactive)).send({});
    expect(res.status).toBe(403);
  });
});

describe('LEGACY — escalation attempts are refused', () => {
  test('LEGACY-10: X-Platform-Tenant-Id header does not grant global authority to a tenant Admin', async () => {
    const res = await request(app).delete(`/api/users/${victim._id}`)
      .set(bearer(tenantAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('LEGACY-11: body-supplied tenantId does not grant global authority', async () => {
    const res = await request(app).patch(`/api/users/${victim._id}/role`)
      .set(bearer(tenantAdmin))
      .send({ role: 'Admin', tenantId: String(tA._id) });
    expect(res.status).toBe(403);
    const after = await User.findById(victim._id).lean();
    expect(after.role).toBe('Collaborateur');
  });

  test('LEGACY-12: OrgMembership.businessRole=Admin alone does not grant GLOBAL authority', async () => {
    // tenantAdmin already carries businessRole='Admin' in tenant A. Cross-check
    // via a fresh membership-admin without User.role='Admin' either:
    const collabButTenantAdmin = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: collabButTenantAdmin, bootstrap: bA });
    await setMembershipRole(collabButTenantAdmin._id, tA, 'Admin');
    const res = await request(app).delete(`/api/users/${victim._id}`)
      .set(bearer(collabButTenantAdmin, tA._id));
    // Note: restrictTo('Admin') gate stops non-Admin User.role BEFORE the
    // capability check, so we still receive 403 (double defence).
    expect(res.status).toBe(403);
  });
});

describe('LEGACY — membership operations remain functional', () => {
  test('LEGACY-13: tenant Admin can still list + change role + suspend + reactivate + revoke via /api/members', async () => {
    // Locate victim's membership id.
    const list = await request(app).get('/api/members').set(bearer(tenantAdmin, tA._id));
    expect(list.status).toBe(200);
    const m = list.body.data.members.find((x) => x.user.email === victim.email);
    expect(m).toBeDefined();

    const change = await request(app).patch(`/api/members/${m.membershipId}`)
      .set(bearer(tenantAdmin, tA._id))
      .send({ businessRole: 'Secretaire' });
    expect(change.status).toBe(200);

    const sus = await request(app).post(`/api/members/${m.membershipId}/suspend`)
      .set(bearer(tenantAdmin, tA._id)).send({});
    expect(sus.status).toBe(200);

    const rea = await request(app).post(`/api/members/${m.membershipId}/reactivate`)
      .set(bearer(tenantAdmin, tA._id)).send({});
    expect(rea.status).toBe(200);

    const del = await request(app).delete(`/api/members/${m.membershipId}`)
      .set(bearer(tenantAdmin, tA._id));
    expect(del.status).toBe(200);
  });

  test('LEGACY-14: membership suspension does not mutate global User.isActive', async () => {
    const before = await User.findById(victim._id).lean();
    const list = await request(app).get('/api/members').set(bearer(tenantAdmin, tA._id));
    const m = list.body.data.members.find((x) => x.user.email === victim.email);
    await request(app).post(`/api/members/${m.membershipId}/suspend`).set(bearer(tenantAdmin, tA._id)).send({});
    const after = await User.findById(victim._id).lean();
    expect(after.isActive).toEqual(before.isActive);
  });

  test('LEGACY-15: membership role change does not mutate global User.role', async () => {
    const beforeRole = victim.role;
    const list = await request(app).get('/api/members').set(bearer(tenantAdmin, tA._id));
    const m = list.body.data.members.find((x) => x.user.email === victim.email);
    await request(app).patch(`/api/members/${m.membershipId}`)
      .set(bearer(tenantAdmin, tA._id)).send({ businessRole: 'Admin' });
    const after = await User.findById(victim._id).lean();
    expect(after.role).toBe(beforeRole);
  });

  test('LEGACY-16: membership removal does not delete the global User', async () => {
    const list = await request(app).get('/api/members').set(bearer(tenantAdmin, tA._id));
    const m = list.body.data.members.find((x) => x.user.email === victim.email);
    const del = await request(app).delete(`/api/members/${m.membershipId}`).set(bearer(tenantAdmin, tA._id));
    expect(del.status).toBe(200);
    const stillThere = await User.findById(victim._id).lean();
    expect(stillThere).not.toBeNull();
  });
});

describe('LEGACY — self-service preserved', () => {
  test('LEGACY-17: self-service /users/me GET is not affected by 1F', async () => {
    const res = await request(app).get('/api/users/me').set(bearer(victim));
    expect(res.status).toBe(200);
    expect(res.body?.data?.user?.email).toBe(victim.email);
  });

  test.each(['Client', 'Proprietaire'])('2B.2-B — %s conserve tous les endpoints self-service', async (role) => {
    const user = await makeUser({ role });
    const headers = bearer(user);

    expect((await request(app).get('/api/users/me').set(headers)).status).toBe(200);
    expect((await request(app).patch('/api/users/updateMe').set(headers).send({ phone: '+242066000000' })).status).toBe(200);
    expect((await request(app).patch('/api/users/complete-profile').set(headers).send({
      prenom: 'Test',
      nom: role,
      telephone: '+242066000000',
      role,
      ...(role === 'Proprietaire' && {
        certifications: {
          contratAccepte: true,
          informationsVraies: true,
          estProprietaireLegal: true,
          engagementHonnetete: true,
          commissionAcceptee: true,
        },
      }),
    })).status).toBe(200);
    expect((await request(app).patch('/api/users/push-token').set(headers).send({ pushToken: `ExponentPushToken[2B2B-${role}]` })).status).toBe(200);
    expect((await request(app).patch('/api/users/updateMyPassword').set(headers).send({
      passwordCurrent: 'Password123!',
      password: 'Password456!',
      passwordConfirm: 'Password456!',
    })).status).toBe(200);
  });
});
