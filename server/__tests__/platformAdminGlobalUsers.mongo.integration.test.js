const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const userRoutes = require('../routes/userRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let sequence = 0;
const makeUser = ({ label, role = 'Client', phone = null, status = 'Actif', isActive = true } = {}) => {
  sequence += 1;
  const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return User.create({
    name: `Global ${label} ${sequence}`,
    email: `global-${slug}-${sequence}-${Date.now()}@example.test`,
    phone,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
    status,
    isActive,
    isEmailVerified: true,
  });
};

let reader;
let tenantA;
let tenantB;
let userA;
let userB;
let unaffiliated;
let multiTenant;
let suspended;
let operatorUser;
let manager;
let partialReader;
let wrongCapability;
let inactiveReader;
let legacyAdmin;
let tenantAdminA;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Global Users A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'Global Users B', withAdminMembership: true });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  tenantAdminA = fixtureA.bootstrap;

  userA = (await createTenantUser({
    tenant: tenantA,
    bootstrap: fixtureA.bootstrap,
    businessRole: 'Collaborateur',
    overrides: { name: 'Alice Tenant A', phone: '+242060000001' },
  })).user;
  userB = (await createTenantUser({
    tenant: tenantB,
    bootstrap: fixtureB.bootstrap,
    businessRole: 'GestionnaireImmobilier',
    overrides: { name: 'Brice Tenant B', phone: '+242060000002' },
  })).user;
  unaffiliated = await makeUser({ label: 'Unattached', role: 'Proprietaire', phone: '+242060000003' });
  multiTenant = await makeUser({ label: 'Multi Tenant', phone: '+242060000004' });
  await addTenantMember({ tenant: tenantA, user: multiTenant, bootstrap: fixtureA.bootstrap, businessRole: 'Admin' });
  await addTenantMember({ tenant: tenantB, user: multiTenant, bootstrap: fixtureB.bootstrap, businessRole: 'Collaborateur' });
  suspended = await makeUser({ label: 'Suspended', status: 'Suspendu', isActive: false });
  operatorUser = await makeUser({ label: 'Operator' });
  reader = await makeUser({ label: 'Reader' });
  manager = await makeUser({ label: 'Manager' });
  partialReader = await makeUser({ label: 'Partial Reader' });
  wrongCapability = await makeUser({ label: 'Wrong Capability' });
  inactiveReader = await makeUser({ label: 'Inactive Reader' });
  legacyAdmin = await makeUser({ label: 'Legacy Admin', role: 'Admin' });
  // PLATFORM-ADMIN-04A — le registre global relève de la Vue plateforme :
  // lecteur et gestionnaire globaux sont des administrateurs éligibles ;
  // `partialReader` (users.read seul) n'entre plus en Vue plateforme.
  await grantOperator({
    userId: reader._id,
    actor: fixtureA.bootstrap,
    reason: 'PLATFORM-ADMIN-02 reader',
    capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES],
  });
  await grantOperator({ userId: manager._id, actor: fixtureA.bootstrap, reason: 'PLATFORM-ADMIN-02 manager', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  await grantOperator({ userId: partialReader._id, actor: fixtureA.bootstrap, reason: 'PA04A partial reader', capabilities: ['platform.users.read'] });
  await grantOperator({ userId: wrongCapability._id, actor: fixtureA.bootstrap, reason: 'PLATFORM-ADMIN-02 wrong capability', capabilities: ['platform.properties.read'] });
  await grantOperator({ userId: inactiveReader._id, actor: fixtureA.bootstrap, reason: 'PLATFORM-ADMIN-02 inactive reader', capabilities: ['platform.users.read'] });
  await PlatformOperator.updateOne({ user: inactiveReader._id }, { $set: { status: 'suspended' } });
  await grantOperator({
    userId: operatorUser._id,
    actor: fixtureA.bootstrap,
    reason: 'PLATFORM-ADMIN-02 operator population',
    capabilities: ['platform.properties.read'],
  });
});

describe('PLATFORM-ADMIN-02 — authority and lifecycle invariants', () => {
  test('enforces read/manage separation and rejects non-canonical authorities', async () => {
    const target = await makeUser({ label: 'Read Only Mutation Target' });
    const [read, readOnlyMutation, wrong, inactive, adminOnly, tenantOnly, invalidTenant] = await Promise.all([
      request(app).get('/api/users').set(bearer(reader)),
      request(app).patch(`/api/users/${target._id}/suspend`).set(bearer(partialReader)),
      request(app).get('/api/users').set(bearer(wrongCapability)),
      request(app).get('/api/users').set(bearer(inactiveReader)),
      request(app).get('/api/users').set(bearer(legacyAdmin)),
      request(app).get('/api/users').set(bearer(tenantAdminA, tenantA._id)),
      request(app).get('/api/users').set(bearer(reader, new mongoose.Types.ObjectId())),
    ]);

    expect(read.status).toBe(200);
    expect(readOnlyMutation.status).toBe(403);
    const partialRead = await request(app).get('/api/users').set(bearer(partialReader));
    expect(partialRead.status).toBe(403);
    expect(partialRead.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
    expect(wrong.status).toBe(403);
    expect(inactive.status).toBe(403);
    expect(adminOnly.status).toBe(403);
    expect(tenantOnly.status).toBe(200);
    expect(tenantOnly.body.data.users.map((item) => String(item._id))).not.toContain(String(userB._id));
    expect(invalidTenant.status).toBe(403);
  });

  test('users.manage suspends an ordinary historical Admin without granting platform authority', async () => {
    const target = await makeUser({ label: 'Ordinary Historical Admin', role: 'Admin' });
    const res = await request(app).patch(`/api/users/${target._id}/suspend`).set(bearer(manager));

    expect(res.status).toBe(200);
    await expect(User.findById(target._id).lean()).resolves.toMatchObject({ status: 'Suspendu', isActive: false });
    await expect(PlatformOperator.findOne({ user: target._id })).resolves.toBeNull();
  });

  test('administrative self suspension and self deletion are refused', async () => {
    const suspend = await request(app).patch(`/api/users/${manager._id}/suspend`).set(bearer(manager));
    const remove = await request(app).delete(`/api/users/${manager._id}`).set(bearer(manager));

    expect([403, 409]).toContain(suspend.status);
    expect(remove.status).toBe(403);
    await expect(User.findById(manager._id).lean()).resolves.toMatchObject({ status: 'Actif', isActive: true });
  });

  // PLATFORM-ADMIN-04A — en Vue plateforme, l'acteur est toujours éligible,
  // donc lui-même opérateur viable (platform.operators.manage est requis) :
  // la protection « dernier opérateur viable » ne peut plus être atteinte via
  // un tiers ; elle reste effective pour le dernier viable agissant sur lui-même.
  test('protects the final viable operator through Global Users and permits removal when another remains', async () => {
    // `reader` reste éligible pour les tests de registre qui suivent.
    await PlatformOperator.updateMany({ user: { $nin: [manager._id, reader._id] } }, { $pull: { capabilities: 'platform.operators.manage' } });
    const finalViable = await makeUser({ label: 'Final Viable' });
    await grantOperator({ userId: finalViable._id, actor: manager, reason: 'final viable fixture', capabilities: ['platform.operators.manage'] });

    const allowed = await request(app).patch(`/api/users/${finalViable._id}/suspend`).set(bearer(manager));
    expect(allowed.status).toBe(200);
    await expect(PlatformOperator.findOne({ user: finalViable._id }).lean()).resolves.toMatchObject({ status: 'suspended' });

    const denied = await request(app).patch(`/api/users/${manager._id}/suspend`).set(bearer(manager));
    expect([403, 409]).toContain(denied.status);
    await expect(PlatformOperator.findOne({ user: manager._id }).lean()).resolves.toMatchObject({ status: 'active' });
    await expect(User.findById(manager._id).lean()).resolves.toMatchObject({ status: 'Actif', isActive: true });
  });

  test('reactivation leaves memberships untouched', async () => {
    const before = await OrgMembership.find({ user: suspended._id }).lean();
    const res = await request(app).patch(`/api/users/${suspended._id}/activate`).set(bearer(manager));
    const after = await OrgMembership.find({ user: suspended._id }).lean();

    expect(res.status).toBe(200);
    expect(after).toEqual(before);
    await expect(User.findById(suspended._id).lean()).resolves.toMatchObject({ status: 'Actif', isActive: true });
  });

  test('hard deletion preserves every identity with PlatformOperator history', async () => {
    const formerOperator = await makeUser({ label: 'Former Operator' });
    await grantOperator({ userId: formerOperator._id, actor: manager, reason: 'operator history fixture', capabilities: ['platform.properties.read'] });
    await PlatformOperator.updateOne({ user: formerOperator._id }, { $set: { status: 'revoked' } });

    const res = await request(app).delete(`/api/users/${formerOperator._id}`).set(bearer(manager));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_HARD_DELETE_REQUIRES_HUMAN_DECISION');
    await expect(User.findById(formerOperator._id)).resolves.not.toBeNull();
  });
});

afterAll(async () => stopFinancialMongo());

describe('PLATFORM-ADMIN-02 — global user registry contract', () => {
  test('returns every user population once with batched membership summaries', async () => {
    const res = await request(app).get('/api/users?limit=100&sort=name').set(bearer(reader));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      page: 1,
      limit: 100,
      total: expect.any(Number),
      totalPages: expect.any(Number),
      stats: expect.objectContaining({ total: expect.any(Number), active: expect.any(Number), suspended: expect.any(Number), withoutOrganization: expect.any(Number) }),
    }));
    const items = res.body.data.items;
    const ids = items.map((item) => String(item._id));
    expect(ids).toEqual(expect.arrayContaining([
      String(userA._id), String(userB._id), String(unaffiliated._id), String(multiTenant._id), String(suspended._id), String(operatorUser._id),
    ]));
    expect(ids.filter((id) => id === String(multiTenant._id))).toHaveLength(1);
    expect(items.find((item) => String(item._id) === String(multiTenant._id)).memberships).toHaveLength(2);
    expect(items.find((item) => String(item._id) === String(unaffiliated._id))).toMatchObject({ memberships: [], tenantCount: 0 });
    expect(items.find((item) => String(item._id) === String(operatorUser._id)).platformOperator).toMatchObject({ status: 'active' });
  });

  test('paginates on the server and returns stable metadata beyond the last page', async () => {
    const first = await request(app).get('/api/users?page=1&limit=2&sort=oldest').set(bearer(reader));
    const beyond = await request(app).get('/api/users?page=999&limit=2').set(bearer(reader));

    expect(first.status).toBe(200);
    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.total).toBeGreaterThan(2);
    expect(first.body.data.totalPages).toBe(Math.ceil(first.body.data.total / 2));
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.items).toEqual([]);
    expect(beyond.body.data.page).toBe(999);
    expect(beyond.body.data.total).toBe(first.body.data.total);
  });

  test('searches globally by name, email, and telephone', async () => {
    const cases = [
      ['Alice Tenant A', userA],
      [unaffiliated.email, unaffiliated],
      ['+242060000002', userB],
    ];
    for (const [search, expectedUser] of cases) {
      const res = await request(app).get('/api/users').query({ search }).set(bearer(reader));
      expect(res.status).toBe(200);
      expect(res.body.data.items.map((item) => String(item._id))).toContain(String(expectedUser._id));
    }
  });

  test('treats regex metacharacters as literal search text', async () => {
    const res = await request(app).get('/api/users').query({ search: '.*[global]\\' }).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  test('supports real filters and rejects unsafe sort or malformed tenant filters', async () => {
    const suspendedForFilter = await makeUser({ label: 'Suspended Filter', status: 'Suspendu', isActive: false });
    const [withoutOrg, tenant, operators, suspendedOnly, invalidSort, invalidTenant] = await Promise.all([
      request(app).get('/api/users?organization=without&limit=100').set(bearer(reader)),
      request(app).get(`/api/users?tenantId=${tenantB._id}&limit=100`).set(bearer(reader)),
      request(app).get('/api/users?operator=true&limit=100').set(bearer(reader)),
      request(app).get('/api/users?status=Suspendu&active=false&limit=100').set(bearer(reader)),
      request(app).get('/api/users?sort=%24where').set(bearer(reader)),
      request(app).get('/api/users?tenantId=not-an-object-id').set(bearer(reader)),
    ]);

    expect(withoutOrg.status).toBe(200);
    expect(withoutOrg.body.data.items.every((item) => item.tenantCount === 0)).toBe(true);
    expect(tenant.status).toBe(200);
    expect(tenant.body.data.items.map((item) => String(item._id))).toEqual(expect.arrayContaining([String(userB._id), String(multiTenant._id)]));
    expect(operators.status).toBe(200);
    expect(operators.body.data.items.every((item) => item.platformOperator)).toBe(true);
    expect(suspendedOnly.status).toBe(200);
    expect(suspendedOnly.body.data.items.map((item) => String(item._id))).toContain(String(suspendedForFilter._id));
    expect(invalidSort.status).toBe(400);
    expect(invalidTenant.status).toBe(400);
  });

  test('uses an explicit safe projection for list and detail responses', async () => {
    await User.collection.updateOne({ _id: unaffiliated._id }, {
      $set: {
        passwordResetToken: 'never-return-reset-token',
        emailVerificationToken: 'never-return-verification-token',
        tokenVersion: 42,
        pushToken: 'never-return-push-token',
      },
    });
    const list = await request(app).get('/api/users?limit=100').set(bearer(reader));
    const detail = await request(app).get(`/api/users/${unaffiliated._id}`).set(bearer(reader));
    const serialized = JSON.stringify({ list: list.body, detail: detail.body });

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    ['password', 'passwordResetToken', 'emailVerificationToken', 'tokenVersion', 'pushToken', 'contratPdfAsset']
      .forEach((field) => expect(serialized).not.toContain(`"${field}"`));
  });

  test('represents an unresolved organization membership without failing the registry', async () => {
    const orphaned = await makeUser({ label: 'Orphaned Membership' });
    await OrgMembership.create({
      user: orphaned._id,
      orgUnit: new mongoose.Types.ObjectId(),
      roleInUnit: 'member',
      businessRole: 'Collaborateur',
      status: 'active',
    });

    const res = await request(app).get('/api/users').query({ search: orphaned.email }).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].memberships).toEqual([
      expect.objectContaining({ tenant: null, organization: null, status: 'active', businessRole: 'Collaborateur' }),
    ]);
  });
});
