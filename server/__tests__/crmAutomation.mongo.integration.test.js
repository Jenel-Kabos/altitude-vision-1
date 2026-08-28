// CRM-AUTOMATION-1 — moteur d'automatisation, actions, score dérivé,
// cockpit et administration. Vérifie en particulier que le moteur
// n'intervient QUE via le hook notify() déjà en place (aucune modification
// des domaines GL/Hôtel/Accommodation eux-mêmes n'était nécessaire).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const CrmActivity = require('../models/CrmActivity');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const CrmAutomationRun = require('../models/CrmAutomationRun');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const { notify } = require('../services/notificationService');
const { handleEvent: handleTenantEvent, initializeCrmAutomation } = require('../services/crmAutomationEngine');
const { computeCustomerScore } = require('../services/crmScoreService');
const { getCockpit } = require('../services/crmCockpitService');
const { createOpportunity, moveOpportunity, setOpportunityOutcome } = require('../services/crmService');
const { seed, RULES } = require('../scripts/seedCrmAutomationRules');
const crmAutomationRoutes = require('../routes/crmAutomationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/crm-automation', crmAutomationRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
let currentTenant;
const handleEvent = (event, options) => handleTenantEvent({ ...event, platformTenantId: currentTenant._id }, options);
const makeUser = async (overrides = {}) => {
  counter += 1;
  const created = await User.create({ name: 'Test User', email: `crmauto${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
  await OrgMembership.create({ user: created._id, orgUnit: currentTenant.rootOrgUnit, status: 'active' });
  return created;
};

const makeCustomerForUser = (user, relations = ['prospect']) => CrmCustomer.create({
  tenant: currentTenant._id,
  displayName: user.name, emails: [user.email], identityKeys: [`user:${user._id}`, `email:${user.email}`],
  relations, sourceRefs: [{ entityType: 'User', entityId: user._id, source: 'auth' }],
});

let stopObservingNotifications;
beforeAll(async () => {
  stopObservingNotifications = initializeCrmAutomation();
  await startFinancialMongo();
});
beforeEach(async () => {
  const root = await OrgUnit.create({ name: `CRM Automation ${Date.now()} ${counter}`, type: 'organization', status: 'active' });
  currentTenant = await PlatformTenant.create({ name: root.name, slug: `crm-auto-${Date.now()}-${counter++}`, rootOrgUnit: root._id, status: 'active' });
  CrmAutomationRule.schema.path('tenant').default(() => currentTenant._id);
});
afterEach(clearFinancialMongo);
afterAll(async () => {
  stopObservingNotifications();
  await stopFinancialMongo();
});

describe('crmAutomationEngine — moteur générique', () => {
  test('une règle désactivée ne produit aucune action', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const client = await makeUser();
    await makeCustomerForUser(client);
    await CrmAutomationRule.create({ ruleId: 'test-disabled', label: 'Test', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.activity.create', params: { title: 'X' } }], enabled: false });

    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, entityType: null, entityId: null, metadata: {} });
    expect(results).toEqual([]);
    expect(await CrmActivity.countDocuments()).toBe(0);
  });

  test('une règle active crée les actions déclarées et journalise une exécution réussie', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin, ['prospect']);
    await CrmAutomationRule.create({ ruleId: 'test-active', label: 'Test', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create', params: { title: 'Premier contact' } }] });

    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, entityType: null, entityId: null, metadata: {} });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
    const activity = await CrmActivity.findOne({ type: 'tache' });
    expect(activity.title).toBe('Premier contact');
    const run = await CrmAutomationRun.findOne({ ruleId: 'test-active' });
    expect(run.status).toBe('success');
  });

  test('les conditions filtrent correctement (eq)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-cond', label: 'Test', triggerEvent: 'quote_received', conditions: [{ field: 'audience', op: 'eq', value: 'staff' }], actions: [{ actionId: 'crm.task.create', params: { title: 'X' } }] });

    const noMatch = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, audience: 'user', metadata: {} });
    expect(noMatch[0].status).toBe('skipped');
    const match = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, audience: 'staff', metadata: {} });
    expect(match[0].status).toBe('success');
  });

  test('rule.delayMinutes fixe automatiquement le dueInMinutes des actions rappel', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-delay', label: 'Test', triggerEvent: 'quote_response', delayMinutes: 4320, actions: [{ actionId: 'crm.reminder.create', params: { title: 'Relancer' } }] });

    const before = Date.now();
    await handleEvent({ type: 'quote_response', recipient: admin._id, sender: admin._id, metadata: {} });
    const activity = await CrmActivity.findOne({ type: 'rappel' });
    expect(activity.dueAt.getTime()).toBeGreaterThan(before + 4320 * 60000 - 5000);
  });

  test('la simulation ne crée aucune donnée réelle mais journalise "simulated"', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-sim', label: 'Test', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create', params: { title: 'X' } }] });

    const results = await handleEvent({ type: 'quote_received', recipient: admin._id, sender: admin._id, metadata: {} }, { simulate: true });
    expect(results[0].status).toBe('simulated');
    expect(await CrmActivity.countDocuments()).toBe(0);
    expect(await CrmAutomationRun.countDocuments({ status: 'simulated' })).toBe(1);
  });

  test('le hook notify() déclenche réellement le moteur, sans modifier le domaine producteur', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-hook', label: 'Test', triggerEvent: 'rental_notice_started', actions: [{ actionId: 'crm.task.create', params: { title: 'Traiter le préavis' } }] });

    // Simule exactement ce qu'un domaine GL ferait — un simple appel à
    // notify(), déjà existant, sans aucune connaissance du moteur CRM.
    await notify({ recipient: admin._id, sender: admin._id, type: 'rental_notice_started', title: 'Préavis démarré', body: 'Test', audience: 'staff', platformTenantId: currentTenant._id });
    // Le hook est fire-and-forget (Promise.resolve().then(...)) — laisser le
    // microtask/event loop s'exécuter avant d'assertionner.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const activity = await CrmActivity.findOne({ title: 'Traiter le préavis' });
    expect(activity).not.toBeNull();
  });
});

describe('crmService — instrumentation opportunité (Phase 1, gap comblé)', () => {
  test('createOpportunity/moveOpportunity/setOpportunityOutcome émettent désormais des notifications observables', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const customer = await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-opp-won', label: 'Test', triggerEvent: 'crm_opportunity_won', actions: [{ actionId: 'crm.activity.create', params: { title: 'Opportunité gagnée détectée' } }] });

    const scope = { tenantId: currentTenant._id };
    const opp = await createOpportunity(customer._id, { title: 'Mandat', pole: 'Altimmo', assignedTo: admin._id }, admin._id, scope);
    await moveOpportunity(opp._id, { stage: 'negociation' }, admin._id, scope);
    await setOpportunityOutcome(opp._id, { outcome: 'won' }, admin._id, scope);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const Notification = require('../models/Notification');
    expect(await Notification.countDocuments({ type: 'crm_opportunity_created' })).toBe(1);
    expect(await Notification.countDocuments({ type: 'crm_opportunity_stage_changed' })).toBe(1);
    expect(await Notification.countDocuments({ type: 'crm_opportunity_won' })).toBe(1);
    expect(await CrmActivity.findOne({ title: 'Opportunité gagnée détectée' })).not.toBeNull();
  });

  test('crm.opportunity.close_won ne fabrique jamais une opportunité si aucune n\'est ouverte', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'test-contrat-signe', label: 'Test', triggerEvent: 'contrat_new', actions: [{ actionId: 'crm.opportunity.close_won' }] });

    const results = await handleEvent({ type: 'contrat_new', recipient: admin._id, sender: admin._id, metadata: {} });
    expect(results[0].status).toBe('success'); // la règle "réussit" (aucune erreur), mais l'action interne est un no-op
    const run = await CrmAutomationRun.findOne({ ruleId: 'test-contrat-signe' });
    expect(run.actionsRun[0]).toContain('skipped');
    expect(await CrmOpportunity.countDocuments()).toBe(0);
  });
});

describe('crmScoreService — score dérivé (Phase 5)', () => {
  test('le score est calculé à la volée et jamais stocké sur CrmCustomer', async () => {
    const client = await makeUser();
    const customer = await makeCustomerForUser(client);
    await CrmActivity.create({ customer: customer._id, type: 'note', title: 'Note', createdBy: client._id, assignedTo: client._id });

    const score = await computeCustomerScore(customer._id);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.breakdown).toBeDefined();

    const raw = await CrmCustomer.findById(customer._id).lean();
    expect(raw.score).toBeUndefined(); // jamais persisté
  });
});

describe('crmCockpitService — Phase 6 (données réelles uniquement)', () => {
  test('getCockpit() renvoie toutes les sections sans lever d\'erreur sur une base vide', async () => {
    const cockpit = await getCockpit();
    expect(cockpit).toHaveProperty('actionsPrioritaires');
    expect(cockpit).toHaveProperty('clientsSansSuivi');
    expect(cockpit).toHaveProperty('opportunitesBloquees');
    expect(cockpit).toHaveProperty('prospectsInactifs');
    expect(cockpit).toHaveProperty('relancesAujourdhui');
    expect(cockpit).toHaveProperty('documentsManquants');
    expect(cockpit).toHaveProperty('paiementsASuivre');
    expect(cockpit).toHaveProperty('contratsProchesEcheance');
    expect(cockpit).toHaveProperty('visitesSansSuite');
  });

  test('un client jamais suivi apparaît dans clientsSansSuivi', async () => {
    const client = await makeUser();
    await makeCustomerForUser(client);
    const cockpit = await getCockpit();
    expect(cockpit.clientsSansSuivi.length).toBeGreaterThanOrEqual(1);
  });

  test('une opportunité ouverte non modifiée depuis longtemps apparaît dans opportunitesBloquees', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const customer = await makeCustomerForUser(admin);
    const opp = await CrmOpportunity.create({ customer: customer._id, title: 'Ancienne opportunité', pole: 'Altimmo', assignedTo: admin._id, history: [{ to: 'prospect', actor: admin._id }] });
    // { timestamps: false } : sinon le plugin timestamps de Mongoose écrase
    // silencieusement `updatedAt` avec l'heure courante sur tout updateOne.
    await CrmOpportunity.updateOne({ _id: opp._id }, { updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, { timestamps: false });
    const cockpit = await getCockpit();
    expect(cockpit.opportunitesBloquees.some((o) => String(o._id) === String(opp._id))).toBe(true);
  });
});

describe('HTTP /api/crm-automation — administration (Phase 7)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/crm-automation/rules');
    expect(res.status).toBe(401);
  });

  test('un Secretaire peut lister les règles mais pas en créer', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const list = await request(app).get('/api/crm-automation/rules').set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(list.status).toBe(200);
    const create = await request(app).post('/api/crm-automation/rules').set('Authorization', `Bearer ${signToken(secretaire._id)}`).send({ ruleId: 'x', label: 'X', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create' }] });
    expect(create.status).toBe(403);
  });

  test('un Admin peut créer, activer/désactiver puis prioriser une règle', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;
    const createRes = await request(app).post('/api/crm-automation/rules').set('Authorization', token)
      .send({ ruleId: 'http-test', label: 'Test HTTP', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create', params: { title: 'X' } }], priority: 10 });
    expect(createRes.status).toBe(201);
    const ruleDbId = createRes.body.data.rule._id;

    const toggleRes = await request(app).patch(`/api/crm-automation/rules/${ruleDbId}/enabled`).set('Authorization', token).send({ enabled: false });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.rule.enabled).toBe(false);

    const priorityRes = await request(app).patch(`/api/crm-automation/rules/${ruleDbId}`).set('Authorization', token).send({ priority: 5 });
    expect(priorityRes.status).toBe(200);
    expect(priorityRes.body.data.rule.priority).toBe(5);
  });

  test('la simulation HTTP ne crée aucune activité réelle', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await makeCustomerForUser(admin);
    await CrmAutomationRule.create({ ruleId: 'http-sim', label: 'Test', triggerEvent: 'quote_received', actions: [{ actionId: 'crm.task.create', params: { title: 'X' } }] });
    const res = await request(app).post('/api/crm-automation/simulate').set('Authorization', `Bearer ${signToken(admin._id)}`)
      .send({ type: 'quote_received', recipient: admin._id, audience: 'staff' });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].status).toBe('simulated');
    expect(await CrmActivity.countDocuments()).toBe(0);
  });

  test('GET /cockpit et GET /score/:customerId répondent 200', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const customer = await makeCustomerForUser(admin);
    const token = `Bearer ${signToken(admin._id)}`;
    const cockpitRes = await request(app).get('/api/crm-automation/cockpit').set('Authorization', token);
    expect(cockpitRes.status).toBe(200);
    const scoreRes = await request(app).get(`/api/crm-automation/score/${customer._id}`).set('Authorization', token);
    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.data.score.total).toBeDefined();
  });
});

describe('scripts/seedCrmAutomationRules — catalogue initial (Phase 4)', () => {
  test('dry-run ne modifie rien ; --apply crée les 9 règles de façon idempotente', async () => {
    const dryRun = await seed({ apply: false });
    expect(dryRun.wouldCreate).toHaveLength(RULES.length);
    expect(await CrmAutomationRule.countDocuments()).toBe(0);

    const firstApply = await seed({ apply: true });
    expect(firstApply.created).toHaveLength(RULES.length);
    expect(await CrmAutomationRule.countDocuments()).toBe(RULES.length);

    // Idempotence : un second passage ne duplique rien, et une désactivation
    // manuelle entretemps n'est jamais silencieusement réactivée.
    await CrmAutomationRule.updateOne({ ruleId: RULES[0].ruleId }, { enabled: false });
    const secondApply = await seed({ apply: true });
    expect(secondApply.updated).toHaveLength(RULES.length);
    expect(await CrmAutomationRule.countDocuments()).toBe(RULES.length);
    expect((await CrmAutomationRule.findOne({ ruleId: RULES[0].ruleId })).enabled).toBe(false);
  });

  test('chaque triggerEvent du catalogue est une valeur valide de Notification.type', async () => {
    const Notification = require('../models/Notification');
    const validTypes = Notification.schema.path('type').enumValues;
    RULES.forEach((rule) => { expect(validTypes).toContain(rule.triggerEvent); });
  });
});
