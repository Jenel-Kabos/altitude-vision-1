// MARKETING-AUTOMATION-1 — Segments dynamiques, modèles versionnés, moteur
// de campagnes (approbation humaine obligatoire), workflow marketing exécuté
// par crmAutomationEngine (aucun second moteur), domaine Reporting
// 'marketing', et administration HTTP /api/marketing.
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSend = require('../models/MarketingSend');
const MarketingUnsubscribe = require('../models/MarketingUnsubscribe');
const zohoMailService = require('../services/zohoMailService');
const { listSegments, resolveSegment } = require('../services/marketingSegmentService');
const { createTemplateVersion, activateTemplate, renderTemplate } = require('../services/marketingTemplateService');
const { createCampaign, approveCampaign, cancelCampaign, sendCampaign, CampaignError } = require('../services/marketingCampaignService');
const { handleEvent } = require('../services/crmAutomationEngine');
const { getMarketingReport } = require('../services/reporting/domains/marketingReport');
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

const makeCustomerForUser = (user, relations = ['prospect']) => CrmCustomer.create({
  displayName: user.name, emails: [user.email], identityKeys: [`user:${user._id}`, `email:${user.email}`],
  relations, sourceRefs: [{ entityType: 'User', entityId: user._id, source: 'auth' }],
});

const makeActiveTemplate = async (overrides = {}) => {
  const template = await createTemplateVersion({
    family: overrides.family || `famille-${Date.now()}-${Math.random()}`,
    name: 'Bienvenue', channel: 'email', subject: 'Bonjour {{prenom}}', body: 'Bienvenue {{prenom}} {{nom}} !',
    ...overrides,
  });
  return activateTemplate(template._id, {});
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
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
    const family = `fam-${Date.now()}`;
    const v1 = await createTemplateVersion({ family, name: 'V1', channel: 'email', body: 'Bonjour' });
    expect(v1.version).toBe(1);
    expect(v1.status).toBe('draft');
    await activateTemplate(v1._id, {});

    const v2 = await createTemplateVersion({ family, name: 'V2', channel: 'email', body: 'Bonjour v2' });
    expect(v2.version).toBe(2);
    expect(v2.previousVersion.toString()).toBe(v1._id.toString());
    await activateTemplate(v2._id, {});

    const refreshedV1 = await MarketingTemplate.findById(v1._id).lean();
    expect(refreshedV1.status).toBe('archived');
    const refreshedV2 = await MarketingTemplate.findById(v2._id).lean();
    expect(refreshedV2.status).toBe('active');
  });

  test('renderTemplate substitue les variables connues et laisse les inconnues intactes', () => {
    const rendered = renderTemplate({ subject: 'Bonjour {{prenom}}', body: '{{prenom}} — {{inconnu}}' }, { prenom: 'Alice' });
    expect(rendered.subject).toBe('Bonjour Alice');
    expect(rendered.body).toBe('Alice — {{inconnu}}');
  });
});

describe('marketingCampaignService — approbation humaine obligatoire (Phase 4)', () => {
  test('createCampaign refuse un modèle inactif', async () => {
    const draft = await createTemplateVersion({ family: `f-${Date.now()}`, name: 'Draft', channel: 'email', body: 'x' });
    await expect(createCampaign({ name: 'C', channel: 'email', templateId: draft._id, segmentKey: 'clients' })).rejects.toThrow(CampaignError);
  });

  test('createCampaign refuse une incohérence de canal modèle/campagne', async () => {
    const template = await makeActiveTemplate();
    await expect(createCampaign({ name: 'C', channel: 'sms', templateId: template._id, segmentKey: 'clients' })).rejects.toThrow(/canal/i);
  });

  test('sendCampaign refuse strictement tout ce qui n\'est pas approuvé', async () => {
    const template = await makeActiveTemplate();
    const campaign = await createCampaign({ name: 'C', channel: 'email', templateId: template._id, segmentKey: 'clients' });
    await expect(sendCampaign(campaign._id, {})).rejects.toThrow(CampaignError);
    expect(await MarketingSend.countDocuments()).toBe(0);
  });

  test('cycle complet : brouillon → approuvée → envoyée, avec journal MarketingSend et stats', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    const template = await makeActiveTemplate();

    const campaign = await createCampaign({ name: 'Campagne clients', channel: 'email', templateId: template._id, segmentKey: 'clients', actor: admin });
    expect(campaign.status).toBe('draft');

    await approveCampaign(campaign._id, { actor: admin });
    const sent = await sendCampaign(campaign._id, { actor: admin });

    expect(sent.status).toBe('sent');
    expect(sent.stats.totalRecipients).toBeGreaterThanOrEqual(1);
    expect(sent.stats.sentCount).toBeGreaterThanOrEqual(1);
    expect(zohoMailService.sendEmail).toHaveBeenCalled();
    expect(await MarketingSend.countDocuments({ campaign: campaign._id })).toBe(sent.stats.totalRecipients);
  });

  test('un destinataire désabonné est bloqué et journalisé, jamais envoyé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    await MarketingUnsubscribe.create({ email: target.email });
    const template = await makeActiveTemplate();

    const campaign = await createCampaign({ name: 'Campagne désabonnés', channel: 'email', templateId: template._id, segmentKey: 'clients', actor: admin });
    await approveCampaign(campaign._id, { actor: admin });
    const sent = await sendCampaign(campaign._id, { actor: admin });

    const blocked = await MarketingSend.findOne({ campaign: campaign._id, recipientEmail: target.email });
    expect(blocked.status).toBe('unsubscribed');
    expect(sent.stats.sentCount).toBe(0);
  });

  test('cancelCampaign fonctionne depuis draft ou approved, jamais depuis sent', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const template = await makeActiveTemplate();
    const campaign = await createCampaign({ name: 'À annuler', channel: 'email', templateId: template._id, segmentKey: 'clients', actor: admin });
    const cancelled = await cancelCampaign(campaign._id, { actor: admin, reason: 'test' });
    expect(cancelled.status).toBe('cancelled');
    await expect(cancelCampaign(campaign._id, { actor: admin })).rejects.toThrow(CampaignError);
  });
});

describe('crmAutomationActions.sendMarketingMessage — workflow (Phase 5, aucun second moteur)', () => {
  test('un workflow marketing sans modèle actif est "skipped", jamais une erreur', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin, ['prospect']);
    await CrmAutomationRule.create({
      ruleId: 'test-marketing-no-template', label: 'Test', triggerEvent: 'quote_received',
      actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'famille_inexistante', channel: 'email' } }],
    });
    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, metadata: {} });
    expect(results[0].status).toBe('success'); // la règle "réussit" ; l'action interne est skipped
  });

  test('un workflow marketing avec modèle actif envoie et journalise un MarketingSend', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin, ['prospect']);
    const family = `workflow-${Date.now()}`;
    await makeActiveTemplate({ family, channel: 'notification' });
    await CrmAutomationRule.create({
      ruleId: 'test-marketing-workflow', label: 'Test', triggerEvent: 'quote_received',
      actions: [{ actionId: 'marketing.message.send', params: { templateFamily: family, channel: 'notification' } }],
    });

    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, metadata: {} });
    expect(results[0].status).toBe('success');
    expect(await MarketingSend.countDocuments({ workflowRuleId: 'quote_received' })).toBe(1);
  });
});

describe('reporting/domains/marketingReport — Phase 7 (aucun recalcul de Communication)', () => {
  test('getMarketingReport renvoie les KPIs d\'envoi et embarque le domaine communication existant', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    const template = await makeActiveTemplate();
    const campaign = await createCampaign({ name: 'Reporting', channel: 'email', templateId: template._id, segmentKey: 'clients', actor: admin });
    await approveCampaign(campaign._id, { actor: admin });
    await sendCampaign(campaign._id, { actor: admin });

    const report = await getMarketingReport({});
    expect(report.domain).toBe('marketing');
    expect(report.kpis.campagnesEnvoyees).toBeGreaterThanOrEqual(1);
    expect(report.kpis.envois).toBeGreaterThanOrEqual(1);
    expect(report.communication).toBeDefined();
    expect(report.communication.domain).toBe('communication');
  });

  test('le ROI n\'est jamais fabriqué : null sans costMinor, un objet honnête avec costMinor', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    const template = await makeActiveTemplate();

    const noCost = await createCampaign({ name: 'Sans coût', channel: 'email', templateId: template._id, segmentKey: 'clients', actor: admin });
    await approveCampaign(noCost._id, { actor: admin });
    await sendCampaign(noCost._id, { actor: admin });

    const withCost = await createCampaign({ name: 'Avec coût', channel: 'email', templateId: template._id, segmentKey: 'clients', costMinor: 50000, actor: admin });
    await approveCampaign(withCost._id, { actor: admin });
    await sendCampaign(withCost._id, { actor: admin });

    const report = await getMarketingReport({});
    const noCostEntry = report.campagnesRecentes.find((c) => c.name === 'Sans coût');
    const withCostEntry = report.campagnesRecentes.find((c) => c.name === 'Avec coût');
    expect(noCostEntry.roi).toBeNull();
    expect(withCostEntry.roi).toEqual(expect.objectContaining({ costMinor: 50000 }));
  });
});

describe('HTTP /api/marketing — RBAC (Phase 8)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/marketing/segments');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle staff hors périmètre Altcom (Secretaire)', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const res = await request(app).get('/api/marketing/segments').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(res.status).toBe(403);
  });

  test('un CommunityManager peut lister les segments et créer un modèle actif', async () => {
    const cm = await makeUser({ role: 'CommunityManager' });
    const token = `Bearer ${signToken(cm._id)}`;
    const segRes = await request(app).get('/api/marketing/segments').set('Authorization', token);
    expect(segRes.status).toBe(200);
    expect(segRes.body.data.segments.length).toBe(14);

    const createRes = await request(app).post('/api/marketing/templates').set('Authorization', token)
      .send({ family: `http-${Date.now()}`, name: 'HTTP', channel: 'email', body: 'Bonjour' });
    expect(createRes.status).toBe(201);
    const activateRes = await request(app).patch(`/api/marketing/templates/${createRes.body.data.template._id}/activate`).set('Authorization', token);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.template.status).toBe('active');
  });

  test('un Collaborateur (lecture Altcom) ne peut pas créer de campagne', async () => {
    const collab = await makeUser({ role: 'Collaborateur' });
    const token = `Bearer ${signToken(collab._id)}`;
    const list = await request(app).get('/api/marketing/campaigns').set('Authorization', token);
    expect(list.status).toBe(200);
    const create = await request(app).post('/api/marketing/campaigns').set('Authorization', token).send({ name: 'X', channel: 'email', templateId: '000000000000000000000000', segmentKey: 'clients' });
    expect(create.status).toBe(403);
  });

  test('cycle HTTP complet campagne : créer → approuver → envoyer', async () => {
    const cm = await makeUser({ role: 'CommunityManager' });
    const target = await makeUser();
    await makeCustomerForUser(target, ['client_hotel']);
    const template = await makeActiveTemplate();
    const token = `Bearer ${signToken(cm._id)}`;

    const createRes = await request(app).post('/api/marketing/campaigns').set('Authorization', token)
      .send({ name: 'HTTP campagne', channel: 'email', templateId: template._id, segmentKey: 'clients' });
    expect(createRes.status).toBe(201);
    const campaignId = createRes.body.data.campaign._id;

    const approveRes = await request(app).patch(`/api/marketing/campaigns/${campaignId}/approve`).set('Authorization', token);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.campaign.status).toBe('approved');

    const sendRes = await request(app).post(`/api/marketing/campaigns/${campaignId}/send`).set('Authorization', token);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.campaign.status).toBe('sent');

    const sendsRes = await request(app).get('/api/marketing/sends').set('Authorization', token).query({ campaignId });
    expect(sendsRes.status).toBe(200);
    expect(sendsRes.body.data.sends.length).toBeGreaterThanOrEqual(1);
  });
});
