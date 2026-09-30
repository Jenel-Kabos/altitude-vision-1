const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const propertyRoutes = require('../routes/propertyRoutes');
const adminRoutes = require('../routes/adminRoutes');
const reportingRoutes = require('../routes/reportingRoutes');
const userRoutes = require('../routes/userRoutes');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const {
  grantOperator,
  suspendOperator,
  revokeOperator,
} = require('../services/platformOperator/platformOperatorService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/platform-tenants', platformTenantRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id || tenant) } : {}),
});

let sequence = 0;
const makeUser = ({ role = 'Client', label = 'user' } = {}) => {
  sequence += 1;
  return User.create({
    name: `Platform hardening ${label}`,
    email: `platform-hardening-${label}-${sequence}-${Date.now()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
    isEmailVerified: true,
  });
};

const propertyPayload = ({ title, owner, tenant = null, published = true }) => ({
  title,
  description: 'Description suffisamment longue pour le test de sécurité plateforme.',
  pole: 'Altimmo',
  type: 'Villa',
  status: 'vente',
  statusAdmin: published ? 'Validée' : 'En attente',
  isPublished: published,
  availability: 'Disponible',
  price: 100000,
  owner,
  tenant,
  address: { city: 'Brazzaville', arrondissement: 'Centre' },
  latitude: -4.26,
  longitude: 15.24,
  images: ['https://example.test/property.jpg'],
  surface: 80,
});

let tenantA;
let tenantB;
let tenantAdminA;
let tenantOwnerA;
let bootstrapB;
let individualOwner;
let propertyA;
let propertyB;
let propertyNull;
let propertiesReader;
let propertiesManager;
let reportingReader;
let unrelatedOperator;
let inactiveOperator;
let bareAdmin;
let usersReader;
let tenantsReader;

beforeAll(async () => {
  await startFinancialMongo();

  const fixtureA = await createTenantFixture({ label: 'Platform hardening A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'Platform hardening B', withAdminMembership: true });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  tenantAdminA = fixtureA.bootstrap;
  bootstrapB = fixtureB.bootstrap;
  tenantOwnerA = (await createTenantUser({
    tenant: tenantA,
    bootstrap: tenantAdminA,
    businessRole: 'Collaborateur',
    overrides: { role: 'Proprietaire' },
  })).user;
  individualOwner = await makeUser({ role: 'Proprietaire', label: 'individual-owner' });

  [propertyA, propertyB, propertyNull] = await Property.create([
    propertyPayload({ title: 'Platform Tenant A', owner: tenantOwnerA._id, tenant: tenantA._id }),
    propertyPayload({ title: 'Platform Tenant B Pending', owner: bootstrapB._id, tenant: tenantB._id, published: false }),
    propertyPayload({ title: 'Platform Individual Null', owner: individualOwner._id }),
  ]);

  propertiesReader = await makeUser({ role: 'Client', label: 'properties-reader' });
  propertiesManager = await makeUser({ role: 'Client', label: 'properties-manager' });
  reportingReader = await makeUser({ role: 'Client', label: 'reporting-reader' });
  unrelatedOperator = await makeUser({ role: 'Admin', label: 'unrelated' });
  inactiveOperator = await makeUser({ role: 'Admin', label: 'inactive' });
  bareAdmin = await makeUser({ role: 'Admin', label: 'bare-admin' });
  usersReader = await makeUser({ role: 'Client', label: 'users-reader' });
  tenantsReader = await makeUser({ role: 'Client', label: 'tenants-reader' });

  await grantOperator({ userId: propertiesReader._id, actor: tenantAdminA, reason: 'properties read test', capabilities: ['platform.properties.read'] });
  await grantOperator({ userId: propertiesManager._id, actor: tenantAdminA, reason: 'properties manage test', capabilities: ['platform.properties.manage'] });
  await grantOperator({ userId: reportingReader._id, actor: tenantAdminA, reason: 'reporting test', capabilities: ['platform.reporting.read'] });
  await grantOperator({ userId: unrelatedOperator._id, actor: tenantAdminA, reason: 'wrong capability test', capabilities: ['platform.users.read'] });
  await grantOperator({ userId: inactiveOperator._id, actor: tenantAdminA, reason: 'inactive operator test', capabilities: ['platform.properties.read', 'platform.reporting.read'] });
  await grantOperator({ userId: usersReader._id, actor: tenantAdminA, reason: 'users reader test', capabilities: ['platform.users.read'] });
  await grantOperator({ userId: tenantsReader._id, actor: tenantAdminA, reason: 'tenants reader test', capabilities: ['platform.tenants.read'] });
  await PlatformOperator.updateOne({ user: inactiveOperator._id }, { $set: { status: 'suspended' } });
});

afterAll(async () => stopFinancialMongo());

describe('PLATFORM-ADMIN-01 — exact global property capabilities', () => {
  test('active non-Admin operator + properties.read sees tenant A, tenant B pending, and tenant:null', async () => {
    const res = await request(app).get('/api/properties').set(bearer(propertiesReader));
    expect(res.status).toBe(200);
    const ids = res.body.data.properties.map((item) => String(item._id));
    expect(ids).toEqual(expect.arrayContaining([String(propertyA._id), String(propertyB._id), String(propertyNull._id)]));
  });

  test('operator with unrelated capability is denied the global catalogue', async () => {
    const res = await request(app).get('/api/properties').set(bearer(unrelatedOperator));
    expect(res.status).toBe(403);
  });

  test('inactive operator and bare Admin are denied the global catalogue', async () => {
    const inactive = await request(app).get('/api/properties').set(bearer(inactiveOperator));
    const adminOnly = await request(app).get('/api/properties').set(bearer(bareAdmin));
    expect(inactive.status).toBe(403);
    expect(adminOnly.status).toBe(403);
  });

  test('tenant Admin A remains tenant-scoped and cannot see tenant B or foreign tenant:null', async () => {
    const res = await request(app).get('/api/properties').set(bearer(tenantAdminA, tenantA));
    expect(res.status).toBe(200);
    const ids = res.body.data.properties.map((item) => String(item._id));
    expect(ids).toContain(String(propertyA._id));
    expect(ids).not.toContain(String(propertyB._id));
    expect(ids).not.toContain(String(propertyNull._id));
  });

  test('properties.manage permits a global mutation for a non-Admin operator', async () => {
    const res = await request(app).patch(`/api/admin/properties/${propertyB._id}/approve`).set(bearer(propertiesManager));
    expect(res.status).toBe(200);
  });

  test('properties.read and unrelated capabilities cannot mutate globally', async () => {
    const readOnly = await request(app).patch(`/api/admin/properties/${propertyA._id}/reject`).set(bearer(propertiesReader));
    const unrelated = await request(app).delete(`/api/admin/properties/${propertyNull._id}`).set(bearer(unrelatedOperator));
    expect(readOnly.status).toBe(403);
    expect(unrelated.status).toBe(403);
    expect(await Property.findById(propertyNull._id)).not.toBeNull();
  });
});

describe('PLATFORM-ADMIN-01 — reporting, stats, and activity capabilities', () => {
  test('active non-Admin operator + reporting.read receives global reporting', async () => {
    const res = await request(app).get('/api/reporting/executive').set(bearer(reportingReader));
    expect(res.status).toBe(200);
  });

  test('unrelated, inactive, and Admin-only identities are denied global reporting', async () => {
    const unrelated = await request(app).get('/api/reporting/executive').set(bearer(unrelatedOperator));
    const inactive = await request(app).get('/api/reporting/executive').set(bearer(inactiveOperator));
    const adminOnly = await request(app).get('/api/reporting/executive').set(bearer(bareAdmin));
    expect(unrelated.status).toBe(403);
    expect(inactive.status).toBe(403);
    expect(adminOnly.status).toBe(403);
  });

  test('reporting.read protects global admin stats and activity', async () => {
    const stats = await request(app).get('/api/admin/stats').set(bearer(reportingReader));
    const activity = await request(app).get('/api/admin/activity').set(bearer(reportingReader));
    const wrongStats = await request(app).get('/api/admin/stats').set(bearer(unrelatedOperator));
    const wrongActivity = await request(app).get('/api/admin/activity').set(bearer(unrelatedOperator));
    expect(stats.status).toBe(200);
    expect(activity.status).toBe(200);
    expect(wrongStats.status).toBe(403);
    expect(wrongActivity.status).toBe(403);
  });

  test('tenant Admin stats remain scoped to tenant A', async () => {
    const res = await request(app).get('/api/admin/stats').set(bearer(tenantAdminA, tenantA));
    expect(res.status).toBe(200);
    expect(res.body.data.totalProperties).toBe(1);
    expect(res.body.data.totalUsers).toBe(2);
  });
});

describe('PLATFORM-ADMIN-01 — canonical operator authority is independent of User.role', () => {
  test('non-Admin operator + users.read receives the global user registry', async () => {
    const res = await request(app).get('/api/users').set(bearer(usersReader));
    expect(res.status).toBe(200);
    expect(res.body.data.users.map((user) => String(user._id))).toContain(String(individualOwner._id));
  });

  test('an invalid explicit tenant selection never falls back to the global user registry', async () => {
    const invalidTenantId = '507f191e810c19729de860ea';
    const res = await request(app).get('/api/users').set(bearer(usersReader, invalidTenantId));
    expect(res.status).toBe(403);
  });

  test('non-Admin operator + tenants.read receives the global tenant registry', async () => {
    const res = await request(app).get('/api/platform-tenants').set(bearer(tenantsReader));
    expect(res.status).toBe(200);
    expect(res.body.data.tenants.map((tenant) => String(tenant._id)))
      .toEqual(expect.arrayContaining([String(tenantA._id), String(tenantB._id)]));
  });
});

describe('PLATFORM-ADMIN-01 — last viable PlatformOperator', () => {
  const resetViableOperators = () => PlatformOperator.updateMany(
    {},
    { $pull: { capabilities: 'platform.operators.manage' } },
  );

  test('last viable operator suspension and revocation are denied', async () => {
    await resetViableOperators();
    const actor = await makeUser({ role: 'Client', label: 'operator-actor' });
    const only = await makeUser({ role: 'Client', label: 'only-viable' });
    await grantOperator({ userId: only._id, actor, reason: 'only viable', capabilities: ['platform.operators.manage'] });

    await expect(suspendOperator({ userId: only._id, actor, reason: 'must fail' }))
      .rejects.toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
    await expect(revokeOperator({ userId: only._id, actor, reason: 'must fail' }))
      .rejects.toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
    await expect(PlatformOperator.findOne({ user: only._id }).lean())
      .resolves.toMatchObject({ status: 'active', capabilities: expect.arrayContaining(['platform.operators.manage']) });
  });

  test('removing platform.operators.manage from the last viable operator is denied', async () => {
    await resetViableOperators();
    const actor = await makeUser({ role: 'Client', label: 'capability-actor' });
    const only = await makeUser({ role: 'Client', label: 'last-capable' });
    await grantOperator({ userId: only._id, actor, reason: 'last capable', capabilities: ['platform.operators.manage', 'platform.users.read'] });

    await expect(grantOperator({ userId: only._id, actor, reason: 'remove manage', capabilities: ['platform.users.read'] }))
      .rejects.toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
  });

  test('a second viable operator permits suspension and revocation of the other', async () => {
    await resetViableOperators();
    const actor = await makeUser({ role: 'Client', label: 'two-actor' });
    const first = await makeUser({ role: 'Client', label: 'two-first' });
    const second = await makeUser({ role: 'Client', label: 'two-second' });
    await grantOperator({ userId: first._id, actor, reason: 'first viable', capabilities: ['platform.operators.manage'] });
    await grantOperator({ userId: second._id, actor, reason: 'second viable', capabilities: ['platform.operators.manage'] });

    await expect(suspendOperator({ userId: first._id, actor, reason: 'second remains' })).resolves.toMatchObject({ status: 'suspended' });
    await expect(revokeOperator({ userId: first._id, actor, reason: 'second remains' })).resolves.toMatchObject({ status: 'revoked' });
  });

  test('concurrent suspensions of two viable operators leave exactly one active and capable', async () => {
    await resetViableOperators();
    const actor = await makeUser({ role: 'Client', label: 'concurrent-actor' });
    const first = await makeUser({ role: 'Client', label: 'concurrent-first' });
    const second = await makeUser({ role: 'Client', label: 'concurrent-second' });
    await grantOperator({ userId: first._id, actor, reason: 'first concurrent', capabilities: ['platform.operators.manage'] });
    await grantOperator({ userId: second._id, actor, reason: 'second concurrent', capabilities: ['platform.operators.manage'] });

    const results = await Promise.allSettled([
      suspendOperator({ userId: first._id, actor, reason: 'concurrent first' }),
      suspendOperator({ userId: second._id, actor, reason: 'concurrent second' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
    expect(await PlatformOperator.countDocuments({ status: 'active', capabilities: 'platform.operators.manage' })).toBe(1);
  });
});

describe('PLATFORM-ADMIN-01 — User lifecycle cannot bypass platform viability', () => {
  const prepareLifecycleActors = async (label) => {
    await PlatformOperator.updateMany({}, { $pull: { capabilities: 'platform.operators.manage' } });
    const actor = await makeUser({ role: 'Admin', label: `${label}-actor` });
    const target = await makeUser({ role: 'Client', label: `${label}-target` });
    await grantOperator({ userId: actor._id, actor: tenantAdminA, reason: `${label} user manager`, capabilities: ['platform.users.read', 'platform.users.manage'] });
    await grantOperator({ userId: target._id, actor, reason: `${label} last viable`, capabilities: ['platform.operators.manage'] });
    return { actor, target };
  };

  test('legacy admin controller rejects administrative self-deletion', async () => {
    const { actor } = await prepareLifecycleActors('admin-self-delete');
    const res = await request(app).delete(`/api/admin/owners/${actor._id}`).set(bearer(actor));
    expect(res.status).toBe(403);
    expect(await User.findById(actor._id)).not.toBeNull();
  });

  test('admin suspension, ban, and hard-delete reject the last viable operator', async () => {
    const { actor, target } = await prepareLifecycleActors('admin-last-operator');
    const suspend = await request(app).patch(`/api/admin/owners/${target._id}/suspend`).set(bearer(actor));
    const ban = await request(app).patch(`/api/admin/owners/${target._id}/ban`).set(bearer(actor));
    const deletion = await request(app).delete(`/api/admin/owners/${target._id}`).set(bearer(actor));
    expect(suspend.status).toBe(409);
    expect(ban.status).toBe(409);
    expect(deletion.status).toBe(409);
    expect(await User.findById(target._id)).toMatchObject({ isActive: true });
  });

  test('canonical /api/users hard-delete rejects the last viable operator', async () => {
    const { actor, target } = await prepareLifecycleActors('users-last-operator');
    const res = await request(app).delete(`/api/users/${target._id}`).set(bearer(actor));
    expect(res.status).toBe(409);
    expect(await User.findById(target._id)).not.toBeNull();
  });

  test('self-service anonymization rejects the last viable operator', async () => {
    await PlatformOperator.updateMany({}, { $pull: { capabilities: 'platform.operators.manage' } });
    const target = await makeUser({ role: 'Client', label: 'self-last-operator' });
    await grantOperator({ userId: target._id, actor: tenantAdminA, reason: 'self last viable', capabilities: ['platform.operators.manage'] });
    const res = await request(app).delete('/api/users/me').set(bearer(target));
    expect(res.status).toBe(409);
    expect(await User.findById(target._id)).toMatchObject({ isActive: true });
  });

  test('suspending an operator when another viable operator exists also suspends its operator identity', async () => {
    await PlatformOperator.updateMany({}, { $pull: { capabilities: 'platform.operators.manage' } });
    const actor = await makeUser({ role: 'Admin', label: 'coherence-actor' });
    const target = await makeUser({ role: 'Client', label: 'coherence-target' });
    const survivor = await makeUser({ role: 'Client', label: 'coherence-survivor' });
    await grantOperator({ userId: actor._id, actor: tenantAdminA, reason: 'coherence user manager', capabilities: ['platform.users.manage'] });
    await grantOperator({ userId: target._id, actor, reason: 'coherence target', capabilities: ['platform.operators.manage'] });
    await grantOperator({ userId: survivor._id, actor, reason: 'coherence survivor', capabilities: ['platform.operators.manage'] });

    const res = await request(app).patch(`/api/admin/owners/${target._id}/suspend`).set(bearer(actor));
    expect(res.status).toBe(200);
    expect(await PlatformOperator.findOne({ user: target._id }).lean()).toMatchObject({ status: 'suspended' });
  });

  test('hard deletion of any PlatformOperator identity is refused pending a business retention decision', async () => {
    await PlatformOperator.updateMany({}, { $pull: { capabilities: 'platform.operators.manage' } });
    const actor = await makeUser({ role: 'Admin', label: 'operator-delete-actor' });
    const target = await makeUser({ role: 'Client', label: 'operator-delete-target' });
    const survivor = await makeUser({ role: 'Client', label: 'operator-delete-survivor' });
    await grantOperator({ userId: actor._id, actor: tenantAdminA, reason: 'delete user manager', capabilities: ['platform.users.read', 'platform.users.manage'] });
    await grantOperator({ userId: target._id, actor, reason: 'delete target', capabilities: ['platform.operators.manage'] });
    await grantOperator({ userId: survivor._id, actor, reason: 'delete survivor', capabilities: ['platform.operators.manage'] });

    const legacyDelete = await request(app).delete(`/api/admin/owners/${target._id}`).set(bearer(actor));
    const canonicalDelete = await request(app).delete(`/api/users/${target._id}`).set(bearer(actor));
    expect(legacyDelete.status).toBe(409);
    expect(canonicalDelete.status).toBe(409);
    expect(await User.findById(target._id)).not.toBeNull();
  });

  test('self-service deletion with a surviving viable operator revokes the deleted user operator identity', async () => {
    await PlatformOperator.updateMany({}, { $pull: { capabilities: 'platform.operators.manage' } });
    const actor = await makeUser({ role: 'Client', label: 'self-coherence-actor' });
    const target = await makeUser({ role: 'Client', label: 'self-coherence-target' });
    const survivor = await makeUser({ role: 'Client', label: 'self-coherence-survivor' });
    await grantOperator({ userId: target._id, actor, reason: 'self coherence target', capabilities: ['platform.operators.manage'] });
    await grantOperator({ userId: survivor._id, actor, reason: 'self coherence survivor', capabilities: ['platform.operators.manage'] });

    const res = await request(app).delete('/api/users/me').set(bearer(target));
    expect(res.status).toBe(200);
    expect(await PlatformOperator.findOne({ user: target._id }).lean()).toMatchObject({ status: 'revoked' });
  });

  test('generic administrative updates cannot disable the last viable operator', async () => {
    const { actor, target } = await prepareLifecycleActors('generic-disable');
    const legacy = await request(app).patch(`/api/admin/owners/${target._id}`).set(bearer(actor)).send({ isActive: false });
    const canonical = await request(app).put(`/api/users/${target._id}`).set(bearer(actor)).send({ status: 'Suspendu' });
    expect(legacy.status).toBe(409);
    expect(canonical.status).toBe(409);
    expect(await User.findById(target._id)).toMatchObject({ isActive: true });
  });
});
