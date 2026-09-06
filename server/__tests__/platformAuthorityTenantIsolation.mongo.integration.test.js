const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const PlatformOperator = require('../models/PlatformOperator');
const userRoutes = require('../routes/userRoutes');
const adminRoutes = require('../routes/adminRoutes');
const conversationRoutes = require('../routes/conversationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversations', conversationRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let tenantA; let tenantB; let legacyAdmin; let ownerA; let platformOperator;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'RBAC reset A' });
  const fixtureB = await createTenantFixture({ label: 'RBAC reset B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  legacyAdmin = fixtureA.bootstrap;
  ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: legacyAdmin, overrides: { role: 'Proprietaire' } })).user;
  platformOperator = await User.create({
    name: 'Platform authority operator',
    email: `platform-authority-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  await grantOperator({
    userId: platformOperator._id,
    actor: legacyAdmin,
    reason: 'RBAC tenant reset integration test',
    capabilities: ['platform.users.read', 'platform.users.manage', 'platform.support.read'],
  });
  await Conversation.create({ isStaffInbox: true, tenant: tenantA._id, participants: [ownerA._id], lastMessage: 'Support A' });
  await Conversation.create({ isStaffInbox: true, tenant: tenantB._id, participants: [legacyAdmin._id], lastMessage: 'Support B' });
});

afterAll(async () => stopFinancialMongo());

describe('RBAC-TENANT-RESET-2 — platform users authority', () => {
  test('PlatformOperator + users.read voit la liste globale sans tenant', async () => {
    const res = await request(app).get('/api/users').set(bearer(platformOperator));
    expect(res.status).toBe(200);
    expect(res.body.data.users.map((u) => String(u._id))).toEqual(expect.arrayContaining([String(ownerA._id), String(legacyAdmin._id)]));
  });

  test('PlatformOperator sélectionné reste borné au tenant sélectionné', async () => {
    const res = await request(app).get('/api/users').set(bearer(platformOperator, tenantA._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).toContain(String(ownerA._id));
    expect(ids).not.toContain(String(platformOperator._id));
  });

  test('Admin historique sans PlatformOperator ne reçoit pas owners global', async () => {
    const res = await request(app).get('/api/admin/owners').set(bearer(legacyAdmin));
    expect(res.status).toBe(403);
  });

  test('Tenant Owner ne reçoit pas users global ni owners global', async () => {
    const users = await request(app).get('/api/users').set(bearer(ownerA));
    const owners = await request(app).get('/api/admin/owners').set(bearer(ownerA));
    expect(users.status).toBe(403);
    expect(owners.status).toBe(403);
  });

  test('PlatformOperator sans users.manage ne peut pas muter', async () => {
    const readOnly = await User.create({
      name: 'Read only operator', email: `readonly-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: readOnly._id, actor: legacyAdmin, reason: 'read only', capabilities: ['platform.users.read'] });
    const res = await request(app).patch(`/api/users/${ownerA._id}/suspend`).set(bearer(readOnly));
    expect(res.status).toBe(403);
  });

  test('PlatformOperator sans users.read est refusé', async () => {
    const limited = await User.create({
      name: 'No users read operator', email: `noread-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: limited._id, actor: legacyAdmin, reason: 'no users read', capabilities: ['platform.users.manage'] });
    const res = await request(app).get('/api/users').set(bearer(limited));
    expect(res.status).toBe(403);
  });

  test('PlatformOperator suspendu est refusé', async () => {
    const suspended = await User.create({
      name: 'Suspended operator', email: `suspended-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: suspended._id, actor: legacyAdmin, reason: 'suspended', capabilities: ['platform.users.read'] });
    await PlatformOperator.updateOne({ user: suspended._id }, { $set: { status: 'suspended' } });
    const res = await request(app).get('/api/users').set(bearer(suspended));
    expect(res.status).toBe(403);
  });
});

describe('RBAC-TENANT-RESET-2 — global support conversations', () => {
  test('PlatformOperator avec support.read voit la boîte globale sans tenant', async () => {
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(platformOperator));
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);
  });

  test('PlatformOperator sans capacité support reste refusé en vue globale', async () => {
    const limited = await User.create({
      name: 'Limited support operator', email: `limited-support-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: limited._id, actor: legacyAdmin, reason: 'limited', capabilities: ['platform.users.read'] });
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(limited));
    expect(res.status).toBe(403);
  });

  test('Impersonation seule ne vaut pas accès lecture support global', async () => {
    const impersonator = await User.create({
      name: 'Impersonation only operator', email: `impersonation-only-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    await grantOperator({ userId: impersonator._id, actor: legacyAdmin, reason: 'impersonation only', capabilities: ['platform.support.impersonation'] });
    const res = await request(app).get('/api/conversations/staff-inbox').set(bearer(impersonator));
    expect(res.status).toBe(403);
  });
});
