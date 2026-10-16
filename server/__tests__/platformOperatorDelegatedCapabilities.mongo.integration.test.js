// PLATFORM-ACCREDITATIONS-1 — gestion des habilitations déléguables depuis
// l'onglet Utilisateurs de la Vue plateforme, sans modification manuelle de
// la base. Réutilise l'identité PlatformOperator, la garde
// `platform.operators.manage` + scope PLATFORM, le verrou sentinelle et
// l'audit ActionLog existants.
//
//   GET  /api/platform-operators/:userId/capabilities  → identité, statut,
//        capacités actuelles, capacités déléguables (liste serveur fermée)
//   POST /api/platform-operators/:userId/capabilities  { capability, action, reason }
//
// Refus couverts : admin d'organisation cliente, opérateur sans délégation,
// sélection de tenant, auto-accréditation, capacité non déléguable,
// bénéficiaire inéligible, administrateur critique protégé.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const operatorService = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES, PLATFORM_DELEGABLE_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/platform-operators', require('../routes/platformOperatorRoutes'));
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const FULL = [...PLATFORM_VIEW_REQUIRED_CAPABILITIES];
let seq = 0;
const makeUser = (role, label, over = {}) => {
  seq += 1;
  return User.create({
    name: `ACC ${label} ${seq}`, email: `acc-${label}-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true, ...over,
  });
};
const capsOf = async (user) => [...((await PlatformOperator.findOne({ user: user._id }).lean())?.capabilities || [])].sort();
const capabilitiesUrl = (user) => `/api/platform-operators/${user._id}/capabilities`;
const change = (actor, target, capability, action, { tenant, reason = 'Habilitation agent support' } = {}) => request(app)
  .post(capabilitiesUrl(target)).set(bearer(actor, tenant)).send({ capability, action, reason });

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.root = await createTenantFixture({ label: 'ACC root', withAdminMembership: true });
  S.alpha = await makeUser('Admin', 'alpha');
  await operatorService.provisionPrivilegedOperator({ userId: S.alpha._id, actor: S.root.bootstrap, reason: 'fixture', capabilities: FULL });
  S.beta = await makeUser('Admin', 'beta');
  await operatorService.provisionPrivilegedOperator({ userId: S.beta._id, actor: S.alpha, reason: 'fixture', capabilities: FULL });
  // Opérateur éligible à la Vue plateforme SANS `platform.operators.manage`.
  S.noDelegation = await makeUser('Admin', 'nodeleg');
  await operatorService.provisionPrivilegedOperator({
    userId: S.noDelegation._id, actor: S.alpha, reason: 'fixture',
    capabilities: FULL.filter((cap) => cap !== 'platform.operators.manage'),
  });
  ({ user: S.tenantAdmin } = await createTenantUser({ tenant: S.root.tenant, bootstrap: S.root.bootstrap, overrides: { role: 'Admin' }, businessRole: 'Admin' }));
  S.prospect = await makeUser('Client', 'prospect');
  S.inbox = await Conversation.create({ isStaffInbox: true, tenant: null, participants: [S.prospect._id], lastMessage: 'Bonjour' });
});
afterAll(stopFinancialMongo);

describe('Registre des capacités déléguables', () => {
  test('liste fermée : support (lecture, réponse), commercial et marketing uniquement', () => {
    expect([...PLATFORM_DELEGABLE_CAPABILITIES]).toEqual([
      'platform.support.read', 'platform.support.reply', 'platform.commercial.manage', 'platform.marketing.manage',
    ]);
    expect(PLATFORM_DELEGABLE_CAPABILITIES).not.toContain('platform.operators.manage');
    expect(PLATFORM_DELEGABLE_CAPABILITIES).not.toContain('platform.support.impersonation');
  });
});

describe('GET /:userId/capabilities — fiche d’habilitations', () => {
  test('un gestionnaire voit identité, statut, capacités actuelles et la liste déléguable du serveur', async () => {
    const agent = await makeUser('Client', 'view');
    const res = await request(app).get(capabilitiesUrl(agent)).set(bearer(S.alpha));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ _id: String(agent._id), name: agent.name, email: agent.email, isActive: true });
    expect(res.body.data.operator).toBeNull();
    expect(res.body.data.delegableCapabilities).toEqual([...PLATFORM_DELEGABLE_CAPABILITIES]);
    expect(res.body.data.self).toBe(false);
  });

  test('refus pour un administrateur d’organisation cliente et pour un opérateur sans délégation', async () => {
    const agent = await makeUser('Client', 'view-deny');
    expect((await request(app).get(capabilitiesUrl(agent)).set(bearer(S.tenantAdmin))).status).toBe(403);
    expect((await request(app).get(capabilitiesUrl(agent)).set(bearer(S.tenantAdmin, S.root.tenant))).status).toBe(403);
    expect((await request(app).get(capabilitiesUrl(agent)).set(bearer(S.noDelegation))).status).toBe(403);
  });
});

describe('POST /:userId/capabilities — accorder / retirer', () => {
  test('attribution autorisée de platform.support.read puis platform.support.reply, accès effectif à la boîte', async () => {
    const agent = await makeUser('Client', 'agent');
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(agent))).status).toBe(403);

    const read = await change(S.alpha, agent, 'platform.support.read', 'grant');
    expect(read.status).toBe(200);
    expect(read.body.data.operator).toMatchObject({ status: 'active', capabilities: ['platform.support.read'] });
    const reply = await change(S.alpha, agent, 'platform.support.reply', 'grant');
    expect(reply.status).toBe(200);
    expect(await capsOf(agent)).toEqual(['platform.support.read', 'platform.support.reply']);

    const inbox = await request(app).get('/api/conversations/staff-inbox').set(bearer(agent));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.conversations.map((c) => String(c._id))).toContain(String(S.inbox._id));
  });

  test('révocation : perte immédiate de l’accès, les autres capacités sont conservées', async () => {
    const agent = await makeUser('Client', 'revoke');
    await change(S.alpha, agent, 'platform.support.read', 'grant');
    await change(S.alpha, agent, 'platform.commercial.manage', 'grant');
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(agent))).status).toBe(200);

    const res = await change(S.beta, agent, 'platform.support.read', 'revoke');
    expect(res.status).toBe(200);
    expect(await capsOf(agent)).toEqual(['platform.commercial.manage']);
    expect((await request(app).get('/api/conversations/staff-inbox').set(bearer(agent))).status).toBe(403);
  });

  test('refus pour un administrateur d’organisation cliente (avec ou sans sélection de tenant), aucune écriture', async () => {
    const agent = await makeUser('Client', 'tenant-deny');
    expect((await change(S.tenantAdmin, agent, 'platform.support.read', 'grant')).status).toBe(403);
    expect((await change(S.tenantAdmin, agent, 'platform.support.read', 'grant', { tenant: S.root.tenant })).status).toBe(403);
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('refus pour un opérateur sans droit de délégation', async () => {
    const agent = await makeUser('Client', 'nodeleg-deny');
    expect((await change(S.noDelegation, agent, 'platform.support.read', 'grant')).status).toBe(403);
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('refus hors contexte PLATFORM (sélection de tenant), même pour un gestionnaire', async () => {
    const agent = await makeUser('Client', 'scope-deny');
    const res = await change(S.alpha, agent, 'platform.support.read', 'grant', { tenant: S.root.tenant });
    expect(res.status).toBe(403);
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('refus d’auto-accréditation (accorder comme retirer)', async () => {
    const before = await capsOf(S.alpha);
    expect((await change(S.alpha, S.alpha, 'platform.support.reply', 'grant')).body.code).toBe('PLATFORM_OPERATOR_SELF_ACTION_FORBIDDEN');
    expect((await change(S.alpha, S.alpha, 'platform.support.read', 'revoke')).status).toBe(403);
    expect(await capsOf(S.alpha)).toEqual(before);
  });

  test('refus d’une capacité non déléguable ou inconnue', async () => {
    const agent = await makeUser('Client', 'nondeleg');
    for (const capability of ['platform.operators.manage', 'platform.support.impersonation', 'platform.finance.manage', 'platform.inexistante']) {
      const res = await change(S.alpha, agent, capability, 'grant');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLATFORM_CAPABILITY_NOT_DELEGABLE');
    }
    expect(await PlatformOperator.exists({ user: agent._id })).toBeNull();
  });

  test('action, motif et bénéficiaire invalides refusés', async () => {
    const agent = await makeUser('Client', 'invalid');
    expect((await change(S.alpha, agent, 'platform.support.read', 'escalate')).status).toBe(422);
    expect((await change(S.alpha, agent, 'platform.support.read', 'grant', { reason: '  ' })).status).toBe(422);
    const suspendedUser = await makeUser('Client', 'inactive', { isActive: false, status: 'Suspendu' });
    expect((await change(S.alpha, suspendedUser, 'platform.support.read', 'grant')).body.code).toBe('PLATFORM_CAPABILITY_BENEFICIARY_INELIGIBLE');
    const technical = await makeUser('Client', 'technical', { isTechnical: true });
    expect((await change(S.alpha, technical, 'platform.support.read', 'grant')).status).toBe(404);
    expect(await PlatformOperator.exists({ user: { $in: [suspendedUser._id, technical._id] } })).toBeNull();
  });

  test('un opérateur suspendu ou révoqué n’est pas réhabilité par une simple délégation', async () => {
    const agent = await makeUser('Client', 'suspended-op');
    await change(S.alpha, agent, 'platform.support.read', 'grant');
    await operatorService.suspendOperator({ userId: agent._id, actor: S.alpha, reason: 'enquête' });
    const res = await change(S.alpha, agent, 'platform.support.reply', 'grant');
    expect(res.status).toBe(409);
    expect((await PlatformOperator.findOne({ user: agent._id }).lean()).status).toBe('suspended');
  });

  test('protection des administrateurs critiques : impossible de leur retirer une capacité requise par la Vue plateforme', async () => {
    const res = await change(S.alpha, S.beta, 'platform.commercial.manage', 'revoke');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLATFORM_CRITICAL_ADMIN_PROTECTED');
    expect(await capsOf(S.beta)).toContain('platform.commercial.manage');
    // Une capacité non requise (support.reply) reste gérable pour eux.
    expect((await change(S.alpha, S.beta, 'platform.support.reply', 'grant')).status).toBe(200);
    expect((await change(S.alpha, S.beta, 'platform.support.reply', 'revoke')).status).toBe(200);
  });

  test('idempotence : accorder une capacité déjà détenue ou retirer une capacité absente ne journalise rien', async () => {
    const agent = await makeUser('Client', 'idem');
    await change(S.alpha, agent, 'platform.support.read', 'grant');
    const logsBefore = await ActionLog.countDocuments({ 'cible.id': String(agent._id) });
    expect((await change(S.alpha, agent, 'platform.support.read', 'grant')).status).toBe(200);
    expect((await change(S.alpha, agent, 'platform.marketing.manage', 'revoke')).status).toBe(200);
    expect(await ActionLog.countDocuments({ 'cible.id': String(agent._id) })).toBe(logsBefore);
  });

  test('historique d’audit : acteur, capacité, avant/après et motif pour chaque attribution et retrait', async () => {
    const agent = await makeUser('Client', 'audit');
    await change(S.alpha, agent, 'platform.support.read', 'grant', { reason: 'Agent support Brazzaville' });
    await change(S.beta, agent, 'platform.support.read', 'revoke', { reason: 'Fin de mission' });
    const logs = await ActionLog.find({ 'cible.id': String(agent._id) }).sort({ createdAt: 1, _id: 1 }).lean();
    expect(logs.map((log) => log.action)).toEqual(['platform_operator.capability_granted', 'platform_operator.capability_revoked']);
    const [granted, revoked] = logs;
    expect(String(granted.auteur?.id || granted.auteur?._id)).toBe(String(S.alpha._id));
    expect(granted.metadata.reason).toBe('Agent support Brazzaville');
    expect(JSON.parse(granted.metadata.nouvelleValeur)).toMatchObject({ capability: 'platform.support.read', capabilities: ['platform.support.read'] });
    expect(String(revoked.auteur?.id || revoked.auteur?._id)).toBe(String(S.beta._id));
    expect(JSON.parse(revoked.metadata.ancienneValeur)).toMatchObject({ capabilities: ['platform.support.read'] });
    expect(JSON.parse(revoked.metadata.nouvelleValeur)).toMatchObject({ capability: 'platform.support.read', capabilities: [] });
  });
});
