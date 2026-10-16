// MARKETING-AUTOMATION-1 — Segments dynamiques, modèles versionnés, moteur
// de campagnes (approbation humaine obligatoire), workflow marketing exécuté
// par crmAutomationEngine (aucun second moteur), domaine Reporting
// 'marketing', et administration HTTP /api/marketing.
//
// LOT E — le marketing commercial est réservé à Altitude Vision : toute
// mutation est faite par un PlatformOperator actif détenant
// `platform.marketing.manage` (jamais un rôle User ni une adhésion tenant),
// en contexte PLATFORM. Les anciens cas « CommunityManager tenant peut… »
// vérifient désormais le refus. Aucun envoi réel : Zoho est simulé.
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const CrmCustomer = require('../models/CrmCustomer');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingSend = require('../models/MarketingSend');
const MarketingUnsubscribe = require('../models/MarketingUnsubscribe');
const zohoMailService = require('../services/zohoMailService');
const { listSegments, resolveSegment } = require('../services/marketingSegmentService');
const { createTemplateVersion, activateTemplate, renderTemplate } = require('../services/marketingTemplateService');
const { createCampaign, approveCampaign, cancelCampaign, sendCampaign, CampaignError } = require('../services/marketingCampaignService');
const { handleEvent } = require('../services/crmAutomationEngine');
const { applyConsentChanges } = require('../services/marketingConsentService');
const { getMarketingReport } = require('../services/reporting/domains/marketingReport');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const marketingRoutes = require('../routes/marketingRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/marketing', marketingRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `mktauto${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};
const attachTenant = async (member, businessRole = member.role) => {
  const admin = await makeUser({ role: 'Admin' });
  const tenant = await require('../services/platformTenant/platformTenantService').createTenant({ name: `Marketing HTTP ${Date.now()} ${counter}`, actor: admin });
  await require('../services/organizationService').grantMembership({ userId: member._id, orgUnitId: tenant.rootOrgUnit, businessRole, actor: admin });
  return tenant;
};

// Acteur marketing Altitude Vision : PlatformOperator actif, éligible à la
// Vue plateforme et détenteur explicite de `platform.marketing.manage`. Son
// rôle User ('Client') prouve que l'autorité ne vient jamais du rôle.
const makeMarketingOperator = async () => {
  const user = await makeUser({ role: 'Client' });
  await PlatformOperator.create({
    user: user._id, status: 'active',
    capabilities: [...new Set([...PLATFORM_VIEW_REQUIRED_CAPABILITIES, 'platform.marketing.manage'])],
    grantedBy: user._id, grantReason: 'TEST DATA marketing automation',
  });
  return user;
};

// MARKETING-CONSENT-1 — un envoi marketing exige un consentement explicite
// du canal, accordé par le seul chemin d'écriture autorisé.
const grantConsent = (user, channels = { email: true, push: true }) => applyConsentChanges(user._id, channels, { source: 'web_settings' });

const makeCustomerForUser = (user, relations = ['prospect']) => CrmCustomer.create({
  displayName: user.name, emails: [user.email], identityKeys: [`user:${user._id}`, `email:${user.email}`],
  relations, sourceRefs: [{ entityType: 'User', entityId: user._id, source: 'auth' }],
});

const makeActiveTemplate = async (actor, overrides = {}) => {
  const template = await createTemplateVersion({
    family: `famille-${Date.now()}-${Math.random()}`,
    name: 'Bienvenue', channel: 'email', subject: 'Bonjour {{prenom}}', body: 'Bienvenue {{prenom}} {{nom}} !',
    ...overrides, actor,
  });
  return activateTemplate(template._id, { actor });
};

beforeAll(startFinancialMongo);
afterEach(async () => { jest.clearAllMocks(); await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

describe('marketingSegmentService — segmentation dynamique (Phase 3)', () => {
  test('expose 14 segments déclaratifs, jamais stockés', () => {
    const segments = listSegments();
    expect(segments).toHaveLength(14);
    expect(segments.every((s) => s.key && s.label && s.description)).toBe(true);
  });

  test('un prospect réel apparaît dans le segment "prospects"', async () => {
    const client = await makeUser();
    const customer = await makeCustomerForUser(client, ['prospect']);
    const ids = await resolveSegment('prospects');
    expect(ids).toContain(String(customer._id));
  });

  test('le segment géographique sans ville renvoie un tableau vide (jamais une erreur)', async () => {
    expect(await resolveSegment('geographique', {})).toEqual([]);
  });

  test('un segment inconnu lève une erreur explicite', async () => {
    await expect(resolveSegment('segment_inexistant')).rejects.toThrow(/inconnu/i);
  });
});

describe('marketingTemplateService — versionnement (Phase 6)', () => {
  test('createTemplateVersion crée une v1 en brouillon ; activateTemplate archive la précédente', async () => {
    const actor = await makeMarketingOperator();
    const family = `fam-${Date.now()}`;
    const v1 = await createTemplateVersion({ family, name: 'V1', channel: 'email', body: 'Bonjour', actor });
    expect(v1.version).toBe(1);
    expect(v1.status).toBe('draft');
    expect(v1.tenant).toBeNull();
    await activateTemplate(v1._id, { actor });

    const v2 = await createTemplateVersion({ family, name: 'V2', channel: 'email', body: 'Bonjour v2', actor });
    expect(v2.version).toBe(2);
    expect(v2.previousVersion.toString()).toBe(v1._id.toString());
    await activateTemplate(v2._id, { actor });

    const refreshedV1 = await MarketingTemplate.findById(v1._id).lean();
    expect(refreshedV1.status).toBe('archived');
    const refreshedV2 = await MarketingTemplate.findById(v2._id).lean();
    expect(refreshedV2.status).toBe('active');
  });

  test('sans acteur plateforme habilité, aucun modèle n\'est créé ni activé', async () => {
    const actor = await makeMarketingOperator();
    const draft = await createTemplateVersion({ family: `fam-${Date.now()}`, name: 'V1', channel: 'email', body: 'x', actor });
    const tenantAdmin = await makeUser({ role: 'Admin' });
    await expect(createTemplateVersion({ family: 'x', name: 'x', channel: 'email', body: 'x' })).rejects.toMatchObject({ code: 'PLATFORM_MARKETING_AUTHORITY_REQUIRED' });
    await expect(activateTemplate(draft._id, { actor: tenantAdmin })).rejects.toMatchObject({ code: 'PLATFORM_MARKETING_AUTHORITY_REQUIRED' });
    expect((await MarketingTemplate.findById(draft._id).lean()).status).toBe('draft');
  });

  test('renderTemplate substitue les variables connues et laisse les inconnues intactes', () => {
    const rendered = renderTemplate({ subject: 'Bonjour {{prenom}}', body: '{{prenom}} — {{inconnu}}' }, { prenom: 'Alice' });
    expect(rendered.subject).toBe('Bonjour Alice');
    expect(rendered.body).toBe('Alice — {{inconnu}}');
  });
});

describe('marketingCampaignService — approbation humaine obligatoire (Phase 4)', () => {
  test('createCampaign refuse un modèle inactif', async () => {
    const actor = await makeMarketingOperator();
    const draft = await createTemplateVersion({ family: `f-${Date.now()}`, name: 'Draft', channel: 'email', body: 'x', actor });
    await expect(createCampaign({ name: 'C', channel: 'email', templateId: draft._id, segmentKey: 'clients', actor })).rejects.toThrow(CampaignError);
  });

  test('createCampaign refuse une incohérence de canal modèle/campagne', async () => {
    const actor = await makeMarketingOperator();
    const template = await makeActiveTemplate(actor);
    await expect(createCampaign({ name: 'C', channel: 'sms', templateId: template._id, segmentKey: 'clients', actor })).rejects.toThrow(/canal/i);
  });

  test('sendCampaign refuse strictement tout ce qui n\'est pas approuvé', async () => {
    const actor = await makeMarketingOperator();
    const template = await makeActiveTemplate(actor);
    const campaign = await createCampaign({ name: 'C', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    await expect(sendCampaign(campaign._id, { actor })).rejects.toThrow(CampaignError);
    expect(await MarketingSend.countDocuments()).toBe(0);
  });

  test('cycle complet : brouillon → approuvée → envoyée, avec journal MarketingSend et stats', async () => {
    const actor = await makeMarketingOperator();
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    await grantConsent(target);
    const template = await makeActiveTemplate(actor);

    const campaign = await createCampaign({ name: 'Campagne clients', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    expect(campaign.status).toBe('draft');
    expect(campaign.tenant).toBeNull();

    await approveCampaign(campaign._id, { actor });
    const sent = await sendCampaign(campaign._id, { actor });

    expect(sent.status).toBe('sent');
    expect(sent.stats.totalRecipients).toBeGreaterThanOrEqual(1);
    expect(sent.stats.sentCount).toBeGreaterThanOrEqual(1);
    expect(zohoMailService.sendEmail).toHaveBeenCalled();
    expect(await MarketingSend.countDocuments({ campaign: campaign._id })).toBe(sent.stats.totalRecipients);
    expect(zohoMailService.sendEmail).toHaveBeenCalledWith(undefined, target.email, expect.any(String), expect.stringContaining('/desinscription-marketing?token='));
  });

  test('un destinataire désabonné est bloqué et journalisé, jamais envoyé', async () => {
    const actor = await makeMarketingOperator();
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    await grantConsent(target);
    await MarketingUnsubscribe.create({ email: target.email });
    const template = await makeActiveTemplate(actor);

    const campaign = await createCampaign({ name: 'Campagne désabonnés', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    await approveCampaign(campaign._id, { actor });
    const sent = await sendCampaign(campaign._id, { actor });

    const blocked = await MarketingSend.findOne({ campaign: campaign._id, recipientUser: target._id });
    expect(blocked.status).toBe('unsubscribed');
    expect(blocked.error).toBe('EMAIL_SUPPRESSED');
    expect(blocked.recipientEmail).toBeNull();
    expect(sent.stats.sentCount).toBe(0);
  });

  test('cancelCampaign fonctionne depuis draft ou approved, jamais depuis sent', async () => {
    const actor = await makeMarketingOperator();
    const template = await makeActiveTemplate(actor);
    const campaign = await createCampaign({ name: 'À annuler', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    const cancelled = await cancelCampaign(campaign._id, { actor, reason: 'test' });
    expect(cancelled.status).toBe('cancelled');
    await expect(cancelCampaign(campaign._id, { actor })).rejects.toThrow(CampaignError);
  });
});

describe('crmAutomationActions.sendMarketingMessage — workflow tenant (LOT E : toujours refusé)', () => {
  // Les règles d'automatisation sont tenant : y exécuter du marketing
  // consommerait le consentement d'Altitude Vision pour une organisation.
  const seedRule = async ({ tenantId, templateFamily }) => CrmAutomationRule.create({
    tenant: tenantId, ruleId: `test-marketing-${templateFamily}`, label: 'Test', triggerEvent: 'quote_received',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily, channel: 'notification' } }],
  });

  test('un workflow marketing sans modèle actif échoue fermé, sans journal d\'envoi', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenantId = new mongoose.Types.ObjectId();
    const customer = await makeCustomerForUser(admin, ['prospect']);
    await CrmCustomer.updateOne({ _id: customer._id }, { tenant: tenantId });
    await seedRule({ tenantId, templateFamily: 'famille_inexistante' });
    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, metadata: {}, platformTenantId: tenantId });
    expect(results[0]).toMatchObject({ status: 'error', error: expect.stringMatching(/CRM_MARKETING_ACTION_FORBIDDEN/) });
    expect(await MarketingSend.countDocuments()).toBe(0);
  });

  test('un workflow marketing avec modèle actif et destinataire consentant n\'envoie rien, même déclenché par un opérateur habilité', async () => {
    const operator = await makeMarketingOperator();
    const target = await makeUser();
    const tenantId = new mongoose.Types.ObjectId();
    const customer = await makeCustomerForUser(target, ['prospect']);
    await CrmCustomer.updateOne({ _id: customer._id }, { tenant: tenantId });
    await grantConsent(target, { push: true });
    const family = `workflow-${Date.now()}`;
    await MarketingTemplate.create({ tenant: tenantId, family, name: 'Historique tenant', channel: 'notification', body: 'Promo', status: 'active', version: 1 });
    await seedRule({ tenantId, templateFamily: family });

    const results = await handleEvent({ type: 'quote_received', recipient: target._id, sender: operator._id, metadata: {}, platformTenantId: tenantId });
    expect(results[0]).toMatchObject({ status: 'error', error: expect.stringMatching(/CRM_MARKETING_ACTION_FORBIDDEN/) });
    expect(await MarketingSend.countDocuments()).toBe(0);
    expect(await require('../models/Notification').countDocuments({ type: 'marketing_message' })).toBe(0);
  });
});

describe('reporting/domains/marketingReport — Phase 7 (aucun recalcul de Communication)', () => {
  test('getMarketingReport renvoie les KPIs d\'envoi et embarque le domaine communication existant', async () => {
    const actor = await makeMarketingOperator();
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    await grantConsent(target);
    const template = await makeActiveTemplate(actor);
    const campaign = await createCampaign({ name: 'Reporting', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    await approveCampaign(campaign._id, { actor });
    await sendCampaign(campaign._id, { actor });

    const report = await getMarketingReport({});
    expect(report.domain).toBe('marketing');
    expect(report.kpis.campagnesEnvoyees).toBeGreaterThanOrEqual(1);
    expect(report.kpis.envois).toBeGreaterThanOrEqual(1);
    expect(report.communication).toBeDefined();
    expect(report.communication.domain).toBe('communication');
  });

  test('le ROI n\'est jamais fabriqué : null sans costMinor, un objet honnête avec costMinor', async () => {
    const actor = await makeMarketingOperator();
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    const template = await makeActiveTemplate(actor);

    const noCost = await createCampaign({ name: 'Sans coût', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    await approveCampaign(noCost._id, { actor });
    await sendCampaign(noCost._id, { actor });

    const withCost = await createCampaign({ name: 'Avec coût', channel: 'email', templateId: template._id, segmentKey: 'clients', costMinor: 50000, actor });
    await approveCampaign(withCost._id, { actor });
    await sendCampaign(withCost._id, { actor });

    const report = await getMarketingReport({});
    const noCostEntry = report.campagnesRecentes.find((c) => c.name === 'Sans coût');
    const withCostEntry = report.campagnesRecentes.find((c) => c.name === 'Avec coût');
    expect(noCostEntry.roi).toBeNull();
    expect(withCostEntry.roi).toEqual(expect.objectContaining({ costMinor: 50000 }));
  });
});

describe('HTTP /api/marketing — autorité plateforme exclusive (LOT E)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/marketing/segments');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle staff sans PlatformOperator (Secretaire)', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const res = await request(app).get('/api/marketing/segments').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(res.status).toBe(403);
  });

  test('un CommunityManager membre d\'un tenant ne peut ni lister ni créer de modèle (ancien comportement 200 retiré)', async () => {
    const cm = await makeUser({ role: 'CommunityManager' });
    const tenant = await attachTenant(cm);
    const token = `Bearer ${signToken(cm._id)}`;
    const segRes = await request(app).get('/api/marketing/segments').set('Authorization', token).set('X-Platform-Tenant-Id', String(tenant._id));
    expect(segRes.status).toBe(403);
    const createRes = await request(app).post('/api/marketing/templates').set('Authorization', token).set('X-Platform-Tenant-Id', String(tenant._id))
      .send({ family: `http-${Date.now()}`, name: 'HTTP', channel: 'email', body: 'Bonjour' });
    expect(createRes.status).toBe(403);
    expect(await MarketingTemplate.countDocuments()).toBe(0);
  });

  test('un Collaborateur tenant n\'a aucun accès marketing, même en lecture', async () => {
    const collab = await makeUser({ role: 'Collaborateur' });
    const tenant = await attachTenant(collab);
    const token = `Bearer ${signToken(collab._id)}`;
    const list = await request(app).get('/api/marketing/campaigns').set('Authorization', token).set('X-Platform-Tenant-Id', String(tenant._id));
    expect(list.status).toBe(403);
    const create = await request(app).post('/api/marketing/campaigns').set('Authorization', token).send({ name: 'X', channel: 'email', templateId: '000000000000000000000000', segmentKey: 'clients' });
    expect(create.status).toBe(403);
  });

  test('cycle HTTP complet en contexte PLATFORM : modèle → campagne → approbation → envoi', async () => {
    const operator = await makeMarketingOperator();
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    await grantConsent(target);
    const auth = (req) => req.set('Authorization', `Bearer ${signToken(operator._id)}`);

    const tplRes = await auth(request(app).post('/api/marketing/templates')).send({ family: `http-${Date.now()}`, name: 'HTTP', channel: 'email', subject: 'Offre', body: 'Bonjour {{prenom}}' });
    expect(tplRes.status).toBe(201);
    const activateRes = await auth(request(app).patch(`/api/marketing/templates/${tplRes.body.data.template._id}/activate`));
    expect(activateRes.status).toBe(200);

    const createRes = await auth(request(app).post('/api/marketing/campaigns'))
      .send({ name: 'HTTP campagne', channel: 'email', templateId: tplRes.body.data.template._id, segmentKey: 'clients' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.campaign.tenant).toBeNull();
    const campaignId = createRes.body.data.campaign._id;

    const approveRes = await auth(request(app).patch(`/api/marketing/campaigns/${campaignId}/approve`));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.campaign.status).toBe('approved');

    const sendRes = await auth(request(app).post(`/api/marketing/campaigns/${campaignId}/send`));
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.campaign.status).toBe('sent');
    expect(sendRes.body.data.campaign.stats.sentCount).toBe(1);

    const sendsRes = await auth(request(app).get('/api/marketing/sends')).query({ campaignId });
    expect(sendsRes.status).toBe(200);
    expect(sendsRes.body.data.sends.length).toBeGreaterThanOrEqual(1);
  });
});
