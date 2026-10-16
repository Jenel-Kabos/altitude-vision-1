// PLATFORM-DELEGATION-POLICY-1 — gouvernance uniforme des capacités
// PlatformOperator sur TOUTES les API. Un acteur détenant
// `platform.operators.manage` ne peut jamais attribuer, directement ou
// indirectement (création, remplacement, réactivation, délégation unitaire),
// une capacité hors de la liste fermée PLATFORM_DELEGABLE_CAPABILITIES.
// L'attribution de capacités critiques relève uniquement du provisionnement
// privilégié (scripts CLI gardés), jamais d'une route HTTP.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const operatorService = require('../services/platformOperator/platformOperatorService');
const policy = require('../services/platformOperator/capabilityDelegationPolicy');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES, PLATFORM_DELEGABLE_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/platform-operators', require('../routes/platformOperatorRoutes'));
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

const FULL = [...PLATFORM_VIEW_REQUIRED_CAPABILITIES];
let seq = 0;
const makeUser = (label, over = {}) => {
  seq += 1;
  return User.create({
    name: `DPOL ${label} ${seq}`, email: `dpol-${label}-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const capsOf = async (user) => [...((await PlatformOperator.findOne({ user: user._id }).lean())?.capabilities || [])].sort();
const create = (actor, target, capabilities, reason = 'Création agent') => request(app)
  .post('/api/platform-operators').set(bearer(actor)).send({ userId: String(target._id), capabilities, reason });

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.root = await createTenantFixture({ label: 'DPOL root', withAdminMembership: true });
  // Administrateurs critiques : provisionnement privilégié (chemin CLI).
  S.alpha = await makeUser('alpha', { role: 'Admin' });
  await operatorService.provisionPrivilegedOperator({ userId: S.alpha._id, actor: S.root.bootstrap, reason: 'fixture', capabilities: FULL });
  S.beta = await makeUser('beta', { role: 'Admin' });
  await operatorService.provisionPrivilegedOperator({ userId: S.beta._id, actor: S.alpha, reason: 'fixture', capabilities: FULL });
});
afterAll(stopFinancialMongo);

describe('Politique centrale de délégation', () => {
  test('liste fermée unique, partagée par toutes les opérations ordinaires', () => {
    expect([...policy.DELEGABLE_CAPABILITIES]).toEqual([...PLATFORM_DELEGABLE_CAPABILITIES]);
    for (const capability of PLATFORM_DELEGABLE_CAPABILITIES) expect(policy.isDelegableCapability(capability)).toBe(true);
    for (const capability of ['platform.operators.manage', 'platform.support.impersonation', 'platform.finance.read', 'platform.finance.manage', 'platform.tenants.manage', 'platform.users.manage', 'platform.api.manage']) {
      expect(policy.isDelegableCapability(capability)).toBe(false);
    }
  });

  test('assertDelegableCapabilities : inconnue → 422, non déléguable → 403 PLATFORM_CAPABILITY_NOT_DELEGABLE', () => {
    expect(() => policy.assertDelegableCapabilities(['platform.inexistante'])).toThrow(expect.objectContaining({ statusCode: 422 }));
    expect(() => policy.assertDelegableCapabilities(['platform.support.read', 'platform.operators.manage']))
      .toThrow(expect.objectContaining({ code: 'PLATFORM_CAPABILITY_NOT_DELEGABLE', statusCode: 403 }));
    expect(() => policy.assertDelegableCapabilities([...PLATFORM_DELEGABLE_CAPABILITIES])).not.toThrow();
  });
});

describe('POST /api/platform-operators — création soumise à la politique', () => {
  test('création avec une capacité déléguable : AUTORISÉE', async () => {
    const agent = await makeUser('create-ok');
    const res = await create(S.alpha, agent, ['platform.support.read']);
    expect(res.status).toBe(201);
    expect(await capsOf(agent)).toEqual(['platform.support.read']);
  });

  test('délégation légitime des quatre capacités en une création : AUTORISÉE', async () => {
    const agent = await makeUser('create-four');
    const res = await create(S.alpha, agent, [...PLATFORM_DELEGABLE_CAPABILITIES]);
    expect(res.status).toBe(201);
    expect(await capsOf(agent)).toEqual([...PLATFORM_DELEGABLE_CAPABILITIES].sort());
  });

  test.each([
    ['platform.operators.manage'],
    ['platform.support.impersonation'],
    ['platform.finance.manage'],
    ['platform.finance.read'],
    ['platform.tenants.manage'],
  ])('création avec %s : REFUS, aucune écriture', async (capability) => {
    const agent = await makeUser('create-deny');
    const res = await create(S.alpha, agent, ['platform.support.read', capability]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_CAPABILITY_NOT_DELEGABLE');
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('création de la Vue plateforme complète (élévation au rang d’administrateur critique) : REFUS', async () => {
    const agent = await makeUser('create-full');
    expect((await create(S.alpha, agent, FULL)).status).toBe(403);
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('auto-accréditation par la création : REFUS', async () => {
    const before = await capsOf(S.alpha);
    const res = await create(S.alpha, S.alpha, ['platform.support.reply']);
    expect(res.status).toBe(403);
    expect(await capsOf(S.alpha)).toEqual(before);
  });

  test('bénéficiaire inactif : REFUS', async () => {
    const inactive = await makeUser('inactive', { isActive: false, status: 'Suspendu' });
    expect((await create(S.alpha, inactive, ['platform.support.read'])).status).toBe(409);
    expect(await PlatformOperator.exists({ user: inactive._id })).toBeNull();
  });
});

describe('Modifications indirectes', () => {
  test('remplacement de l’ensemble des capacités d’un administrateur critique (retrait implicite) : REFUS, capacités inchangées', async () => {
    const before = await capsOf(S.beta);
    const res = await create(S.alpha, S.beta, ['platform.support.read']);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_PRIVILEGED_TARGET');
    expect(await capsOf(S.beta)).toEqual(before);
  });

  test('remplacement sur un opérateur détenant une capacité non déléguable (impersonation) : REFUS', async () => {
    const holder = await makeUser('imp-holder');
    await operatorService.provisionPrivilegedOperator({ userId: holder._id, actor: S.alpha, reason: 'fixture', capabilities: ['platform.support.impersonation'] });
    const res = await create(S.alpha, holder, ['platform.support.read']);
    expect(res.status).toBe(409);
    expect(await capsOf(holder)).toEqual(['platform.support.impersonation']);
  });

  test('réactivation restaurant une capacité non déléguable : REFUS, l’opérateur reste suspendu', async () => {
    const holder = await makeUser('imp-suspended');
    await operatorService.provisionPrivilegedOperator({ userId: holder._id, actor: S.alpha, reason: 'fixture', capabilities: ['platform.support.read', 'platform.support.impersonation'] });
    await operatorService.suspendOperator({ userId: holder._id, actor: S.alpha, reason: 'enquête' });
    const res = await request(app).patch(`/api/platform-operators/${holder._id}/reactivate`).set(bearer(S.beta)).send({ reason: 'retour' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_PRIVILEGED_REACTIVATION_FORBIDDEN');
    expect((await PlatformOperator.findOne({ user: holder._id }).lean()).status).toBe('suspended');
  });

  test('réactivation d’un agent aux seules capacités déléguables : AUTORISÉE, capacités conservées à l’identique', async () => {
    const agent = await makeUser('agent-suspended');
    await create(S.alpha, agent, ['platform.support.read', 'platform.support.reply']);
    await request(app).patch(`/api/platform-operators/${agent._id}/suspend`).set(bearer(S.alpha)).send({ reason: 'congé' });
    expect(await capsOf(agent)).toEqual(['platform.support.read', 'platform.support.reply']);
    const res = await request(app).patch(`/api/platform-operators/${agent._id}/reactivate`).set(bearer(S.beta)).send({ reason: 'retour' });
    expect(res.status).toBe(200);
    expect(res.body.data.operator.status).toBe('active');
    expect(await capsOf(agent)).toEqual(['platform.support.read', 'platform.support.reply']);
  });

  test('ré-octroi d’un opérateur révoqué avec capacités déléguables : AUTORISÉ, jamais d’héritage des anciennes capacités', async () => {
    const agent = await makeUser('agent-revoked');
    await operatorService.provisionPrivilegedOperator({ userId: agent._id, actor: S.alpha, reason: 'fixture', capabilities: ['platform.support.read', 'platform.finance.read'] });
    await operatorService.revokeOperator({ userId: agent._id, actor: S.alpha, reason: 'fin' });
    // Le document révoqué conserve l'historique de `platform.finance.read` : un
    // ré-octroi ordinaire repart d'un ensemble déléguable, jamais de l'ancien.
    const res = await create(S.alpha, agent, ['platform.support.reply']);
    expect(res.status).toBe(201);
    expect(await capsOf(agent)).toEqual(['platform.support.reply']);
  });

  test('délégation unitaire d’une capacité non déléguable : REFUS (même politique)', async () => {
    const agent = await makeUser('unit-deny');
    const res = await request(app).post(`/api/platform-operators/${agent._id}/capabilities`).set(bearer(S.alpha))
      .send({ capability: 'platform.operators.manage', action: 'grant', reason: 'escalade' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_CAPABILITY_NOT_DELEGABLE');
  });

  test('opération sans rapport : la délégation à un agent ne modifie aucune capacité des autres opérateurs', async () => {
    const [alphaBefore, betaBefore] = [await capsOf(S.alpha), await capsOf(S.beta)];
    const agent = await makeUser('unrelated');
    await create(S.alpha, agent, ['platform.commercial.manage']);
    await request(app).post(`/api/platform-operators/${agent._id}/capabilities`).set(bearer(S.beta))
      .send({ capability: 'platform.marketing.manage', action: 'grant', reason: 'campagnes' });
    expect(await capsOf(S.alpha)).toEqual(alphaBefore);
    expect(await capsOf(S.beta)).toEqual(betaBefore);
    expect(await capsOf(agent)).toEqual(['platform.commercial.manage', 'platform.marketing.manage']);
  });
});

describe('Administrateur critique et audit', () => {
  test('préservation du dernier administrateur critique : suspension/révocation du dernier refusées', async () => {
    const ctx = await createTenantFixture({ label: 'DPOL last', withAdminMembership: true });
    // Base isolée : on ne garde qu'un seul administrateur critique viable.
    await PlatformOperator.updateMany({ user: { $ne: S.alpha._id }, capabilities: 'platform.operators.manage' }, { $set: { status: 'suspended' } });
    const agent = await makeUser('last-actor');
    await operatorService.provisionPrivilegedOperator({ userId: agent._id, actor: ctx.bootstrap, reason: 'fixture', capabilities: FULL.filter((cap) => cap !== 'platform.operators.manage') });
    await expect(operatorService.suspendOperator({ userId: S.alpha._id, actor: agent, reason: 'tentative' }))
      .rejects.toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
    await expect(operatorService.revokeOperator({ userId: S.alpha._id, actor: agent, reason: 'tentative' }))
      .rejects.toMatchObject({ code: 'LAST_PLATFORM_OPERATOR' });
    expect((await PlatformOperator.findOne({ user: S.alpha._id }).lean()).status).toBe('active');
    await PlatformOperator.updateMany({ user: S.beta._id }, { $set: { status: 'active' } });
  });

  test('audit : création ordinaire journalisée (acteur, avant/après) ; tentative refusée non journalisée', async () => {
    const agent = await makeUser('audit');
    await create(S.alpha, agent, ['platform.support.read'], 'Agent support');
    await create(S.alpha, agent, ['platform.operators.manage'], 'escalade');
    const logs = await ActionLog.find({ 'cible.id': String(agent._id) }).lean();
    expect(logs.map((log) => log.action)).toEqual(['platform_operator.granted']);
    expect(String(logs[0].auteur.id)).toBe(String(S.alpha._id));
    expect(JSON.parse(logs[0].metadata.nouvelleValeur)).toMatchObject({ status: 'active', capabilities: ['platform.support.read'] });
    expect(logs[0].metadata.reason).toBe('Agent support');
  });

  test('provisionnement privilégié : absent des routes HTTP (aucun paramètre ne l’active)', async () => {
    const agent = await makeUser('no-flag');
    const res = await request(app).post('/api/platform-operators').set(bearer(S.alpha))
      .send({ userId: String(agent._id), capabilities: ['platform.operators.manage'], reason: 'flag', allowSelfGrant: true, privileged: true, provision: true });
    expect(res.status).toBe(403);
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });
});
