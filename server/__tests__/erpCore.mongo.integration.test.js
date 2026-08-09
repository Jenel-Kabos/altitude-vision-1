// ERP-CORE-1 — Centre d'Administration Global. Vérifie que la couche
// d'orchestration ne recalcule aucun KPI (elle lit erpService, lui-même une
// relecture de reportingService/organizationService/crmCockpitService),
// que le moteur d'alertes ne se déclenche que sur des seuils réels, et que
// le filtre organisationnel additif d'ActionLog isole correctement les
// journaux par unité.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const Property = require('../models/Property');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const ApiCallLog = require('../models/ApiCallLog');
const WebhookSubscription = require('../models/WebhookSubscription');
const ActionLog = require('../models/ActionLog');
const { logAction, buildAuteur } = require('../services/actionLogService');
const organizationService = require('../services/organizationService');
const { evaluateAlerts } = require('../services/erp/erpAlertsService');
const erpService = require('../services/erp/erpService');
const erpRoutes = require('../routes/erpRoutes');
const actionLogRoutes = require('../routes/actionLogRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/erp', erpRoutes);
app.use('/api/action-logs', actionLogRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `erpcore${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('erpAlertsService — seuils sur données réelles uniquement (Phase 4)', () => {
  test('aucune alerte sur une base vide', async () => {
    const alerts = await evaluateAlerts({ domains: {}, growth: null });
    expect(alerts).toEqual([]);
  });

  test('pipeline_bloque se déclenche à partir de crmCockpit.opportunitesBloquees', async () => {
    const alerts = await evaluateAlerts({
      domains: { crm: { status: 'ok', data: { cockpit: { opportunitesBloquees: [{ _id: 'x' }] } } } },
      growth: null,
    });
    expect(alerts.find((a) => a.key === 'pipeline_bloque')).toBeDefined();
  });

  test('occupation_faible se déclenche sous le seuil, jamais au-dessus', async () => {
    const low = await evaluateAlerts({ domains: { hotel: { status: 'ok', data: { kpis: { occupancyRate: 10 } } } }, growth: null });
    expect(low.find((a) => a.key === 'occupation_faible')).toBeDefined();
    const high = await evaluateAlerts({ domains: { hotel: { status: 'ok', data: { kpis: { occupancyRate: 90 } } } }, growth: null });
    expect(high.find((a) => a.key === 'occupation_faible')).toBeUndefined();
  });

  test('impayes reflète exactement location.kpis.unpaidRent (jamais recalculé)', async () => {
    const alerts = await evaluateAlerts({ domains: { location: { status: 'ok', data: { kpis: { unpaidRent: 750000 } } } }, growth: null });
    const alert = alerts.find((a) => a.key === 'impayes');
    expect(alert.count).toBe(750000);
    expect(alert.severity).toBe('critical'); // > 500000
  });

  test('maintenance_critique compte réellement les tickets priorité urgente ouverts (RentalMaintenanceTicket)', async () => {
    const owner = await makeUser({ role: 'Admin' });
    const property = await Property.create({
      title: 'Villa Test ERP', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
    });
    await RentalMaintenanceTicket.create({
      property: property._id, description: 'Fuite majeure', category: 'plomberie', priority: 'urgente', status: 'ouvert', owner: owner._id,
    });
    await RentalMaintenanceTicket.create({
      property: property._id, description: 'Ampoule', category: 'electricite', priority: 'basse', status: 'ouvert', owner: owner._id,
    });
    const alerts = await evaluateAlerts({ domains: {}, growth: null });
    const alert = alerts.find((a) => a.key === 'maintenance_critique');
    expect(alert).toBeDefined();
    expect(alert.count).toBe(1); // seul le ticket 'urgente' compte, jamais 'basse'
  });

  test('api_degradee et webhooks_en_echec se déclenchent sur des champs réellement stockés', async () => {
    const { apiKey } = await require('../services/publicApi/apiKeyService').createApiKey({ name: 'Test', scopes: ['properties:read'], actor: { _id: new mongoose.Types.ObjectId() } });
    await ApiCallLog.create([
      { apiKey: apiKey._id, method: 'GET', path: '/x', statusCode: 500, durationMs: 5 },
      { apiKey: apiKey._id, method: 'GET', path: '/x', statusCode: 500, durationMs: 5 },
      { apiKey: apiKey._id, method: 'GET', path: '/x', statusCode: 200, durationMs: 5 },
    ]);
    await WebhookSubscription.create({ apiKey: apiKey._id, url: 'https://example.com/hook', secret: 'x', events: ['bien_valide'], failureCount: 5, status: 'active' });

    const alerts = await evaluateAlerts({ domains: {}, growth: null });
    expect(alerts.find((a) => a.key === 'api_degradee')).toBeDefined(); // 2/3 = 66% > seuil 10%
    expect(alerts.find((a) => a.key === 'webhooks_en_echec')).toBeDefined();
  });

  test('croissance_anormale ne se déclenche que sur une variation réellement calculée (jamais division par zéro déguisée)', async () => {
    const withPrevious = await evaluateAlerts({ domains: {}, growth: { newUsersThisMonth: 100, newUsersPreviousMonth: 10, newUsersGrowthPercent: 900 } });
    expect(withPrevious.find((a) => a.key === 'croissance_anormale')).toBeDefined();
    const noPrevious = await evaluateAlerts({ domains: {}, growth: { newUsersThisMonth: 5, newUsersPreviousMonth: 0, newUsersGrowthPercent: null } });
    expect(noPrevious.find((a) => a.key === 'croissance_anormale')).toBeUndefined();
  });

  test('les alertes sont triées par sévérité (critical avant warning avant info)', async () => {
    const alerts = await evaluateAlerts({
      domains: {
        crm: { status: 'ok', data: { cockpit: { opportunitesBloquees: [{ _id: 'x' }] } } }, // warning
        location: { status: 'ok', data: { kpis: { unpaidRent: 900000 } } }, // critical
        finance: { status: 'ok', data: { note: 'note' } }, // info
      },
      growth: null,
    });
    const severities = alerts.map((a) => a.severity);
    expect(severities.indexOf('critical')).toBeLessThan(severities.indexOf('warning'));
    expect(severities.indexOf('warning')).toBeLessThan(severities.indexOf('info'));
  });
});

describe('erpService — orchestration pure (Phase 3, 5, 6)', () => {
  test('computeGrowth compte réellement les nouveaux comptes sur deux fenêtres de 30 jours', async () => {
    await makeUser();
    await makeUser();
    const growth = await erpService.computeGrowth();
    expect(growth.newUsersThisMonth).toBeGreaterThanOrEqual(2);
    expect(growth.newUsersPreviousMonth).toBe(0);
    expect(growth.newUsersGrowthPercent).toBeNull(); // période précédente vide : jamais une division par zéro déguisée
  });

  test('getOrganizationSummary reflète les vraies unités créées via organizationService', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await organizationService.createOrgUnit({ name: 'Altitude Vision', type: 'organization', actor: admin });
    const summary = await erpService.getOrganizationSummary();
    expect(summary.totalUnits).toBeGreaterThanOrEqual(1);
    expect(summary.byType.organization).toBeGreaterThanOrEqual(1);
  });

  test('getDecisionCenter relit crmCockpitService sans dupliquer sa logique', async () => {
    const client = await makeUser();
    await CrmCustomer.create({
      displayName: client.name, emails: [client.email], identityKeys: [`user:${client._id}`],
      relations: ['prospect'], sourceRefs: [{ entityType: 'User', entityId: client._id, source: 'auth' }],
    });
    const decisions = await erpService.getDecisionCenter({});
    expect(decisions).toHaveProperty('actionsPrioritaires');
    expect(decisions).toHaveProperty('risques');
    expect(decisions).toHaveProperty('pointsBloquants');
    expect(decisions).toHaveProperty('opportunites');
    expect(decisions).toHaveProperty('echeances');
  });

  test('getPlatformHealth expose exactement 8 modules avec état/version/tests/synchronisation/alertes', async () => {
    const health = await erpService.getPlatformHealth({});
    expect(health.modules).toHaveLength(8);
    const keys = health.modules.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['crm', 'marketing', 'finance', 'organisation', 'api', 'notifications', 'audit', 'mobile']));
    health.modules.forEach((m) => {
      expect(m).toHaveProperty('etat');
      expect(m).toHaveProperty('version');
      expect(m).toHaveProperty('tests');
      expect(m).toHaveProperty('derniereSynchronisation');
      expect(m).toHaveProperty('alertes');
    });
    const mobile = health.modules.find((m) => m.key === 'mobile');
    expect(mobile.etat).toBe('non_mesure'); // jamais une métrique mobile inventée
  });

  test('getExecutiveOverview combine reportingService, croissance et organisation sans re-agréger le CRM', async () => {
    const overview = await erpService.getExecutiveOverview({});
    expect(overview).toHaveProperty('domains');
    expect(overview).toHaveProperty('growth');
    expect(overview).toHaveProperty('organisation');
    expect(overview).toHaveProperty('alerts');
    expect(overview.domains.marketing).toBeDefined(); // domaine additif MARKETING-AUTOMATION-1, réutilisé tel quel
  });
});

describe('HTTP /api/erp — réservé Direction (Admin)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/erp/executive');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle non-Admin', async () => {
    const collab = await makeUser({ role: 'Collaborateur' });
    const res = await request(app).get('/api/erp/executive').set('Authorization', `Bearer ${signToken(collab._id)}`);
    expect(res.status).toBe(403);
  });

  test('un Admin obtient les 4 endpoints', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;
    const executive = await request(app).get('/api/erp/executive').set('Authorization', token);
    expect(executive.status).toBe(200);
    expect(executive.body.data.overview).toHaveProperty('alerts');

    const alerts = await request(app).get('/api/erp/alerts').set('Authorization', token);
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.data.alerts)).toBe(true);

    const decisions = await request(app).get('/api/erp/decisions').set('Authorization', token);
    expect(decisions.status).toBe(200);
    expect(decisions.body.data.decisions).toHaveProperty('risques');

    const health = await request(app).get('/api/erp/health').set('Authorization', token);
    expect(health.status).toBe(200);
    expect(health.body.data.health.modules).toHaveLength(8);
  });
});

describe('HTTP /api/action-logs — filtre organisationnel additif (Phase 7)', () => {
  test('orgUnitId isole les journaux aux seuls membres actifs de cette unité', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const insider = await makeUser({ role: 'Collaborateur' });
    const outsider = await makeUser({ role: 'Collaborateur' });

    const orgUnit = await organizationService.createOrgUnit({ name: 'Pôle Test', type: 'organization', actor: admin });
    await organizationService.grantMembership({ userId: insider._id, orgUnitId: orgUnit._id, actor: admin });

    await logAction({ action: 'test.insider', description: 'Action insider', module: 'Dashboard', typeAction: 'MODIFICATION', auteur: buildAuteur(insider) });
    await logAction({ action: 'test.outsider', description: 'Action outsider', module: 'Dashboard', typeAction: 'MODIFICATION', auteur: buildAuteur(outsider) });

    const token = `Bearer ${signToken(admin._id)}`;
    const res = await request(app).get('/api/action-logs').query({ orgUnitId: String(orgUnit._id) }).set('Authorization', token);
    expect(res.status).toBe(200);
    const actions = res.body.data.logs.map((l) => l.action);
    expect(actions).toContain('test.insider');
    expect(actions).not.toContain('test.outsider');
  });

  test('un orgUnitId sans membre ne renvoie jamais tout silencieusement', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const someone = await makeUser({ role: 'Collaborateur' });
    await logAction({ action: 'test.anyone', description: 'x', module: 'Dashboard', typeAction: 'MODIFICATION', auteur: buildAuteur(someone) });

    const emptyOrgUnit = await organizationService.createOrgUnit({ name: 'Pôle Vide', type: 'organization', actor: admin });
    const token = `Bearer ${signToken(admin._id)}`;
    const res = await request(app).get('/api/action-logs').query({ orgUnitId: String(emptyOrgUnit._id) }).set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(0);
    expect(await ActionLog.countDocuments()).toBeGreaterThanOrEqual(1); // la donnée existe bien, juste hors scope
  });
});
