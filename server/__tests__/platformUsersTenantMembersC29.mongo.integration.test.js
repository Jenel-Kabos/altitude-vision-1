// C2.9 (Users) — séparation PLATFORM Users / TENANT Members.
//   Vue plateforme = User (rôle plateforme, organisations actives, opérateur)
//   Vue tenant     = OrgMembership (businessRole, statut, compte plateforme)
// L'appartenance organisationnelle canonique est une OrgMembership ACTIVE
// (même règle que tenantContextService.resolveAvailableTenantsForUser).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', require('../routes/userRoutes'));
app.use('/api/members', require('../routes/tenantMemberRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
let sequence = 0;
const makeUser = (role = 'Client', extra = {}) => {
  sequence += 1;
  return User.create({
    name: `C29U ${role} ${sequence}`, email: `c29u-${sequence}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true, ...extra,
  });
};
const registryItem = (res, user) => (res.body.data.items || []).find((item) => String(item._id) === String(user._id));

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.fA = await createTenantFixture({ label: 'C29U Tenant A', withAdminMembership: true });
  S.fB = await createTenantFixture({ label: 'C29U Tenant B', withAdminMembership: true });
  S.operator = await makeUser('Admin');
  await grantOperator({ userId: S.operator._id, actor: S.fA.bootstrap, reason: 'C29U operator', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  // Propriétaire plateforme, Admin métier de Tenant A.
  S.ownerAdmin = await makeUser('Proprietaire');
  await addTenantMember({ tenant: S.fA.tenant, user: S.ownerAdmin, bootstrap: S.fA.bootstrap, businessRole: 'Admin' });
  // Membre dont l'unique membership est révoquée : n'appartient plus à aucune organisation.
  S.formerMember = await makeUser('Client');
  await addTenantMember({ tenant: S.fA.tenant, user: S.formerMember, bootstrap: S.fA.bootstrap, businessRole: 'Collaborateur' });
  await OrgMembership.updateOne({ user: S.formerMember._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
  S.unaffiliated = await makeUser('Prestataire');
  S.collabB = (await createTenantUser({ tenant: S.fB.tenant, bootstrap: S.fB.bootstrap, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' })).user;
});
afterAll(stopFinancialMongo);

describe('C2.9U — Vue plateforme (User)', () => {
  test('liste tous les User ; le rôle affiché reste le rôle plateforme malgré une membership Admin', async () => {
    const res = await request(app).get('/api/users?limit=100').set(bearer(S.operator));
    expect(res.status).toBe(200);
    const owner = registryItem(res, S.ownerAdmin);
    expect(owner.role).toBe('Proprietaire');
    expect(owner.memberships.some((m) => m.businessRole === 'Admin' && m.status === 'active')).toBe(true);
    expect(registryItem(res, S.unaffiliated)).toBeTruthy();
    expect(registryItem(res, S.collabB)).toBeTruthy();
  });

  test('le PlatformOperator reste identifiable dans le registre', async () => {
    const res = await request(app).get('/api/users?limit=100').set(bearer(S.operator));
    expect(registryItem(res, S.operator).platformOperator).toMatchObject({ status: 'active' });
  });

  test('« Sans organisation » repose sur l’appartenance ACTIVE : une membership révoquée ne compte pas', async () => {
    const all = await request(app).get('/api/users?limit=100').set(bearer(S.operator));
    const withoutRes = await request(app).get('/api/users?limit=100&organization=without').set(bearer(S.operator));
    const withRes = await request(app).get('/api/users?limit=100&organization=with').set(bearer(S.operator));
    expect(registryItem(withoutRes, S.formerMember)).toBeTruthy();
    expect(registryItem(withRes, S.formerMember)).toBeFalsy();
    expect(registryItem(withRes, S.ownerAdmin)).toBeTruthy();
    expect(all.body.data.stats.withoutOrganization).toBe(withoutRes.body.data.total);
    expect(all.body.data.stats.withoutOrganization + withRes.body.data.total).toBe(all.body.data.total);
  });
});

describe('C2.9U — Vue tenant (OrgMembership)', () => {
  test('tenant A ne retourne que ses memberships non révoquées, avec businessRole et statut du compte plateforme', async () => {
    const res = await request(app).get('/api/members').set(bearer(S.operator, S.fA.tenant));
    expect(res.status).toBe(200);
    const members = res.body.data.members;
    const ids = members.map((m) => m.user?.id);
    expect(ids).toContain(String(S.ownerAdmin._id));
    expect(ids).not.toContain(String(S.formerMember._id));
    expect(ids).not.toContain(String(S.collabB._id));
    expect(ids).not.toContain(String(S.unaffiliated._id));
    expect(members.every((m) => m.status !== 'revoked')).toBe(true);
    const owner = members.find((m) => m.user?.id === String(S.ownerAdmin._id));
    expect(owner.businessRole).toBe('Admin');
    expect(owner.user.accountStatus).toEqual({ isActive: true, status: 'Actif' });
    expect(owner.user.role).toBeUndefined();
  });

  test('tenant B ne retourne que ses memberships (aucune fuite cross-tenant)', async () => {
    const res = await request(app).get('/api/members').set(bearer(S.operator, S.fB.tenant));
    const ids = res.body.data.members.map((m) => m.user?.id);
    expect(ids).toContain(String(S.collabB._id));
    expect(ids).not.toContain(String(S.ownerAdmin._id));
  });

  test('l’Admin métier de A ne lit pas les membres de B', async () => {
    const res = await request(app).get('/api/members').set(bearer(S.ownerAdmin, S.fB.tenant));
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });
});
