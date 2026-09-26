// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D — matrice MEMAPI-01…28 sur
// vraie DB Mongo (replica set) via un harness express minimal :
//   /api/members (mounted with the canonical route module)

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
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

const setRole = (userId, tenant, businessRole) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
  { $set: { businessRole } },
);

let tA; let tB; let bA; let bB;
let adminA; let adminA2; let collabA; let clientExt; let ownerExt; let providerExt; let opGlobal;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap; tB = fB.tenant; bB = fB.bootstrap;
  // Admin canonique du tenant A pour toutes les mutations.
  adminA = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tA, user: adminA, bootstrap: bA });
  await setRole(adminA._id, tA, 'Admin');
  adminA2 = await makeUser({ role: 'Admin' });
  await addTenantMember({ tenant: tA, user: adminA2, bootstrap: bA });
  await setRole(adminA2._id, tA, 'Admin');
  collabA = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: tA, user: collabA, bootstrap: bA });
  await setRole(collabA._id, tA, 'Collaborateur');
  clientExt = await makeUser({ role: 'Client' });
  ownerExt = await makeUser({ role: 'Proprietaire' });
  providerExt = await makeUser({ role: 'Prestataire' });
  opGlobal = await makeUser({ role: 'Admin' });
  // PLATFORM-SUPER-ADMIN OPTION-3 : MEMAPI-17 vérifie qu'un PlatformOperator
  // SANS platform.users.manage reste refusé. La capability platform.support.read
  // seule ne peut pas administrer les membres — invariant capability-specific.
  await grantOperator({ userId: opGlobal._id, actor: bA, reason: 'fixture', capabilities: ['platform.support.read'] });
});

describe('MEMAPI — listing', () => {
  test('MEMAPI-01 · MEMAPI-25/26/27: Admin lists only own tenant members; external roles NOT listed', async () => {
    // clientExt/ownerExt/providerExt: aucune membership → n'apparaissent pas.
    const res = await request(app).get('/api/members').set(bearer(adminA, tA._id));
    expect(res.status).toBe(200);
    const emails = res.body.data.members.map((m) => m.user.email).sort();
    expect(emails).toContain(adminA.email);
    expect(emails).toContain(adminA2.email);
    expect(emails).toContain(collabA.email);
    expect(emails).not.toContain(clientExt.email);
    expect(emails).not.toContain(ownerExt.email);
    expect(emails).not.toContain(providerExt.email);
  });

  test('MEMAPI-02: same User appears with different roles in A/B', async () => {
    // Ajouter collabA au tenant B avec un rôle différent.
    await addTenantMember({ tenant: tB, user: collabA, bootstrap: bB });
    await setRole(collabA._id, tB, 'GestionnaireImmobilier');

    const rA = await request(app).get('/api/members').set(bearer(adminA, tA._id));
    const collabInA = rA.body.data.members.find((m) => m.user.email === collabA.email);
    expect(collabInA.businessRole).toBe('Collaborateur');
    // Créer un admin propre à B pour ne pas dépendre d'adminA.
    const adminB = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tB, user: adminB, bootstrap: bB });
    await setRole(adminB._id, tB, 'Admin');
    const rB = await request(app).get('/api/members').set(bearer(adminB, tB._id));
    const collabInB = rB.body.data.members.find((m) => m.user.email === collabA.email);
    expect(collabInB.businessRole).toBe('GestionnaireImmobilier');
  });
});

describe('MEMAPI — add member', () => {
  test('MEMAPI-03 · MEMAPI-04: add existing global User by email; User count stays 1', async () => {
    const alice = await makeUser({ role: 'Client', email: 'alice-existing@example.test' });
    const res = await request(app).post('/api/members')
      .set(bearer(adminA, tA._id))
      .send({ email: alice.email, businessRole: 'Collaborateur' });
    expect(res.status).toBe(201);
    expect(res.body.data.member.user.email).toBe(alice.email);
    expect(await User.countDocuments({ email: alice.email })).toBe(1);
  });

  test('MEMAPI-05: unknown email → 404 USER_NOT_FOUND_INVITATION_REQUIRED, no User created', async () => {
    const before = await User.countDocuments({});
    const res = await request(app).post('/api/members')
      .set(bearer(adminA, tA._id))
      .send({ email: 'ghost@example.test', businessRole: 'Collaborateur' });
    expect(res.status).toBe(404);
    expect(await User.countDocuments({})).toBe(before);
  });

  test('MEMAPI-06: invalid external role rejected', async () => {
    const bob = await makeUser({ role: 'Client', email: 'bob-ext@example.test' });
    const res = await request(app).post('/api/members')
      .set(bearer(adminA, tA._id))
      .send({ email: bob.email, businessRole: 'Proprietaire' });
    expect(res.status).toBe(400);
  });

  test('MEMAPI-23: duplicate active membership rejected explicitly', async () => {
    const res = await request(app).post('/api/members')
      .set(bearer(adminA, tA._id))
      .send({ userId: String(collabA._id), businessRole: 'Collaborateur' });
    expect(res.status).toBe(409);
  });
});

describe('MEMAPI — change role', () => {
  test('MEMAPI-07 · MEMAPI-08: change role affects only target membership; User.role untouched', async () => {
    // collabA is a member of A with Collaborateur; also add him to B with a different role.
    await addTenantMember({ tenant: tB, user: collabA, bootstrap: bB });
    await setRole(collabA._id, tB, 'GestionnaireImmobilier');
    const collabMembershipA = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, status: 'active' }).lean();
    const res = await request(app).patch(`/api/members/${collabMembershipA._id}`)
      .set(bearer(adminA, tA._id))
      .send({ businessRole: 'Secretaire' });
    expect(res.status).toBe(200);
    expect(res.body.data.member.businessRole).toBe('Secretaire');
    const inB = await OrgMembership.findOne({ user: collabA._id, orgUnit: tB.rootOrgUnit, status: 'active' }).lean();
    expect(inB.businessRole).toBe('GestionnaireImmobilier'); // unchanged
    const user = await User.findById(collabA._id).select('role').lean();
    expect(user.role).toBe('Collaborateur'); // User.role untouched
  });
});

describe('MEMAPI — suspend / reactivate / revoke', () => {
  test('MEMAPI-09 · MEMAPI-10: suspend only target tenant membership; other tenant unaffected', async () => {
    await addTenantMember({ tenant: tB, user: collabA, bootstrap: bB });
    await setRole(collabA._id, tB, 'Collaborateur');
    const mA = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, status: 'active' }).lean();
    const res = await request(app).post(`/api/members/${mA._id}/suspend`).set(bearer(adminA, tA._id)).send({ reason: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe('suspended');
    const inB = await OrgMembership.findOne({ user: collabA._id, orgUnit: tB.rootOrgUnit }).lean();
    expect(inB.status).toBe('active');
    const user = await User.findById(collabA._id).select('status isActive').lean();
    expect(user.isActive).toBe(true); // User global untouched
  });

  test('MEMAPI-11: reactivate suspended membership', async () => {
    const mA = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, status: 'active' }).lean();
    await OrgMembership.updateOne({ _id: mA._id }, { $set: { status: 'suspended' } });
    const res = await request(app).post(`/api/members/${mA._id}/reactivate`).set(bearer(adminA, tA._id));
    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe('active');
  });

  test('MEMAPI-12 · MEMAPI-13: DELETE → revoked; User preserved and still authenticatable', async () => {
    const mA = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, status: 'active' }).lean();
    const res = await request(app).delete(`/api/members/${mA._id}`).set(bearer(adminA, tA._id));
    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe('revoked');
    expect(await User.countDocuments({ _id: collabA._id })).toBe(1); // User global preserved
    // Sanity : le User conserve son statut d'activité.
    const u = await User.findById(collabA._id).select('isActive status').lean();
    expect(u.isActive).toBe(true);
  });
});

describe('MEMAPI — forgery + authority', () => {
  test('MEMAPI-14: forged membershipId belonging to tenant B is rejected from tenant A context', async () => {
    // Add a member to tenant B.
    const otherAdminB = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tB, user: otherAdminB, bootstrap: bB });
    await setRole(otherAdminB._id, tB, 'Admin');
    const foreignMember = await OrgMembership.findOne({ user: otherAdminB._id, orgUnit: tB.rootOrgUnit }).lean();
    // adminA (tenant A) tries to touch the tenant-B membership.
    const res = await request(app).patch(`/api/members/${foreignMember._id}`)
      .set(bearer(adminA, tA._id)).send({ businessRole: 'Collaborateur' });
    expect(res.status).toBe(404);
  });

  test('MEMAPI-15: forged body tenant cannot reroute authority', async () => {
    const mA = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, status: 'active' }).lean();
    // Body claims a different tenant — must be ignored.
    const res = await request(app).patch(`/api/members/${mA._id}`)
      .set(bearer(adminA, tA._id))
      .send({ businessRole: 'Secretaire', tenantId: String(tB._id), tenant: String(tB._id) });
    expect(res.status).toBe(200);
    expect(res.body.data.member.businessRole).toBe('Secretaire');
  });

  test('MEMAPI-16: Generic Admin without membership denied', async () => {
    const bareAdmin = await makeUser({ role: 'Admin' });
    const res = await request(app).get('/api/members').set(bearer(bareAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('MEMAPI-17: PlatformOperator sans platform.users.manage refusé sur mutation (invariant capability-specific)', async () => {
    // PLATFORM-SUPER-ADMIN OPTION-3 : un PlatformOperator actif MAIS sans la
    // capability platform.users.manage ne peut jamais muter les membres,
    // même s'il détient d'autres capabilities plateforme (ici support.read).
    // Prouve que Option 3 ne dégénère jamais en bypass générique — l'autorité
    // reste rigoureusement capability-specific. Voir platformMemberAdministration
    // pour la matrice complète P-MEMBER-01..16.
    const res = await request(app).delete(`/api/members/${(await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit }))._id}`)
      .set(bearer(opGlobal, tA._id));
    expect(res.status).toBe(403);
  });

  test('MEMAPI-18: Collaborateur cannot manage members', async () => {
    const res = await request(app).post('/api/members').set(bearer(collabA, tA._id))
      .send({ email: 'anyone@example.test', businessRole: 'Collaborateur' });
    expect(res.status).toBe(403);
  });
});

describe('MEMAPI — last-admin protection', () => {
  test('MEMAPI-19 · MEMAPI-20 · MEMAPI-21: last Admin cannot be suspended / revoked / demoted', async () => {
    // Revoke the second admin so only adminA remains as Admin.
    const mA2 = await OrgMembership.findOne({ user: adminA2._id, orgUnit: tA.rootOrgUnit }).lean();
    await OrgMembership.updateOne({ _id: mA2._id }, { $set: { status: 'revoked' } });

    const mA = await OrgMembership.findOne({ user: adminA._id, orgUnit: tA.rootOrgUnit }).lean();
    const suspend = await request(app).post(`/api/members/${mA._id}/suspend`).set(bearer(adminA, tA._id));
    expect(suspend.status).toBe(409);
    const revoke = await request(app).delete(`/api/members/${mA._id}`).set(bearer(adminA, tA._id));
    expect(revoke.status).toBe(409);
    const demote = await request(app).patch(`/api/members/${mA._id}`).set(bearer(adminA, tA._id)).send({ businessRole: 'Collaborateur' });
    expect(demote.status).toBe(409);
  });

  test('MEMAPI-22: two concurrent admin removals cannot leave zero Admin', async () => {
    const mA = await OrgMembership.findOne({ user: adminA._id, orgUnit: tA.rootOrgUnit }).lean();
    const mA2 = await OrgMembership.findOne({ user: adminA2._id, orgUnit: tA.rootOrgUnit }).lean();
    const [r1, r2] = await Promise.all([
      request(app).delete(`/api/members/${mA._id}`).set(bearer(adminA2, tA._id)),
      request(app).delete(`/api/members/${mA2._id}`).set(bearer(adminA, tA._id)),
    ]);
    const remainingAdmins = await OrgMembership.countDocuments({ orgUnit: tA.rootOrgUnit, status: 'active', businessRole: 'Admin' });
    expect(remainingAdmins).toBeGreaterThanOrEqual(1);
    // Un seul des deux DELETE a pu réussir avec 200 ; l'autre a été refusé (409).
    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([200, 409]);
  });
});

describe('MEMAPI — ambiguity + search + external', () => {
  test('MEMAPI-24: ambiguous active memberships fail closed on mutation', async () => {
    // Create a SECOND active membership on same rootOrgUnit with different roleInUnit.
    const secondM = await OrgMembership.create({
      user: collabA._id, orgUnit: tA.rootOrgUnit, roleInUnit: 'manager', status: 'active', businessRole: 'Collaborateur',
    });
    const anyMembership = await OrgMembership.findOne({ user: collabA._id, orgUnit: tA.rootOrgUnit, roleInUnit: 'member' }).lean();
    const res = await request(app).patch(`/api/members/${anyMembership._id}`).set(bearer(adminA, tA._id)).send({ businessRole: 'Secretaire' });
    expect(res.status).toBe(409);
    await OrgMembership.deleteOne({ _id: secondM._id }); // cleanup
  });

  test('MEMAPI-28: search-user exact-email finds existing global User (minimal disclosure)', async () => {
    const bob = await makeUser({ role: 'Client', email: 'bob-search@example.test', name: 'Bob' });
    const res = await request(app).get(`/api/members/search-user?email=${encodeURIComponent(bob.email)}`).set(bearer(adminA, tA._id));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: bob.email, name: 'Bob' });
    expect(res.body.data.user.id).toBe(String(bob._id));
    // Négative case.
    const miss = await request(app).get('/api/members/search-user?email=nobody@example.test').set(bearer(adminA, tA._id));
    expect(miss.status).toBe(404);
  });
});
