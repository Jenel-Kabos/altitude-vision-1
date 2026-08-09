// TENANT-CORE-1 — Racine SaaS (`PlatformTenant`, jamais `Tenant` seul —
// voir audit Phase 1 du rapport de sprint : collision avec le concept
// existant de locataire). Vérifie que le tenant reste une fine enveloppe
// autour d'une racine Organisation (ORGANIZATION-1, aucune duplication),
// que l'isolation transversale (Phase 4) est réellement opt-in et n'altère
// JAMAIS le comportement par défaut (clé API sans tenant = catalogue
// global, exactement comme avant ce sprint), et que Reporting/ERP acceptent
// `tenantId` comme simple alias de `orgUnitId`.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const Accommodation = require('../models/Accommodation');
const PlatformTenantSettings = require('../models/PlatformTenantSettings');
const PlatformTenantTheme = require('../models/PlatformTenantTheme');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const OrgUnit = require('../models/OrgUnit');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { resolveTenantForUser, resolveTenantScope } = require('../services/platformTenant/tenantContextService');
const { getExecutiveReport } = require('../services/reporting/reportingService');
const erpService = require('../services/erp/erpService');
const { createApiKey } = require('../services/publicApi/apiKeyService');
const { listPublicProperties, getPublicPropertyById } = require('../services/publicApi/publicPropertyService');
const { listPublicHotels } = require('../services/publicApi/publicHotelService');
const { getPublicAccommodationById } = require('../services/publicApi/publicAccommodationService');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const publicApiV1Routes = require('../routes/publicApi/v1');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/platform-tenants', platformTenantRoutes);
app.use('/api/public/v1', publicApiV1Routes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `tenantcore${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

const makeProperty = (owner, overrides = {}) => Property.create({
  title: 'Villa Tenant Test', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible', owner: owner._id, ...overrides,
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('platformTenantService — cycle de vie (Phase 2/3)', () => {
  test('createTenant crée le PlatformTenant ET sa racine OrgUnit ensemble, avec settings/theme/abonnement par défaut', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Congo Habitat SARL', actor: admin });

    expect(tenant.status).toBe('trial');
    const rootUnit = await OrgUnit.findById(tenant.rootOrgUnit).lean();
    expect(rootUnit.type).toBe('organization');
    expect(rootUnit.name).toBe('Congo Habitat SARL');

    const settings = await PlatformTenantSettings.findOne({ tenant: tenant._id }).lean();
    expect(settings.currency).toBe('XAF'); // défaut plateforme actuel, jamais un changement silencieux
    const theme = await PlatformTenantTheme.findOne({ tenant: tenant._id }).lean();
    expect(theme.primaryColor).toBe('#C8960C');
    const subscription = await PlatformTenantSubscription.findOne({ tenant: tenant._id }).lean();
    expect(subscription.status).toBe('trialing');
    expect(subscription.plan).toBe('trial');
  });

  test('deux tenants de même nom obtiennent des slugs distincts', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const t1 = await platformTenantService.createTenant({ name: 'Altitude Partenaire', actor: admin });
    const t2 = await platformTenantService.createTenant({ name: 'Altitude Partenaire', actor: admin });
    expect(t1.slug).not.toBe(t2.slug);
  });

  test('cycle suspendre → réactiver → archiver', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Cycle Test', actor: admin });

    const suspended = await platformTenantService.suspendTenant(tenant._id, { actor: admin, reason: 'Impayé' });
    expect(suspended.status).toBe('suspended');
    await expect(platformTenantService.suspendTenant(tenant._id, { actor: admin })).resolves.toBeDefined(); // toujours "not archived"
    const reactivated = await platformTenantService.reactivateTenant(tenant._id, { actor: admin });
    expect(reactivated.status).toBe('active');
    await expect(platformTenantService.reactivateTenant(tenant._id, { actor: admin })).rejects.toThrow(); // déjà active, pas suspendue

    const archived = await platformTenantService.archiveTenant(tenant._id, { actor: admin });
    expect(archived.status).toBe('archived');
    const rootUnit = await OrgUnit.findById(tenant.rootOrgUnit).lean();
    expect(rootUnit.status).toBe('archived'); // best-effort réussi (aucun enfant actif)
  });

  test('modules : setFeature refuse un module inconnu, jamais une seconde taxonomie', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Modules Test', actor: admin });
    await expect(platformTenantService.setFeature(tenant._id, 'module_invente', { actor: admin })).rejects.toThrow(/inconnu/i);
    const feature = await platformTenantService.setFeature(tenant._id, 'marketing', { enabled: false, actor: admin });
    expect(feature.enabled).toBe(false);
    const stored = await PlatformTenantFeature.findOne({ tenant: tenant._id, module: 'marketing' }).lean();
    expect(stored.enabled).toBe(false);
  });

  test('domaines : ajout puis vérification, jamais vérifié automatiquement', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Domaine Test', actor: admin });
    const domain = await platformTenantService.addDomain(tenant._id, { domain: 'congo-habitat.altitudevision.agency', isPrimary: true });
    expect(domain.status).toBe('pending');
    const verified = await platformTenantService.verifyDomain(domain._id, { actor: admin });
    expect(verified.status).toBe('verified');
    expect(verified.verifiedBy.toString()).toBe(String(admin._id));
  });

  test('abonnement : changer de plan clôt le précédent, jamais deux abonnements actifs en parallèle', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Abonnement Test', plan: 'trial', actor: admin });
    const newSub = await platformTenantService.changeSubscription(tenant._id, { plan: 'pro', actor: admin });
    expect(newSub.plan).toBe('pro');
    expect(newSub.status).toBe('active');
    const activeCount = await PlatformTenantSubscription.countDocuments({ tenant: tenant._id, status: { $in: ['trialing', 'active'] } });
    expect(activeCount).toBe(1);

    const cancelled = await platformTenantService.cancelSubscription(tenant._id, { actor: admin, reason: 'Fin de contrat' });
    expect(cancelled.status).toBe('cancelled');
    await expect(platformTenantService.cancelSubscription(tenant._id, { actor: admin })).rejects.toThrow();
  });
});

describe('tenantContextService — isolation transversale (Phase 4, aucune duplication d\'ORGANIZATION-1)', () => {
  test('resolveTenantForUser renvoie null pour un utilisateur sans appartenance', async () => {
    const user = await makeUser();
    expect(await resolveTenantForUser(user._id)).toBeNull();
  });

  test('resolveTenantForUser résout le tenant via une appartenance à la racine', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Résolution Directe', actor: admin });
    const employee = await makeUser();
    await organizationService.grantMembership({ userId: employee._id, orgUnitId: tenant.rootOrgUnit, actor: admin });

    const resolved = await resolveTenantForUser(employee._id);
    expect(String(resolved._id)).toBe(String(tenant._id));
  });

  test('resolveTenantForUser résout le tenant même via une appartenance à une unité descendante', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Résolution Descendante', actor: admin });
    const businessUnit = await organizationService.createOrgUnit({ name: 'Pôle Immobilier', type: 'business_unit', parentId: tenant.rootOrgUnit, actor: admin });
    const employee = await makeUser();
    await organizationService.grantMembership({ userId: employee._id, orgUnitId: businessUnit._id, actor: admin });

    const resolved = await resolveTenantForUser(employee._id);
    expect(String(resolved._id)).toBe(String(tenant._id));
  });

  test('resolveTenantScope(tenantId) renvoie le même scopeUserIds que getScopeUserIds(rootOrgUnit)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Scope Test', actor: admin });
    const employee = await makeUser();
    await organizationService.grantMembership({ userId: employee._id, orgUnitId: tenant.rootOrgUnit, actor: admin });

    const direct = await organizationService.getScopeUserIds(tenant.rootOrgUnit);
    const viaTenant = await resolveTenantScope(tenant._id);
    expect([...viaTenant.scopeUserIds]).toEqual([...direct]);
  });

  test('un tenant introuvable dégrade vers "aucun scope", jamais une erreur bloquante', async () => {
    const result = await resolveTenantScope(new mongoose.Types.ObjectId());
    expect(result.tenant).toBeNull();
    expect(result.scopeUserIds).toBeNull();
  });
});

describe('Reporting/ERP — tenantId comme alias de orgUnitId (Phase 7, sans casser le comportement existant)', () => {
  test('getExecutiveReport({tenantId}) produit le même scope CRM que getExecutiveReport({orgUnitId}) équivalent', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Reporting Alias Test', actor: admin });
    const employee = await makeUser();
    await organizationService.grantMembership({ userId: employee._id, orgUnitId: tenant.rootOrgUnit, actor: admin });

    const viaOrgUnitId = await getExecutiveReport({ orgUnitId: String(tenant.rootOrgUnit) });
    const viaTenantId = await getExecutiveReport({ tenantId: String(tenant._id) });
    expect(viaTenantId.domains.crm.data.orgScopeSupported).toBe(viaOrgUnitId.domains.crm.data.orgScopeSupported);
    expect(viaTenantId.tenantId).toBe(String(tenant._id));
  });

  test('sans tenantId ni orgUnitId, le comportement Reporting reste STRICTEMENT inchangé (aucun scope)', async () => {
    const report = await getExecutiveReport({});
    expect(report.orgUnitId).toBeNull();
    expect(report.domains.crm.data.orgScopeSupported).toBe(true); // supporté mais non appliqué (pas de scope demandé)
    expect(report.domains.crm.data.orgScopeNote).toBeNull();
  });

  test('erpService.getExecutiveOverview accepte tenantId sans erreur', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'ERP Alias Test', actor: admin });
    const overview = await erpService.getExecutiveOverview({ tenantId: String(tenant._id) });
    expect(overview).toHaveProperty('domains');
    expect(overview).toHaveProperty('alerts');
  });
});

describe('API Gateway — isolation additive et rétrocompatible (Phase 7, risque de fuite identifié en audit)', () => {
  test('une clé API SANS tenant voit le catalogue global — comportement strictement inchangé', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerB = await makeUser({ role: 'Proprietaire' });
    await makeProperty(ownerA, { title: 'Bien Tenant A' });
    await makeProperty(ownerB, { title: 'Bien Tenant B' });

    const { apiKey } = await createApiKey({ name: 'Legacy Key', scopes: ['properties:read'], actor: admin });
    expect(apiKey.tenant).toBeNull();

    const result = await listPublicProperties({}, { scopeUserIds: null });
    expect(result.total).toBe(2); // les deux biens, comme avant ce sprint
  });

  test('une clé API liée à un tenant ne voit QUE les biens de ce tenant (post-filtre owner, jamais une nouvelle collection)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Tenant Immobilier A', actor: admin });
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerB = await makeUser({ role: 'Proprietaire' }); // hors tenant
    await organizationService.grantMembership({ userId: ownerA._id, orgUnitId: tenant.rootOrgUnit, actor: admin });

    const propA = await makeProperty(ownerA, { title: 'Bien Scopé A' });
    await makeProperty(ownerB, { title: 'Bien Hors Scope' });

    const { scopeUserIds } = await resolveTenantScope(tenant._id);
    const result = await listPublicProperties({}, { scopeUserIds });
    expect(result.total).toBe(1);
    expect(result.properties[0].title).toBe('Bien Scopé A');

    const own = await getPublicPropertyById(propA._id, { scopeUserIds });
    expect(own).not.toBeNull();
  });

  test('getPublicPropertyById renvoie null pour un bien hors du scope du tenant (jamais une fuite)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Tenant Immobilier B', actor: admin });
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerOutside = await makeUser({ role: 'Proprietaire' });
    await organizationService.grantMembership({ userId: ownerA._id, orgUnitId: tenant.rootOrgUnit, actor: admin });
    const outsideProperty = await makeProperty(ownerOutside, { title: 'Bien Concurrent' });

    const { scopeUserIds } = await resolveTenantScope(tenant._id);
    const result = await getPublicPropertyById(outsideProperty._id, { scopeUserIds });
    expect(result).toBeNull();
  });

  test('listPublicHotels respecte le scope tenant via Hotel.manager', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Tenant Hôtel', actor: admin });
    const managerA = await makeUser({ role: 'Proprietaire' });
    const managerOutside = await makeUser({ role: 'Proprietaire' });
    await organizationService.grantMembership({ userId: managerA._id, orgUnitId: tenant.rootOrgUnit, actor: admin });
    const propertyA = await makeProperty(managerA);
    await Hotel.create({ name: 'Hôtel Scopé', manager: managerA._id, createdBy: admin._id, property: propertyA._id, publicationStatus: 'publie', active: true });
    const propertyOutside = await makeProperty(managerOutside);
    await Hotel.create({ name: 'Hôtel Hors Scope', manager: managerOutside._id, createdBy: admin._id, property: propertyOutside._id, publicationStatus: 'publie', active: true });

    const { scopeUserIds } = await resolveTenantScope(tenant._id);
    const result = await listPublicHotels({}, { scopeUserIds });
    expect(result.total).toBe(1);
    expect(result.hotels[0].name).toBe('Hôtel Scopé');
  });

  test('getPublicAccommodationById respecte le scope tenant via property.owner, et ne fuite jamais ce champ', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'Tenant Hébergement', actor: admin });
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerOutside = await makeUser({ role: 'Proprietaire' });
    await organizationService.grantMembership({ userId: ownerA._id, orgUnitId: tenant.rootOrgUnit, actor: admin });

    const propertyA = await makeProperty(ownerA, { status: 'hebergement' });
    const accoA = await Accommodation.create({ property: propertyA._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', createdBy: admin._id });
    const propertyOutside = await makeProperty(ownerOutside, { status: 'hebergement' });
    const accoOutside = await Accommodation.create({ property: propertyOutside._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', createdBy: admin._id });

    const { scopeUserIds } = await resolveTenantScope(tenant._id);
    const own = await getPublicAccommodationById(accoA._id, { scopeUserIds });
    expect(own).not.toBeNull();
    expect(own.property.owner).toBeUndefined(); // jamais exposé publiquement

    const outside = await getPublicAccommodationById(accoOutside._id, { scopeUserIds });
    expect(outside).toBeNull();
  });

  test('HTTP /api/public/v1/properties : une clé API tenant-scopée ne renvoie que son propre catalogue', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const tenant = await platformTenantService.createTenant({ name: 'HTTP Tenant Test', actor: admin });
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerOutside = await makeUser({ role: 'Proprietaire' });
    await organizationService.grantMembership({ userId: ownerA._id, orgUnitId: tenant.rootOrgUnit, actor: admin });
    await makeProperty(ownerA, { title: 'HTTP Bien Scopé' });
    await makeProperty(ownerOutside, { title: 'HTTP Bien Hors Scope' });

    const { apiKey, rawKey } = await createApiKey({ name: 'Tenant Key', scopes: ['properties:read'], actor: admin, tenant: tenant._id });
    expect(apiKey.tenant.toString()).toBe(String(tenant._id));

    const res = await request(app).get('/api/public/v1/properties').set('X-API-Key', rawKey);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.properties[0].title).toBe('HTTP Bien Scopé');
  });
});

describe('HTTP /api/platform-tenants — réservé Direction (Admin)', () => {
  test('401 sans authentification', async () => {
    const res = await request(app).get('/api/platform-tenants');
    expect(res.status).toBe(401);
  });

  test('403 pour un rôle non-Admin', async () => {
    const collab = await makeUser({ role: 'Collaborateur' });
    const res = await request(app).get('/api/platform-tenants').set('Authorization', `Bearer ${signToken(collab._id)}`);
    expect(res.status).toBe(403);
  });

  test('cycle HTTP complet : créer → suspendre → réactiver → activer un module → archiver', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const token = `Bearer ${signToken(admin._id)}`;

    const createRes = await request(app).post('/api/platform-tenants').set('Authorization', token).send({ name: 'HTTP Lifecycle Test', plan: 'starter' });
    expect(createRes.status).toBe(201);
    const tenantId = createRes.body.data.tenant._id;

    const overviewRes = await request(app).get(`/api/platform-tenants/${tenantId}`).set('Authorization', token);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.overview.subscription.plan).toBe('starter');

    const suspendRes = await request(app).patch(`/api/platform-tenants/${tenantId}/suspend`).set('Authorization', token).send({ reason: 'Test' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.tenant.status).toBe('suspended');

    const reactivateRes = await request(app).patch(`/api/platform-tenants/${tenantId}/reactivate`).set('Authorization', token);
    expect(reactivateRes.status).toBe(200);

    const featureRes = await request(app).patch(`/api/platform-tenants/${tenantId}/features/crm`).set('Authorization', token).send({ enabled: true });
    expect(featureRes.status).toBe(200);
    expect(featureRes.body.data.feature.enabled).toBe(true);

    const archiveRes = await request(app).patch(`/api/platform-tenants/${tenantId}/archive`).set('Authorization', token);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.tenant.status).toBe('archived');
  });
});
