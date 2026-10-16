jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingCampaign = require('../models/MarketingCampaign');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const { handleEvent } = require('../services/crmAutomationEngine');
const {
  createCampaign, approveCampaign, sendCampaign,
} = require('../services/marketingCampaignService');
const {
  createTemplateVersion, activateTemplate,
} = require('../services/marketingTemplateService');

jest.setTimeout(120000);
let counter = 0;
const makeUser = (role = 'Admin') => User.create({
  name: 'Marketing Authority', email: `marketing-authority-${Date.now()}-${++counter}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const grant = (user, capabilities = ['platform.marketing.manage']) => PlatformOperator.create({
  user: user._id, status: 'active', capabilities, grantedBy: user._id, grantReason: 'TEST DATA marketing authority',
});
const activeTemplate = (actor) => createTemplateVersion({
  family: `authority-${Date.now()}-${counter}`, name: 'Autorisé', channel: 'email', body: 'Bonjour', actor,
}).then((template) => activateTemplate(template._id, { actor }));

beforeAll(startFinancialMongo);
afterEach(async () => { jest.clearAllMocks(); await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

test('un rôle Admin ou CommunityManager sans PlatformOperator marketing est refusé au niveau service', async () => {
  for (const role of ['Admin', 'CommunityManager']) {
    const actor = await makeUser(role);
    await expect(createTemplateVersion({ family: `denied-${role}`, name: 'Refusé', channel: 'email', body: 'x', actor }))
      .rejects.toMatchObject({ code: 'PLATFORM_MARKETING_AUTHORITY_REQUIRED', statusCode: 403 });
  }
  expect(await MarketingTemplate.countDocuments()).toBe(0);
});

test('un opérateur actif habilité peut créer et approuver une campagne plateforme', async () => {
  const actor = await makeUser(); await grant(actor);
  const template = await activeTemplate(actor);
  const campaign = await createCampaign({ name: 'Campagne plateforme', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
  const approved = await approveCampaign(campaign._id, { actor });
  expect(approved.status).toBe('approved');
  expect(approved.tenant).toBeNull();
});

test('une révocation entre approbation et envoi bloque l’envoi immédiatement', async () => {
  const actor = await makeUser(); await grant(actor);
  const template = await activeTemplate(actor);
  const campaign = await createCampaign({ name: 'Révocation', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
  await approveCampaign(campaign._id, { actor });
  await PlatformOperator.updateOne({ user: actor._id }, { status: 'revoked' });
  await expect(sendCampaign(campaign._id, { actor })).rejects.toMatchObject({ code: 'PLATFORM_MARKETING_AUTHORITY_REQUIRED' });
  expect((await MarketingCampaign.findById(campaign._id)).status).toBe('approved');
});

test('une automatisation marketing tenant échoue sans opérateur, tandis que le CRM opérationnel reste exécutable', async () => {
  const tenantAdmin = await makeUser('Admin');
  const tenantId = tenantAdmin._id;
  await CrmAutomationRule.create({
    tenant: tenantId, ruleId: 'marketing-denied', label: 'Marketing refusé', triggerEvent: 'test_event',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'absent', channel: 'email' } }],
  });
  const denied = await handleEvent({ type: 'test_event', sender: tenantAdmin._id, recipient: tenantAdmin._id, platformTenantId: tenantId });
  expect(denied[0]).toMatchObject({ status: 'error' });

  await CrmAutomationRule.deleteMany({});
  await CrmAutomationRule.create({
    tenant: tenantId, ruleId: 'operational-kept', label: 'CRM conservé', triggerEvent: 'test_event',
    actions: [{ actionId: 'crm.activity.create', params: { title: 'Suivi interne' } }],
  });
  const operational = await handleEvent({ type: 'test_event', sender: tenantAdmin._id, platformTenantId: tenantId });
  expect(operational[0].status).toBe('success');
});


// ── LOT E — matrice HTTP PLATFORM / TENANT / UNRESOLVED, périmètre tenant
// interdit au niveau service, automatisations marketing tenant fermées. ──
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const zohoMailService = require('../services/zohoMailService');
const MarketingSend = require('../models/MarketingSend');
const CrmActivity = require('../models/CrmActivity');
const CrmCustomer = require('../models/CrmCustomer');
const Notification = require('../models/Notification');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { applyConsentChanges } = require('../services/marketingConsentService');
const { errorHandler } = require('../middleware/errorMiddleware');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-marketing-authority';
const httpApp = express();
httpApp.use(express.json());
httpApp.use('/api/marketing', require('../routes/marketingRoutes'));
httpApp.use('/api/crm-automation', require('../routes/crmAutomationRoutes'));
httpApp.use(errorHandler);
const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });
const fullOperatorCapabilities = [...new Set([...PLATFORM_VIEW_REQUIRED_CAPABILITIES, 'platform.marketing.manage'])];

describe('LOT E — matrice HTTP /api/marketing (PLATFORM / TENANT / UNRESOLVED)', () => {
  const postTemplate = (user, headers = {}) => request(httpApp).post('/api/marketing/templates').set(bearer(user)).set(headers)
    .send({ family: `http-${Date.now()}-${Math.random()}`, name: 'HTTP', channel: 'email', body: 'Bonjour' });

  test('PLATFORM : opérateur actif éligible avec platform.marketing.manage → 201', async () => {
    const actor = await makeUser(); await grant(actor, fullOperatorCapabilities);
    expect((await postTemplate(actor)).status).toBe(201);
  });

  test('TENANT : le même opérateur avec un tenant sélectionné → 403 PLATFORM_SCOPE_REQUIRED', async () => {
    const actor = await makeUser(); await grant(actor, fullOperatorCapabilities);
    const { tenant } = await createTenantFixture({ label: 'Marketing TENANT' });
    const res = await postTemplate(actor, { 'X-Platform-Tenant-Id': String(tenant._id) });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_SCOPE_REQUIRED');
    expect(await MarketingTemplate.countDocuments()).toBe(0);
  });

  test('UNRESOLVED : tenant inconnu demandé, ou opérateur non éligible à la Vue plateforme → 403', async () => {
    const actor = await makeUser(); await grant(actor, fullOperatorCapabilities);
    expect((await postTemplate(actor, { 'X-Platform-Tenant-Id': String(new mongoose.Types.ObjectId()) })).status).toBe(403);
    const partial = await makeUser(); await grant(partial, ['platform.marketing.manage']);
    const res = await postTemplate(partial);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
    expect(await MarketingTemplate.countDocuments()).toBe(0);
  });

  test('opérateur sans platform.marketing.manage, suspendu ou révoqué → 403', async () => {
    const without = await makeUser(); await grant(without, fullOperatorCapabilities.filter((c) => c !== 'platform.marketing.manage'));
    const suspended = await makeUser(); await grant(suspended, fullOperatorCapabilities);
    await PlatformOperator.updateOne({ user: suspended._id }, { status: 'suspended' });
    const revoked = await makeUser(); await grant(revoked, fullOperatorCapabilities);
    await PlatformOperator.updateOne({ user: revoked._id }, { status: 'revoked' });
    for (const actor of [without, suspended, revoked]) {
      expect((await postTemplate(actor)).status).toBe(403);
    }
  });

  test('Admin et CommunityManager tenant (membres réels du tenant) → 403 en lecture comme en écriture', async () => {
    const { tenant, bootstrap } = await createTenantFixture({ label: 'Marketing roles' });
    for (const businessRole of ['Admin', 'CommunityManager']) {
      const member = await makeUser(businessRole === 'Admin' ? 'Admin' : 'CommunityManager');
      await addTenantMember({ tenant, user: member, bootstrap, businessRole });
      const headers = { 'X-Platform-Tenant-Id': String(tenant._id) };
      expect((await request(httpApp).get('/api/marketing/campaigns').set(bearer(member)).set(headers)).status).toBe(403);
      expect((await postTemplate(member, headers)).status).toBe(403);
    }
  });
});

describe('LOT E — services marketing : jamais de périmètre tenant', () => {
  test('un opérateur habilité ne peut pas créer de modèle ni de campagne rattachés à un tenant', async () => {
    const actor = await makeUser(); await grant(actor);
    const tenantId = new mongoose.Types.ObjectId();
    await expect(createTemplateVersion({ family: 'tenant-tpl', name: 'T', channel: 'email', body: 'x', actor, tenantId }))
      .rejects.toMatchObject({ code: 'MARKETING_TENANT_SCOPE_FORBIDDEN', statusCode: 403 });
    const template = await activeTemplate(actor);
    await expect(createCampaign({ name: 'Tenant', channel: 'email', templateId: template._id, segmentKey: 'clients', actor, tenantId }))
      .rejects.toMatchObject({ code: 'MARKETING_TENANT_SCOPE_FORBIDDEN' });
    expect(await MarketingCampaign.countDocuments()).toBe(0);
  });

  test('une campagne historique rattachée à un tenant ne peut être ni approuvée ni envoyée, mais reste annulable', async () => {
    const actor = await makeUser(); await grant(actor);
    const template = await activeTemplate(actor);
    const legacyTenant = new mongoose.Types.ObjectId();
    const draft = await MarketingCampaign.create({ tenant: legacyTenant, name: 'Historique', channel: 'email', template: template._id, segmentKey: 'clients' });
    const approved = await MarketingCampaign.create({ tenant: legacyTenant, name: 'Historique approuvée', channel: 'email', template: template._id, segmentKey: 'clients', status: 'approved' });
    await expect(approveCampaign(draft._id, { actor })).rejects.toMatchObject({ code: 'MARKETING_TENANT_SCOPE_FORBIDDEN' });
    await expect(sendCampaign(approved._id, { actor })).rejects.toMatchObject({ code: 'MARKETING_TENANT_SCOPE_FORBIDDEN' });
    expect((await MarketingCampaign.findById(approved._id)).status).toBe('approved');
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    const { cancelCampaign } = require('../services/marketingCampaignService');
    expect((await cancelCampaign(approved._id, { actor })).status).toBe('cancelled');
  });
});

describe('LOT E — automatisations : le marketing ne passe jamais par une règle tenant', () => {
  const seedTenantMarketingRule = async ({ tenantId, actionId = 'marketing.message.send', params }) => {
    const capable = await makeUser(); await grant(capable, fullOperatorCapabilities);
    const target = await makeUser('Client');
    await applyConsentChanges(target._id, { email: true, push: true }, { source: 'web_settings' });
    await CrmCustomer.create({ tenant: tenantId, displayName: 'Cible', emails: [target.email], identityKeys: [`user:${target._id}`], relations: ['prospect'], sourceRefs: [{ entityType: 'User', entityId: target._id, source: 'auth' }] });
    await MarketingTemplate.create({ tenant: tenantId, family: 'wf-family', name: 'WF', channel: 'email', body: 'Promo', status: 'active', version: 1 });
    await CrmAutomationRule.create({ tenant: tenantId, ruleId: 'wf', label: 'WF', triggerEvent: 'test_event', actions: [{ actionId, params: params || { templateFamily: 'wf-family', channel: 'email' } }] });
    return { capable, target };
  };

  test('marketing.message.send refusé même si l’événement est émis par un opérateur marketing habilité ; aucun envoi', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const { capable, target } = await seedTenantMarketingRule({ tenantId });
    const results = await handleEvent({ type: 'test_event', sender: capable._id, recipient: target._id, platformTenantId: tenantId });
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(results[0].error).toMatch(/CRM_MARKETING_ACTION_FORBIDDEN/);
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    expect(await MarketingSend.countDocuments()).toBe(0);
  });

  test('crm.notification.create à destination d’un utilisateur est refusé ; la notification staff opérationnelle reste exécutée', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const { target } = await seedTenantMarketingRule({ tenantId, actionId: 'crm.notification.create', params: { audience: 'user', recipient: null, title: 'Offre' } });
    const denied = await handleEvent({ type: 'test_event', sender: target._id, recipient: target._id, platformTenantId: tenantId });
    expect(denied[0].status).toBe('error');
    expect(await Notification.countDocuments({ title: 'Offre' })).toBe(0);

    await CrmAutomationRule.deleteMany({});
    await CrmAutomationRule.create({ tenant: tenantId, ruleId: 'staff', label: 'Staff', triggerEvent: 'test_event', actions: [{ actionId: 'crm.notification.create', params: { audience: 'staff', notificationType: 'crm_activity_assigned', title: 'Suivi interne', body: 'Relancer le dossier.' } }] });
    const allowed = await handleEvent({ type: 'test_event', sender: target._id, recipient: target._id, platformTenantId: tenantId });
    expect(allowed[0].error).toBeUndefined();
    expect(allowed[0]).toMatchObject({ status: 'success' });
  });

  test('une action sortante inconnue échoue fermée ; une simulation ne livre jamais rien', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const { target } = await seedTenantMarketingRule({ tenantId });
    const simulated = await handleEvent({ type: 'test_event', sender: target._id, recipient: target._id, platformTenantId: tenantId }, { simulate: true });
    expect(simulated[0].status).toBe('simulated');
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    expect(await MarketingSend.countDocuments()).toBe(0);

    await CrmAutomationRule.deleteMany({});
    await CrmAutomationRule.create({ tenant: tenantId, ruleId: 'unknown', label: 'Inconnue', triggerEvent: 'test_event', actions: [{ actionId: 'sms.broadcast', params: {} }] });
    const unknown = await handleEvent({ type: 'test_event', sender: target._id, platformTenantId: tenantId });
    expect(unknown[0].status).toBe('error');
    expect(unknown[0].error).toMatch(/CRM_OUTBOUND_ACTION_NOT_ALLOWED/);
  });

  test('HTTP : un Admin tenant ne peut pas enregistrer une règle marketing ; une règle opérationnelle reste autorisée', async () => {
    const { tenant, bootstrap } = await createTenantFixture({ label: 'CRM automation', withAdminMembership: true });
    const headers = { ...bearer(bootstrap), 'X-Platform-Tenant-Id': String(tenant._id) };
    const marketing = await request(httpApp).post('/api/crm-automation/rules').set(headers)
      .send({ ruleId: 'promo', label: 'Promo', triggerEvent: 'quote_received', actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'x' } }] });
    expect(marketing.status).toBe(403);
    expect(marketing.body.code).toBe('CRM_MARKETING_ACTION_FORBIDDEN');
    const userNotification = await request(httpApp).post('/api/crm-automation/rules').set(headers)
      .send({ ruleId: 'notif', label: 'Notif', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.notification.create', params: { audience: 'user' } }] });
    expect(userNotification.status).toBe(403);
    const operational = await request(httpApp).post('/api/crm-automation/rules').set(headers)
      .send({ ruleId: 'suivi', label: 'Suivi', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create', params: { title: 'Rappeler' } }] });
    expect(operational.status).toBe(201);
    const created = operational.body.data.rule;
    const sneaky = await request(httpApp).patch(`/api/crm-automation/rules/${created._id}`).set(headers)
      .send({ actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'x' } }] });
    expect(sneaky.status).toBe(403);
    expect((await CrmAutomationRule.findById(created._id).lean()).actions[0].actionId).toBe('crm.task.create');
    expect(await CrmActivity.countDocuments()).toBe(0);
  });
});
