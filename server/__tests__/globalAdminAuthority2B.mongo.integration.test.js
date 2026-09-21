const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');
const { errorHandler } = require('../middleware/errorMiddleware');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const platformTenantRoutes = require('../routes/platformTenantRoutes');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.all(
  '/sensitive',
  protect,
  requirePlatformOperatorCapability('platform.operators.manage'),
  (req, res) => res.json({ status: 'success', actor: String(req.user._id) }),
);
app.use('/api/platform-tenants', platformTenantRoutes);
app.use(errorHandler);

const bearer = (user, extra = {}) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...extra,
});

const makeUser = (label, role) => User.create({
  name: label,
  email: `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.test`,
  password: 'Password123!',
  passwordConfirm: 'Password123!',
  role,
  isEmailVerified: true,
});

const grant = (user, grantedBy, capabilities, status = 'active') => PlatformOperator.create({
  user: user._id,
  status,
  capabilities,
  grantedBy: grantedBy._id,
  grantReason: 'GLOBAL-2B test fixture',
  ...(status === 'suspended' && {
    suspendedBy: grantedBy._id,
    suspendedAt: new Date(),
    suspensionReason: 'GLOBAL-2B test',
  }),
  ...(status === 'revoked' && {
    revokedBy: grantedBy._id,
    revokedAt: new Date(),
    revokeReason: 'GLOBAL-2B test',
  }),
});

let admin;
let client;
let proprietor;
let proprietorTenantAdmin;
let nonAdminOperator;
let wrongCapabilityAdmin;
let suspendedAdmin;
let revokedAdmin;
let plainAdmin;
let tenant;
let secondTenant;
let consoleErrorSpy;

beforeAll(async () => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await startFinancialMongo();
  admin = await makeUser('Global Admin', 'Admin');
  client = await makeUser('Global Client', 'Client');
  proprietor = await makeUser('Global Proprietor', 'Proprietaire');
  nonAdminOperator = await makeUser('Non Admin Operator', 'Proprietaire');
  wrongCapabilityAdmin = await makeUser('Wrong Capability Admin', 'Admin');
  suspendedAdmin = await makeUser('Suspended Operator Admin', 'Admin');
  revokedAdmin = await makeUser('Revoked Operator Admin', 'Admin');
  plainAdmin = await makeUser('Plain Admin', 'Admin');

  const fixture = await createTenantFixture({ label: 'GLOBAL 2B tenant' });
  tenant = fixture.tenant;
  proprietorTenantAdmin = (await createTenantUser({
    tenant,
    bootstrap: fixture.bootstrap,
    overrides: { role: 'Proprietaire' },
  })).user;
  await OrgMembership.updateOne(
    { user: proprietorTenantAdmin._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole: 'Admin' } },
  );
  const secondFixture = await createTenantFixture({ label: 'GLOBAL 2B second tenant' });
  secondTenant = secondFixture.tenant;
  await require('../services/organizationService').grantMembership({
    userId: proprietorTenantAdmin._id,
    orgUnitId: secondTenant.rootOrgUnit,
    businessRole: 'Collaborateur',
    actor: secondFixture.bootstrap,
  });

  await grant(admin, admin, ['platform.operators.manage', 'platform.tenant_applications.read']);
  await grant(nonAdminOperator, admin, ['platform.operators.manage', 'platform.tenant_applications.read']);
  await grant(wrongCapabilityAdmin, admin, ['platform.tenants.read']);
  await grant(suspendedAdmin, admin, ['platform.operators.manage', 'platform.tenant_applications.read'], 'suspended');
  await grant(revokedAdmin, admin, ['platform.operators.manage', 'platform.tenant_applications.read'], 'revoked');
});

describe('USER-TENANT-MEMBERSHIP-ARCHITECTURE-2B.2-E — accessible tenant discovery', () => {
  test('SWITCH-01/04: Proprietaire reçoit uniquement ses tenants avec le businessRole propre à chacun', async () => {
    const res = await request(app).get('/api/platform-tenants/accessible').set(bearer(proprietorTenantAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.tenants).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: String(tenant._id), businessRole: 'Admin' }),
      expect.objectContaining({ _id: String(secondTenant._id), businessRole: 'Collaborateur' }),
    ]));
  });

  test.each([
    ['global Admin without membership', () => plainAdmin],
    ['Client without membership', () => client],
  ])('SWITCH-06/07: %s reçoit une liste vide', async (_label, getUser) => {
    const res = await request(app).get('/api/platform-tenants/accessible').set(bearer(getUser()));
    expect(res.status).toBe(200);
    expect(res.body.data.tenants).toEqual([]);
  });
});

afterAll(async () => {
  await stopFinancialMongo();
  consoleErrorSpy.mockRestore();
});

describe('USER-TENANT-MEMBERSHIP-ARCHITECTURE-2B.2-A — global sensitive authority', () => {
  test('GLOBAL-01: unauthenticated request is denied with 401', async () => {
    const res = await request(app).get('/sensitive');
    expect(res.status).toBe(401);
  });

  test('GLOBAL-02: Client is denied', async () => {
    const res = await request(app).get('/sensitive').set(bearer(client));
    expect(res.status).toBe(403);
  });

  test('GLOBAL-03: Proprietaire is denied', async () => {
    const res = await request(app).get('/sensitive').set(bearer(proprietor));
    expect(res.status).toBe(403);
  });

  test('GLOBAL-04: Admin without PlatformOperator is denied', async () => {
    const res = await request(app).get('/sensitive').set(bearer(plainAdmin));
    expect(res.status).toBe(403);
  });

  test('GLOBAL-05: non-Admin PlatformOperator with the exact capability is denied', async () => {
    const res = await request(app).get('/sensitive').set(bearer(nonAdminOperator));
    expect(res.status).toBe(403);
  });

  test('GLOBAL-06: Admin with active PlatformOperator and exact capability is allowed without membership', async () => {
    expect(await OrgMembership.countDocuments({ user: admin._id })).toBe(0);
    const res = await request(app).get('/sensitive').set(bearer(admin));
    expect(res.status).toBe(200);
  });

  test('GLOBAL-07: Admin with the wrong capability is denied', async () => {
    const res = await request(app).get('/sensitive').set(bearer(wrongCapabilityAdmin));
    expect(res.status).toBe(403);
  });

  test.each([
    ['suspended', () => suspendedAdmin],
    ['revoked', () => revokedAdmin],
  ])('GLOBAL-08: %s PlatformOperator is denied', async (_status, getUser) => {
    const res = await request(app).get('/sensitive').set(bearer(getUser()));
    expect(res.status).toBe(403);
  });

  test('tenant Admin membership cannot grant platform authority', async () => {
    const res = await request(app)
      .get('/sensitive')
      .set(bearer(proprietorTenantAdmin, { 'X-Platform-Tenant-Id': String(tenant._id) }));
    expect(res.status).toBe(403);
  });

  test('tenant Admin plus PlatformOperator capability remains denied when global role is not Admin', async () => {
    await grant(proprietorTenantAdmin, admin, ['platform.operators.manage']);
    const res = await request(app)
      .get('/sensitive')
      .set(bearer(proprietorTenantAdmin, { 'X-Platform-Tenant-Id': String(tenant._id) }));
    expect(res.status).toBe(403);
  });

  test.each([
    ['absent', {}],
    ['valid tenant', { 'X-Platform-Tenant-Id': () => String(tenant._id) }],
    ['forged tenant', { 'X-Platform-Tenant-Id': '507f1f77bcf86cd799439011' }],
    ['custom role header', { 'X-User-Role': 'Admin' }],
  ])('tenant/header input is irrelevant for valid global authority: %s', async (_label, rawHeaders) => {
    const headers = Object.fromEntries(Object.entries(rawHeaders).map(([key, value]) => [key, typeof value === 'function' ? value() : value]));
    const res = await request(app).get('/sensitive').set(bearer(admin, headers));
    expect(res.status).toBe(200);
  });

  test('body and query fields cannot elevate a Client', async () => {
    const res = await request(app)
      .post('/sensitive?role=Admin&capability=platform.operators.manage')
      .set(bearer(client, { 'X-User-Role': 'Admin', 'X-Platform-Capability': 'platform.operators.manage' }))
      .send({ role: 'Admin', businessRole: 'Admin', tenantId: String(tenant._id), capabilities: ['platform.operators.manage'] });
    expect(res.status).toBe(403);
  });

  test('capability from body, query, JWT-adjacent headers cannot replace the canonical operator capability', async () => {
    const res = await request(app)
      .post('/sensitive?capability=platform.operators.manage')
      .set(bearer(wrongCapabilityAdmin, {
        'X-Platform-Capability': 'platform.operators.manage',
        'X-Platform-Tenant-Id': String(tenant._id),
      }))
      .send({ capability: 'platform.operators.manage', capabilities: ['platform.operators.manage'] });
    expect(res.status).toBe(403);
  });
});

describe('USER-TENANT-MEMBERSHIP-ARCHITECTURE-2B.2-B — certain global tenant-application routes', () => {
  const endpoint = '/api/platform-tenants/applications';

  test('GR-01: unauthenticated request is denied with 401', async () => {
    expect((await request(app).get(endpoint)).status).toBe(401);
  });

  test('GR-02: Client is denied', async () => {
    expect((await request(app).get(endpoint).set(bearer(client))).status).toBe(403);
  });

  test('GR-03: Proprietaire is denied', async () => {
    expect((await request(app).get(endpoint).set(bearer(proprietor))).status).toBe(403);
  });

  test('GR-04: tenant Admin is denied on the global route', async () => {
    const res = await request(app)
      .get(endpoint)
      .set(bearer(proprietorTenantAdmin, { 'X-Platform-Tenant-Id': String(tenant._id) }));
    expect(res.status).toBe(403);
  });

  test('GR-05: global Admin without PlatformOperator is denied', async () => {
    expect((await request(app).get(endpoint).set(bearer(plainAdmin))).status).toBe(403);
  });

  test('GR-06: global Admin with active operator and exact capability is allowed without membership', async () => {
    expect(await OrgMembership.countDocuments({ user: admin._id })).toBe(0);
    expect((await request(app).get(endpoint).set(bearer(admin))).status).toBe(200);
  });

  test('GR-07: global Admin with wrong capability is denied', async () => {
    expect((await request(app).get(endpoint).set(bearer(wrongCapabilityAdmin))).status).toBe(403);
  });

  test.each([
    ['suspended', () => suspendedAdmin],
    ['revoked', () => revokedAdmin],
  ])('GR-08: %s PlatformOperator is denied', async (_status, getUser) => {
    expect((await request(app).get(endpoint).set(bearer(getUser()))).status).toBe(403);
  });

  test('GR-09 / GLOBAL-05: non-Admin operator with exact capability is denied', async () => {
    expect((await request(app).get(endpoint).set(bearer(nonAdminOperator))).status).toBe(403);
  });

  test('GR-10: forged tenant/header/body/query authority cannot elevate a Client', async () => {
    const res = await request(app)
      .get(`${endpoint}?role=Admin&businessRole=Admin&tenantId=${tenant._id}`)
      .set(bearer(client, {
        'X-Platform-Tenant-Id': String(tenant._id),
        'X-User-Role': 'Admin',
        'X-Platform-Capability': 'platform.tenant_applications.read',
      }))
      .send({ role: 'Admin', businessRole: 'Admin', tenantId: String(tenant._id) });
    expect(res.status).toBe(403);
  });
});
