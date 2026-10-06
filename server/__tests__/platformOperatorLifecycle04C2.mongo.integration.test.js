// PLATFORM-ADMIN-04C2 — C2.0 + C2.0b : PlatformOperator lifecycle & authority
// separation (spec §8, décisions D0, D13, D14, D15).
//
//   PLATFORM authority        = PlatformOperator active + capability exacte
//   TENANT business authority = tenant résolu + OrgMembership active + businessRole
//   createdBy                 = provenance technique, jamais une autorité
//
// Couverture déjà existante, réutilisée et non dupliquée ici :
//   - platformAdmin1.adversarial : auto-octroi, auto-suspension/révocation via
//     /api/platform-operators, opérateur suspendu/révoqué refusé ;
//   - platformAdminAuthorityHardening : dernier opérateur viable (suspend,
//     revoke, retrait de capability, ban/suspend/hard-delete de compte),
//     concurrence de deux suspensions.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const operatorService = require('../services/platformOperator/platformOperatorService');
const { resolveEffectiveTenantContext } = require('../services/platformTenant/tenantContextService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/platform-operators', require('../routes/platformOperatorRoutes'));
app.use('/api/platform-tenants', require('../routes/platformTenantRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));
app.use('/api/users', require('../routes/userRoutes'));
app.use('/api/dashboard', require('../routes/dashboardRoutes'));
app.use('/api/hotels', require('../routes/hotelRoutes'));
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const FULL = [...PLATFORM_VIEW_REQUIRED_CAPABILITIES];
let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({
    name: `C20 ${label} ${seq}`,
    email: `c20-${label}-${seq}-${Date.now()}@example.test`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    role,
    isEmailVerified: true,
  });
};
const grant = (user, actor, capabilities, reason = 'C2.0b fixture') => operatorService.grantOperator({ userId: user._id, actor, reason, capabilities });
const operatorOf = (user) => PlatformOperator.findOne({ user: user._id }).lean();
const freshUser = (user) => User.findById(user._id).lean();
const sortedCaps = (operator) => [...(operator?.capabilities || [])].sort();

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.root = await createTenantFixture({ label: 'C20 root', withAdminMembership: true });
  S.alpha = await makeUser('Admin', 'alpha');
  await grant(S.alpha, S.root.bootstrap, FULL);
  S.beta = await makeUser('Admin', 'beta');
  await grant(S.beta, S.alpha, FULL);
  S.tenantT = await createTenantFixture({ label: 'C20 Tenant T', withAdminMembership: true });
});
afterAll(stopFinancialMongo);

// ── C2.0 — F2 : createdBy ne restaure jamais une autorité ───────────────────
describe('C2.0 — F2 : ex-opérateur + createdBy + aucune membership', () => {
  const exOperatorCreator = async (mode) => {
    const op = await makeUser('Admin', `ex-${mode}`);
    await grant(op, S.alpha, FULL);
    const customerTenant = await platformTenantService.createTenant({ name: `C20 customer ${mode} ${Date.now()}`, actor: op });
    const hotel = await Hotel.create({
      name: `C20 customer hotel ${mode} ${Date.now()}`,
      tenant: customerTenant._id,
      manager: S.tenantT.bootstrap._id,
      createdBy: S.tenantT.bootstrap._id,
      publicationStatus: 'publie',
      active: true,
    });
    if (mode === 'suspended') await operatorService.suspendOperator({ userId: op._id, actor: S.alpha, reason: 'C2.0 F2' });
    else await operatorService.revokeOperator({ userId: op._id, actor: S.alpha, reason: 'C2.0 F2' });
    return { op, customerTenant, hotel };
  };

  test.each(['suspended', 'revoked'])('%s ex-operator never resolves legacy_fallback on the tenant it technically created', async (mode) => {
    const { op, customerTenant } = await exOperatorCreator(mode);
    expect(String(customerTenant.createdBy)).toBe(String(op._id));
    expect(await OrgMembership.countDocuments({ user: op._id })).toBe(0);
    const context = await resolveEffectiveTenantContext(op._id);
    expect(context).toBeNull();
  });

  test.each(['suspended', 'revoked'])('%s ex-operator gets no tenant hotel authority (read or mutate)', async (mode) => {
    const { op, hotel } = await exOperatorCreator(mode);
    const read = await request(app).get(`/api/hotels/${hotel._id}`).set(bearer(op));
    const mutate = await request(app).patch(`/api/hotels/${hotel._id}/deactivate`).set(bearer(op));
    expect(read.status).toBe(403);
    expect(mutate.status).toBe(403);
    expect((await Hotel.findById(hotel._id).lean()).active).toBe(true);
  });

  test('genuine legacy founder (never an operator) keeps legacy_fallback until attested migration (D3/D15)', async () => {
    const founder = await createTenantFixture({ label: 'C20 genuine founder' });
    expect(await OrgMembership.countDocuments({ user: founder.bootstrap._id })).toBe(0);
    const context = await resolveEffectiveTenantContext(founder.bootstrap._id);
    expect(context?.source).toBe('legacy_fallback');
    expect(String(context.tenant._id)).toBe(String(founder.tenant._id));
  });

  test('J — an operator creating a tenant for a customer is only its technical creator', async () => {
    const res = await request(app).post('/api/platform-tenants').set(bearer(S.alpha)).send({ name: `C20 J customer ${Date.now()}` });
    expect(res.status).toBe(201);
    const tenant = res.body.data.tenant;
    expect(String(tenant.createdBy)).toBe(String(S.alpha._id));
    expect(await OrgMembership.countDocuments({ user: S.alpha._id })).toBe(0);
  });
});

// ── C2.0b — F8 / D14 : une administration de compte n'atteint jamais l'autorité PLATFORM ──
describe('C2.0b — F8 / D14 : opérations de compte visant un PlatformOperator actif', () => {
  const operatorMemberOfT = async (label) => {
    const victim = await makeUser('Collaborateur', label);
    await grant(victim, S.alpha, FULL);
    await addTenantMember({ tenant: S.tenantT.tenant, user: victim, bootstrap: S.tenantT.bootstrap, businessRole: 'Collaborateur' });
    return victim;
  };
  const snapshot = async (victim) => ({
    user: await freshUser(victim),
    operator: await operatorOf(victim),
    memberships: await OrgMembership.find({ user: victim._id }).select('status businessRole roleInUnit').lean(),
  });
  const expectUnchanged = async (victim, before) => {
    const after = await snapshot(victim);
    expect(after.user.isActive).toBe(before.user.isActive);
    expect(after.user.status).toBe(before.user.status);
    expect(after.user.tokenVersion || 0).toBe(before.user.tokenVersion || 0);
    expect(after.operator.status).toBe('active');
    expect(sortedCaps(after.operator)).toEqual(sortedCaps(before.operator));
    expect(after.memberships).toEqual(before.memberships);
  };

  test('F8 — partial operator (platform.users.manage) with Tenant T selected cannot cascade-suspend a full operator member of T', async () => {
    const partial = await makeUser('Admin', 'partial-users');
    await grant(partial, S.alpha, ['platform.users.read', 'platform.users.manage']);
    const victim = await operatorMemberOfT('f8-victim');
    const before = await snapshot(victim);
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`).set(bearer(partial, S.tenantT.tenant)).send({});
    expect(res.status).toBe(403);
    await expectUnchanged(victim, before);
  });

  test('F8 — without tenant selection and without platform.operators.manage, every account route refuses', async () => {
    const partial = await makeUser('Admin', 'partial-users-platform');
    await grant(partial, S.alpha, ['platform.users.read', 'platform.users.manage']);
    const victim = await operatorMemberOfT('f8-victim-platform');
    const before = await snapshot(victim);
    const responses = await Promise.all([
      request(app).patch(`/api/users/${victim._id}/suspend`).set(bearer(partial)).send({}),
      request(app).patch(`/api/admin/owners/${victim._id}/suspend`).set(bearer(partial)).send({}),
      request(app).patch(`/api/admin/owners/${victim._id}/ban`).set(bearer(partial)).send({}),
    ]);
    responses.forEach((res) => expect(res.status).toBe(403));
    await expectUnchanged(victim, before);
  });

  test('D14 — platform.operators.manage through a selected tenant cannot cascade-suspend an operator', async () => {
    const victim = await operatorMemberOfT('d14-tenant-victim');
    const before = await snapshot(victim);
    const res = await request(app).patch(`/api/users/${victim._id}/suspend`).set(bearer(S.alpha, S.tenantT.tenant)).send({});
    expect(res.status).toBe(403);
    await expectUnchanged(victim, before);
  });

  test('D14 — platform.operators.manage through a selected tenant cannot use the operator governance routes', async () => {
    const victim = await operatorMemberOfT('d14-governance-victim');
    const before = await snapshot(victim);
    const responses = [
      await request(app).patch(`/api/platform-operators/${victim._id}/suspend`).set(bearer(S.alpha, S.tenantT.tenant)).send({ reason: 'tenant view' }),
      await request(app).patch(`/api/platform-operators/${victim._id}/revoke`).set(bearer(S.alpha, S.tenantT.tenant)).send({ reason: 'tenant view' }),
      await request(app).post('/api/platform-operators').set(bearer(S.alpha, S.tenantT.tenant)).send({ userId: String(victim._id), capabilities: ['platform.support.read'], reason: 'tenant view' }),
    ];
    responses.forEach((res) => expect(res.status).toBe(403));
    await expectUnchanged(victim, before);
  });

  test('D14 — eligible operator with platform.operators.manage in PLATFORM may suspend an operator account; capabilities preserved; audited', async () => {
    const victim = await operatorMemberOfT('d14-platform-victim');
    const capsBefore = sortedCaps(await operatorOf(victim));
    const res = await request(app).patch(`/api/admin/owners/${victim._id}/suspend`).set(bearer(S.alpha)).send({});
    expect(res.status).toBe(200);
    const operator = await operatorOf(victim);
    expect(operator.status).toBe('suspended');
    expect(sortedCaps(operator)).toEqual(capsBefore);
    expect(await OrgMembership.countDocuments({ user: victim._id, status: 'active' })).toBe(1);
    const log = await ActionLog.findOne({ action: 'platform_operator.suspended', 'cible.id': String(victim._id) }).lean();
    expect(log).toBeTruthy();
    expect(String(log.auteur.id)).toBe(String(S.alpha._id));
    expect(log.scopeMode).toBe('platform');
    expect(log.metadata.reason).toBe('user_account_suspended');
    expect(log.date).toBeInstanceOf(Date);
  });

  test('ordinary account suspension of a non-operator user is unchanged (no operator governance required)', async () => {
    const usersManager = await makeUser('Admin', 'users-manager-eligible');
    await grant(usersManager, S.alpha, FULL);
    const target = await makeUser('Proprietaire', 'plain-target');
    const res = await request(app).patch(`/api/admin/owners/${target._id}/suspend`).set(bearer(usersManager)).send({});
    expect(res.status).toBe(200);
    expect((await freshUser(target)).status).toBe('Suspendu');
  });
});

// ── C2.0b — F9 : aucune auto-action de compte ───────────────────────────────
describe('C2.0b — F9 : un opérateur ne peut pas se bannir/suspendre lui-même', () => {
  test.each(['ban', 'suspend'])('self %s through /api/admin/owners is refused even with other viable operators', async (action) => {
    const self = await makeUser('Admin', `self-${action}`);
    await grant(self, S.alpha, FULL);
    const userBefore = await freshUser(self);
    const capsBefore = sortedCaps(await operatorOf(self));
    const res = await request(app).patch(`/api/admin/owners/${self._id}/${action}`).set(bearer(self)).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SELF_ACTION_FORBIDDEN');
    const userAfter = await freshUser(self);
    expect(userAfter.isActive).toBe(userBefore.isActive);
    expect(userAfter.status).toBe(userBefore.status);
    const operator = await operatorOf(self);
    expect(operator.status).toBe('active');
    expect(sortedCaps(operator)).toEqual(capsBefore);
  });
});

// ── C2.0b — F10 + D13 : cycle de vie et réactivation ────────────────────────
describe('C2.0b — F10 / D13 : suspension, réactivation, révocation', () => {
  test('F10 — reactivateOperator service refuses actor === target', async () => {
    const op = await makeUser('Admin', 'f10');
    await grant(op, S.alpha, FULL);
    await operatorService.suspendOperator({ userId: op._id, actor: S.alpha, reason: 'F10' });
    await expect(operatorService.reactivateOperator({ userId: op._id, actor: op, reason: 'self' }))
      .rejects.toMatchObject({ code: 'PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN', statusCode: 403 });
    expect((await operatorOf(op)).status).toBe('suspended');
  });

  test('C — a suspended operator cannot reactivate itself over HTTP', async () => {
    const op = await makeUser('Admin', 'self-reactivate-http');
    await grant(op, S.alpha, FULL);
    await operatorService.suspendOperator({ userId: op._id, actor: S.alpha, reason: 'C' });
    const res = await request(app).patch(`/api/platform-operators/${op._id}/reactivate`).set(bearer(op)).send({ reason: 'self' });
    expect(res.status).toBe(403);
    expect((await operatorOf(op)).status).toBe('suspended');
  });

  test('A/G — active → suspended removes PLATFORM at once; authorized reactivation restores the exact previous capabilities (D13)', async () => {
    const op = await makeUser('Admin', 'lifecycle');
    const caps = [...FULL];
    await grant(op, S.alpha, caps);
    expect((await request(app).get('/api/platform-tenants').set(bearer(op))).status).toBe(200);

    expect((await request(app).patch(`/api/platform-operators/${op._id}/suspend`).set(bearer(S.alpha)).send({ reason: 'leave' })).status).toBe(200);
    expect((await request(app).get('/api/platform-tenants').set(bearer(op))).status).toBe(403);
    expect(sortedCaps(await operatorOf(op))).toEqual([...caps].sort());

    const back = await request(app).patch(`/api/platform-operators/${op._id}/reactivate`).set(bearer(S.alpha)).send({ reason: 'back' });
    expect(back.status).toBe(200);
    const operator = await operatorOf(op);
    expect(operator.status).toBe('active');
    expect(sortedCaps(operator)).toEqual([...caps].sort());
    expect((await request(app).get('/api/platform-tenants').set(bearer(op))).status).toBe(200);

    const logs = await ActionLog.find({ 'cible.id': String(op._id), action: { $in: ['platform_operator.suspended', 'platform_operator.reactivated'] } }).lean();
    expect(logs.map((log) => log.action).sort()).toEqual(['platform_operator.reactivated', 'platform_operator.suspended']);
    logs.forEach((log) => {
      expect(String(log.auteur.id)).toBe(String(S.alpha._id));
      expect(['leave', 'back']).toContain(log.metadata.reason);
    });
  });

  test('reactivating an already active operator is an idempotent no-op (no mutation, no audit entry)', async () => {
    const op = await makeUser('Admin', 'idempotent');
    await grant(op, S.alpha, FULL);
    const before = await operatorOf(op);
    const res = await request(app).patch(`/api/platform-operators/${op._id}/reactivate`).set(bearer(S.alpha)).send({ reason: 'noop' });
    expect(res.status).toBe(200);
    const after = await operatorOf(op);
    expect(after.status).toBe('active');
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(await ActionLog.countDocuments({ 'cible.id': String(op._id), action: 'platform_operator.reactivated' })).toBe(0);
  });

  test('revoked — simple reactivation refused; explicit grant required and applies only the granted capabilities', async () => {
    const op = await makeUser('Admin', 'revoked');
    await grant(op, S.alpha, FULL);
    await operatorService.revokeOperator({ userId: op._id, actor: S.alpha, reason: 'gone' });
    const res = await request(app).patch(`/api/platform-operators/${op._id}/reactivate`).set(bearer(S.alpha)).send({ reason: 'try' });
    expect(res.status).toBe(409);
    expect(res.body.code || res.body.message).toBeTruthy();
    expect((await operatorOf(op)).status).toBe('revoked');
    const regrant = await request(app).post('/api/platform-operators').set(bearer(S.alpha)).send({ userId: String(op._id), capabilities: ['platform.support.read'], reason: 'new decision' });
    expect(regrant.status).toBe(201);
    const operator = await operatorOf(op);
    expect(operator.status).toBe('active');
    expect(operator.capabilities).toEqual(['platform.support.read']);
  });

  test('H — tenant Admin, partial operator and non-eligible operators.manage holder cannot reactivate', async () => {
    const op = await makeUser('Admin', 'h-target');
    await grant(op, S.alpha, FULL);
    await operatorService.suspendOperator({ userId: op._id, actor: S.alpha, reason: 'H' });
    const partial = await makeUser('Admin', 'h-partial');
    await grant(partial, S.alpha, ['platform.support.read']);
    const opsOnly = await makeUser('Admin', 'h-ops-only');
    await grant(opsOnly, S.alpha, ['platform.operators.manage']);
    for (const actor of [S.tenantT.bootstrap, partial, opsOnly]) {
      const res = await request(app).patch(`/api/platform-operators/${op._id}/reactivate`).set(bearer(actor)).send({ reason: 'H' });
      expect(res.status).toBe(403);
    }
    expect((await operatorOf(op)).status).toBe('suspended');
  });
});

// ── Séparation OrgMembership / PlatformOperator ─────────────────────────────
describe('C2.0b — OrgMembership et PlatformOperator restent indépendants', () => {
  test('E — suspended operator keeps its genuine tenant membership authority (PLATFORM denied)', async () => {
    const dual = await makeUser('Proprietaire', 'dual');
    await grant(dual, S.alpha, FULL);
    await addTenantMember({ tenant: S.tenantT.tenant, user: dual, bootstrap: S.tenantT.bootstrap, businessRole: 'Admin' });
    await operatorService.suspendOperator({ userId: dual._id, actor: S.alpha, reason: 'E' });
    expect((await request(app).get('/api/platform-tenants').set(bearer(dual))).status).toBe(403);
    expect((await request(app).get('/api/users').set(bearer(dual))).status).toBe(200);
    expect((await request(app).get('/api/dashboard/stats').set(bearer(dual))).status).toBe(200);
    expect(await OrgMembership.countDocuments({ user: dual._id, status: 'active', businessRole: 'Admin' })).toBe(1);
  });

  test('E/Hotel (C2.2) — suspended operator with tenant Admin membership reads its tenant hotel', async () => {
    const dual = await makeUser('Proprietaire', 'dual-hotel');
    await grant(dual, S.alpha, FULL);
    await addTenantMember({ tenant: S.tenantT.tenant, user: dual, bootstrap: S.tenantT.bootstrap, businessRole: 'Admin' });
    const hotel = await Hotel.create({ name: `C20 E hotel ${Date.now()}`, tenant: S.tenantT.tenant._id, manager: S.tenantT.bootstrap._id, createdBy: S.tenantT.bootstrap._id, publicationStatus: 'publie' });
    await operatorService.suspendOperator({ userId: dual._id, actor: S.alpha, reason: 'E hotel' });
    expect((await request(app).get(`/api/hotels/${hotel._id}`).set(bearer(dual))).status).toBe(200);
  });

  test('F — tenant owner/Admin without active PlatformOperator never reaches PLATFORM', async () => {
    const owner = S.tenantT.bootstrap;
    expect(await OrgMembership.countDocuments({ user: owner._id, roleInUnit: 'owner', businessRole: 'Admin', status: 'active' })).toBe(1);
    expect(await PlatformOperator.exists({ user: owner._id })).toBeNull();
    for (const path of ['/api/platform-tenants', '/api/platform-operators', '/api/admin/owners']) {
      expect((await request(app).get(path).set(bearer(owner))).status).toBe(403);
    }
  });

  test('partial support operator keeps its support workflow and nothing more', async () => {
    const support = await makeUser('Admin', 'support');
    await grant(support, S.alpha, ['platform.support.read']);
    expect((await request(app).get('/api/conversations/count/unread').set(bearer(support))).status).toBe(200);
    for (const path of ['/api/platform-tenants', '/api/platform-operators', '/api/admin/owners']) {
      expect((await request(app).get(path).set(bearer(support))).status).toBe(403);
    }
  });
});

// ── Dernier opérateur viable et concurrence autour des nouveaux chemins ─────
describe('C2.0b — dernier opérateur viable et concurrence', () => {
  test('two eligible operators suspending each other concurrently through account routes leave exactly one viable operator active', async () => {
    // Isoler le scénario : ne laisser que deux opérateurs viables.
    const viableBefore = await PlatformOperator.find({ status: 'active', capabilities: 'platform.operators.manage' }).select('user').lean();
    const a = await makeUser('Admin', 'race-a');
    const b = await makeUser('Admin', 'race-b');
    await grant(a, S.alpha, FULL);
    await grant(b, S.alpha, FULL);
    for (const { user } of viableBefore) {
      await PlatformOperator.updateOne({ user }, { $set: { status: 'suspended' } });
    }
    const [ab, ba] = await Promise.all([
      request(app).patch(`/api/admin/owners/${b._id}/suspend`).set(bearer(a)).send({}),
      request(app).patch(`/api/admin/owners/${a._id}/suspend`).set(bearer(b)).send({}),
    ]);
    const statuses = [ab.status, ba.status].sort();
    expect(statuses).toContain(200);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(await PlatformOperator.countDocuments({ user: { $in: [a._id, b._id] }, status: 'active' })).toBe(1);
    for (const { user } of viableBefore) {
      await PlatformOperator.updateOne({ user }, { $set: { status: 'active' } });
    }
  });
});
