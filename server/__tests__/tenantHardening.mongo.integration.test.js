const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const MarketingTemplate = require('../models/MarketingTemplate');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const CrmAutomationRun = require('../models/CrmAutomationRun');
const ApiKey = require('../models/ApiKey');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');
const { resolveTenantForUser, resolveEffectiveTenantContext, resolveAvailableTenantsForUser } = require('../services/platformTenant/tenantContextService');
const templateService = require('../services/marketingTemplateService');
const { checkQuota } = require('../services/platformTenant/tenantQuotaService');
const { getPropertyPortfolio } = require('../services/propertyPortfolioService');
const { handleEvent } = require('../services/crmAutomationEngine');
const crmRoutes = require('../routes/crmRoutes');
const publicRoutes = require('../routes/publicApi/v1');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);
const app = express(); app.use(express.json()); app.use('/api/crm', crmRoutes); app.use('/api/public/v1', publicRoutes); app.use('/api/properties', propertyRoutes); app.use(errorHandler);
const token = (id) => `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`;
let seq = 0;
const user = (role = 'Collaborateur') => User.create({ name: `U${++seq}`, email: `hardening${seq}${Date.now()}@test.dev`, password: 'Password123!', passwordConfirm: 'Password123!', role });

async function fixture() {
  const admin = await user('Admin');
  const [tenantA, tenantB] = await Promise.all([
    platformTenantService.createTenant({ name: `Tenant A ${seq}`, actor: admin }),
    platformTenantService.createTenant({ name: `Tenant B ${seq}`, actor: admin }),
  ]);
  const [userA, userB, userAB] = await Promise.all([user(), user(), user()]);
  await Promise.all([
    organizationService.grantMembership({ userId: userA._id, orgUnitId: tenantA.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: userB._id, orgUnitId: tenantB.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: userAB._id, orgUnitId: tenantA.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: userAB._id, orgUnitId: tenantB.rootOrgUnit, actor: admin }),
  ]);
  return { admin, tenantA, tenantB, userA, userB, userAB };
}

beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('résolution multi-tenant déterministe et fail-closed', async () => {
  const { tenantA, tenantB, userA, userAB } = await fixture();
  expect(String((await resolveTenantForUser(userA._id))._id)).toBe(String(tenantA._id));
  expect(await resolveTenantForUser(userAB._id)).toBeNull();
  expect(String((await resolveTenantForUser(userAB._id, tenantB._id))._id)).toBe(String(tenantB._id));
  expect(await resolveTenantForUser(userA._id, tenantB._id)).toBeNull();
  expect(await resolveAvailableTenantsForUser(userAB._id)).toHaveLength(2);
});

test('fallback legacy prouvé restaure GET /properties/portfolio et expose sa source sans accès global Admin', async () => {
  const legacyAdmin = await user('Admin');
  const tenant = await platformTenantService.createTenant({ name: `Altitude Vision Legacy ${seq}`, actor: legacyAdmin });
  const property = await Property.create({
    title: 'Portfolio Legacy Altitude Vision', description: 'Bien legacy utilisé pour la régression directe du contexte tenant.',
    pole: 'Altimmo', type: 'Appartement', status: 'vente', price: 100000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
    images: ['https://example.test/legacy.jpg'], surface: 80, owner: legacyAdmin._id,
    statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  });

  expect(await require('../models/OrgMembership').countDocuments({ user: legacyAdmin._id })).toBe(0);
  const context = await resolveEffectiveTenantContext(legacyAdmin._id);
  expect(String(context.tenant._id)).toBe(String(tenant._id));
  expect(context.source).toBe('legacy_fallback');

  const response = await request(app).get('/api/properties/portfolio').set('Authorization', token(legacyAdmin._id));
  expect(response.status).toBe(200);
  expect(response.body.data.items.map((item) => item.title)).toEqual(['Portfolio Legacy Altitude Vision']);
  expect(String(response.body.data.items[0].owner)).toBe(String(property.owner));

  const unrelatedAdmin = await user('Admin');
  expect((await request(app).get('/api/properties/portfolio').set('Authorization', token(unrelatedAdmin._id))).status).toBe(403);
});

test('fallback legacy refuse ambiguïté, tenant explicite et toute appartenance inactive', async () => {
  const ambiguousAdmin = await user('Admin');
  await platformTenantService.createTenant({ name: `Legacy Ambigu A ${seq}`, actor: ambiguousAdmin });
  const second = await platformTenantService.createTenant({ name: `Legacy Ambigu B ${seq}`, actor: ambiguousAdmin });
  expect(await resolveEffectiveTenantContext(ambiguousAdmin._id)).toBeNull();
  expect(await resolveEffectiveTenantContext(ambiguousAdmin._id, second._id)).toBeNull();

  const membershipAdmin = await user('Admin');
  const tenant = await platformTenantService.createTenant({ name: `Membership inactive ${seq}`, actor: ambiguousAdmin });
  const membership = await organizationService.grantMembership({ userId: membershipAdmin._id, orgUnitId: tenant.rootOrgUnit, actor: ambiguousAdmin });
  expect((await resolveEffectiveTenantContext(membershipAdmin._id)).source).toBe('single_membership');
  await organizationService.suspendMembership({ membershipId: membership._id, actor: ambiguousAdmin, reason: 'test' });
  expect(await resolveEffectiveTenantContext(membershipAdmin._id)).toBeNull();
  await organizationService.revokeMembership({ membershipId: membership._id, actor: ambiguousAdmin, reason: 'test' });
  expect(await resolveEffectiveTenantContext(membershipAdmin._id)).toBeNull();
});

test('tenant demandé doit être accessible et un tenant suspendu ou archivé reste exclu', async () => {
  const { tenantA, tenantB, userA } = await fixture();
  expect(String((await resolveEffectiveTenantContext(userA._id, tenantA._id)).tenant._id)).toBe(String(tenantA._id));
  expect(await resolveEffectiveTenantContext(userA._id, tenantB._id)).toBeNull();
  await require('../models/PlatformTenant').updateOne({ _id: tenantA._id }, { status: 'suspended' });
  expect(await resolveEffectiveTenantContext(userA._id)).toBeNull();
  await require('../models/PlatformTenant').updateOne({ _id: tenantA._id }, { status: 'archived' });
  expect(await resolveEffectiveTenantContext(userA._id)).toBeNull();
});

test('CRM READ/SEARCH et IDOR WRITE restent dans le tenant sélectionné', async () => {
  const { tenantA, tenantB, userA } = await fixture();
  const [customerA, customerB] = await CrmCustomer.create([
    { tenant: tenantA._id, displayName: 'Client Alpha', identityKeys: ['email:a@test.dev'] },
    { tenant: tenantB._id, displayName: 'Client Secret Beta', identityKeys: ['email:b@test.dev'] },
  ]);
  const opportunityB = await CrmOpportunity.create({ tenant: tenantB._id, customer: customerB._id, title: 'Opportunity B' });
  const headers = { Authorization: token(userA._id), 'X-Platform-Tenant-Id': String(tenantA._id) };
  const list = await request(app).get('/api/crm/customers').set(headers);
  expect(list.status).toBe(200); expect(list.body.data.customers.map((x) => x.displayName)).toEqual(['Client Alpha']);
  const search = await request(app).get('/api/crm/search?q=Secret').set(headers);
  expect(search.status).toBe(200); expect(search.body.data.results).toHaveLength(0);
  const readB = await request(app).get(`/api/crm/customers/${customerB._id}`).set(headers);
  expect(readB.status).toBe(404);
  const writeB = await request(app).patch(`/api/crm/opportunities/${opportunityB._id}/stage`).set(headers).send({ stage: 'qualification' });
  expect(writeB.status).toBe(404);
  expect((await CrmOpportunity.findById(opportunityB._id)).stage).toBe('prospect');
  expect(customerA.tenant.toString()).toBe(String(tenantA._id));
});

test('Marketing refuse lecture et activation d’un template adverse', async () => {
  const { tenantA, tenantB, userA } = await fixture();
  const [templateA, templateB] = await MarketingTemplate.create([
    { tenant: tenantA._id, family: 'welcome', name: 'A', channel: 'email', body: 'A', status: 'active' },
    { tenant: tenantB._id, family: 'welcome', name: 'B', channel: 'email', body: 'B', status: 'draft' },
  ]);
  expect(await templateService.listActiveTemplates({ tenantId: tenantA._id })).toHaveLength(1);
  await expect(templateService.activateTemplate(templateB._id, { actor: userA, tenantId: tenantA._id })).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
  expect((await MarketingTemplate.findById(templateB._id)).status).toBe('draft');
  expect(templateA.tenant.toString()).toBe(String(tenantA._id));
});

test('clé API historique sans tenant échoue fermée avec un catalogue vide', async () => {
  const raw = 'pk_live_legacytenanthardening';
  await ApiKey.create({ name: 'Legacy', keyPrefix: 'pk_live_', hashedKey: require('crypto').createHash('sha256').update(raw).digest('hex'), scopes: ['properties:read'] });
  const response = await request(app).get('/api/public/v1/properties').set('X-API-Key', raw);
  expect(response.status).toBe(200); expect(response.body.data.total).toBe(0);
});

test('quota centralisé bloque uniquement la création au-delà de la limite', async () => {
  const { tenantA, userA } = await fixture();
  await require('../models/PlatformTenantSubscription').updateOne({ tenant: tenantA._id, status: 'trialing' }, { 'quotas.maxUsers': 1 });
  await expect(checkQuota(tenantA, 'users')).rejects.toMatchObject({ code: 'TENANT_QUOTA_EXCEEDED' });
  expect(String((await resolveTenantForUser(userA._id))._id)).toBe(String(tenantA._id));
});

test('Property Portfolio isole les quatre sources et conserve les KPI du dataset tenant', async () => {
  const { userA, userB } = await fixture();
  const makeProperty = (owner, title, status) => Property.create({
    title, description: 'Description suffisamment longue pour le test tenant portfolio.',
    pole: 'Altimmo', type: 'Appartement', status, price: 100000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' },
    latitude: -4.26, longitude: 15.28, images: ['https://example.test/property.jpg'],
    surface: 80, owner, statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
  });
  const [saleA, locationA, accommodationPropertyA, hotelPropertyA, saleB, accommodationPropertyB, hotelPropertyB] = await Promise.all([
    makeProperty(userA._id, 'Vente A', 'vente'), makeProperty(userA._id, 'Location A', 'location'),
    makeProperty(userA._id, 'Hébergement A', 'hebergement'), makeProperty(userA._id, 'Ancre Hôtel A', 'hebergement'),
    makeProperty(userB._id, 'Vente secrète B', 'vente'), makeProperty(userB._id, 'Hébergement secret B', 'hebergement'),
    makeProperty(userB._id, 'Ancre Hôtel secret B', 'hebergement'),
  ]);
  await Promise.all([
    Accommodation.create({ property: accommodationPropertyA._id, accommodationType: 'appartement_meuble', publicationStatus: 'publie', active: true, createdBy: userA._id }),
    Accommodation.create({ property: accommodationPropertyB._id, accommodationType: 'appartement_meuble', publicationStatus: 'publie', active: true, createdBy: userB._id }),
    Hotel.create({ name: 'Hôtel A', property: hotelPropertyA._id, manager: userA._id, createdBy: userA._id, publicationStatus: 'publie', status: 'actif', active: true }),
    Hotel.create({ name: 'Hôtel secret B', property: hotelPropertyB._id, manager: userB._id, createdBy: userB._id, publicationStatus: 'publie', status: 'actif', active: true }),
  ]);

  const portfolioA = await getPropertyPortfolio({ scopeUserIds: [userA._id] });
  expect(portfolioA.items.map((item) => item.title).sort()).toEqual(['Hébergement A', 'Hôtel A', 'Location A', 'Vente A']);
  expect(portfolioA.items.some((item) => String(item.owner) === String(userB._id))).toBe(false);
  expect(portfolioA.stats.total).toBe(portfolioA.items.length);
  expect(portfolioA.stats.bySource).toEqual({ vente: 1, location: 1, accommodation: 1, hotel: 1 });
  expect((await getPropertyPortfolio({ scopeUserIds: [] })).items).toHaveLength(0);
  expect(String(saleA.owner)).toBe(String(userA._id));
  expect(String(locationA.owner)).toBe(String(userA._id));
  expect(String(saleB.owner)).toBe(String(userB._id));
});

test('un événement du Tenant A ne sélectionne ni n’exécute une automation du Tenant B', async () => {
  const { tenantA, tenantB, userA } = await fixture();
  await CrmAutomationRule.create([
    { tenant: tenantA._id, ruleId: 'tenant-a-rule', label: 'A', triggerEvent: 'quote_received', actions: [{ actionId: 'unknown.safe.noop' }] },
    { tenant: tenantB._id, ruleId: 'tenant-b-rule', label: 'B', triggerEvent: 'quote_received', actions: [{ actionId: 'unknown.safe.noop' }] },
  ]);
  expect(await handleEvent({ type: 'quote_received', recipient: userA._id, sender: userA._id })).toEqual([]);
  const results = await handleEvent({ type: 'quote_received', recipient: userA._id, sender: userA._id, platformTenantId: tenantA._id });
  expect(results.map((item) => item.ruleId)).toEqual(['tenant-a-rule']);
  expect(await CrmAutomationRun.countDocuments({ tenant: tenantA._id })).toBe(1);
  expect(await CrmAutomationRun.countDocuments({ tenant: tenantB._id })).toBe(0);
});
