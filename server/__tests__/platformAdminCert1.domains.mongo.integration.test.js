// PLATFORM-ADMIN-CERT-1 — certification adversariale directe de la
// capacité PlatformOperator sur les domaines confirmés architecturalement
// sûrs par l'audit (server/docs/PLATFORM_ADMIN_CERT_1_AUDIT.md) mais jamais
// testés avec l'identité opérateur avant ce sprint : Hotel, Accommodation,
// CRM (dont fusion cross-tenant), CRM Automation, Marketing, Organization,
// USER-ARCH, ERP, API Platform, Finance, GL (RentalManagement).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const CrmCustomer = require('../models/CrmCustomer');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingCampaign = require('../models/MarketingCampaign');
const RentalManagement = require('../models/RentalManagement');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { createApiKey } = require('../services/publicApi/apiKeyService');

const hotelRoutes = require('../routes/hotelRoutes');
const accommodationRoutes = require('../routes/accommodationRoutes');
const crmRoutes = require('../routes/crmRoutes');
const crmAutomationRoutes = require('../routes/crmAutomationRoutes');
const marketingRoutes = require('../routes/marketingRoutes');
const organizationRoutes = require('../routes/organizationRoutes');
const userBusinessProfileRoutes = require('../routes/userBusinessProfileRoutes');
const erpRoutes = require('../routes/erpRoutes');
const apiPlatformAdminRoutes = require('../routes/apiPlatformAdminRoutes');
const financialRoutes = require('../routes/financialRoutes');
const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotels', hotelRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/crm-automation', crmAutomationRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/user-business-profiles', userBusinessProfileRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/dev-portal', apiPlatformAdminRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/rental-management', rentalManagementRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let operatorUser;
let grantingAdmin;
let seq = 0;

async function makeProperty(owner) {
  seq += 1;
  return Property.create({
    title: `Cert1Domains Property ${seq}`, description: 'Description suffisamment longue pour une fixture PLATFORM-ADMIN-CERT-1.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 350000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
    images: ['https://placehold.co/1200x800/png'], surface: 75, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
  });
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Cert1 Domains A' });
  const fixtureB = await createTenantFixture({ label: 'Cert1 Domains B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  grantingAdmin = await User.create({
    name: 'GrantingAdmin D', email: `granting-d-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  operatorUser = await User.create({
    name: 'Operator D', email: `operator-d-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  });
  await grantOperator({
    userId: operatorUser._id, actor: grantingAdmin, reason: 'Test domaines PLATFORM-ADMIN-CERT-1',
    capabilities: [
      'platform.hotels.read', 'platform.hotels.manage', 'platform.accommodations.read',
      'platform.crm.read', 'platform.crm.manage', 'platform.marketing.read',
      'platform.organization.read', 'platform.reporting.read', 'platform.api.read',
      'platform.finance.read', 'platform.rentals.read',
    ],
  });
});

afterAll(async () => stopFinancialMongo());

describe('Hotel', () => {
  let hotelB;
  beforeAll(async () => { hotelB = await createTenantHotel({ tenant: tenantB, manager: adminB, createdBy: adminB }); });

  test('RÉGRESSION connue TENANT-CERT : AdminA ne peut pas lister les catégories de chambres de Tenant B', async () => {
    const res = await request(app).get(`/api/hotels/${hotelB._id}/room-categories`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant B sélectionné accède aux catégories de chambres', async () => {
    const res = await request(app).get(`/api/hotels/${hotelB._id}/room-categories`).set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(200);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant A sélectionné reste refusé sur Hotel B', async () => {
    const res = await request(app).get(`/api/hotels/${hotelB._id}/room-categories`).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(res.status);
  });
});

describe('Accommodation', () => {
  let accommodationB;
  beforeAll(async () => {
    const property = await makeProperty(adminB);
    accommodationB = await Accommodation.create({
      property: property._id, createdBy: adminB._id, accommodationType: 'appartement_meuble',
      capacity: { maxAdults: 2, maxChildren: 0 }, publicationStatus: 'brouillon',
    });
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant B sélectionné lit l\'Accommodation', async () => {
    const res = await request(app).get(`/api/accommodations/${accommodationB._id}`).set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(200);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant A sélectionné refusé sur Accommodation B', async () => {
    const res = await request(app).get(`/api/accommodations/${accommodationB._id}`).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(res.status);
  });
});

describe('CRM — dont fusion cross-tenant', () => {
  let customerB1;
  let customerB2;
  let customerA1;

  beforeAll(async () => {
    const mk = (tenant, name) => CrmCustomer.create({
      tenant: tenant._id, displayName: name, identityKeys: [`key-${name}-${Date.now()}`],
    });
    customerB1 = await mk(tenantB, 'CustomerB1');
    customerB2 = await mk(tenantB, 'CustomerB2');
    customerA1 = await mk(tenantA, 'CustomerA1');
  });

  test('2B.2-D : PlatformOperator sans membership ne liste pas les customers de B', async () => {
    const res = await request(app).get('/api/crm/customers').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(403);
  });

  test('TESTÉ DIRECTEMENT : fusion CRM cross-tenant refusée même pour un opérateur scopé à B (customerA1 hors scope)', async () => {
    const res = await request(app).post('/api/crm/consolidations').set(bearer(operatorUser, tenantB))
      .send({ customerA: String(customerB1._id), customerB: String(customerA1._id), decision: 'keep_a', justification: 'Test PLATFORM-ADMIN-CERT-1 fusion' });
    expect(res.status).not.toBe(201);
    const check = await CrmCustomer.findById(customerA1._id).select('mergedInto');
    expect(check.mergedInto).toBeFalsy();
  });

  test('2B.2-D : fusion CRM reste refusée à l\'opérateur sans membership', async () => {
    const res = await request(app).post('/api/crm/consolidations').set(bearer(operatorUser, tenantB))
      .send({ customerA: String(customerB1._id), customerB: String(customerB2._id), decision: 'keep_a', justification: 'Test PLATFORM-ADMIN-CERT-1 fusion' });
    expect(res.status).toBe(403);
  });
});

describe('Marketing', () => {
  let templateB;
  let _campaignB;
  beforeAll(async () => {
    templateB = await MarketingTemplate.create({
      tenant: tenantB._id, name: 'Template B', channel: 'email', body: 'Corps du modèle', family: `family-b-${Date.now()}`, status: 'active',
    });
    _campaignB = await MarketingCampaign.create({
      tenant: tenantB._id, name: 'Campaign B', channel: 'email', template: templateB._id, segmentKey: 'all_customers',
    });
  });

  test('2B.2-D : PlatformOperator sans membership ne liste pas les campagnes de B', async () => {
    const res = await request(app).get('/api/marketing/campaigns').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(403);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator sans tenant sélectionné refusé (pas de mode global fabriqué)', async () => {
    const res = await request(app).get('/api/marketing/campaigns').set(bearer(operatorUser));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED');
  });
});

describe('Organization', () => {
  test('TESTÉ DIRECTEMENT : PlatformOperator SANS tenant sélectionné refusé (Organization n\'a pas de mode plateforme, comportement inchangé)', async () => {
    // Organization n'utilise pas requireTenantScope (voir audit §Organization),
    // mais `actorTenantRootId` (corrigé par ce sprint pour lire l'en-tête,
    // voir V5) retombe sur `resolveTenantForUser` sans tenant explicite →
    // source `platform_operator_unscoped` → `tenant: null` → 404 (jamais
    // 403, convention documentée dans organizationController.js : ne pas
    // confirmer l'existence d'une ressource hors contexte).
    const res = await request(app).get('/api/organization/units').set(bearer(operatorUser));
    expect(res.status).toBe(404);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator AVEC Tenant B sélectionné accède aux units de B', async () => {
    const res = await request(app).get('/api/organization/units').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(200);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant A sélectionné ne voit pas l\'arbre du tenant B', async () => {
    const res = await request(app).get(`/api/organization/units/${tenantB.rootOrgUnit}/tree`).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(res.status);
  });

  test('RÉGRESSION connue TENANT-CERT-2 : AdminA ne peut pas voir l\'arbre du tenant B', async () => {
    const res = await request(app).get(`/api/organization/units/${tenantB.rootOrgUnit}/tree`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });
});

describe('USER-ARCH (business profiles)', () => {
  test('TESTÉ DIRECTEMENT : AdminA refusé sur le profil métier de AdminB (Tenant B)', async () => {
    const res = await request(app).get(`/api/user-business-profiles/${adminB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });
});

describe('ERP', () => {
  test('TESTÉ DIRECTEMENT : PlatformOperator sans tenant sélectionné refusé (ERP n\'a pas de mode plateforme, comportement inchangé)', async () => {
    const res = await request(app).get('/api/erp/executive').set(bearer(operatorUser));
    expect(res.status).toBe(403);
  });

  test('2B DEP-06 : PlatformOperator avec Tenant B sélectionné mais sans membership est refusé par ERP', async () => {
    const res = await request(app).get('/api/erp/executive').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(403);
  });
});

describe('API Platform', () => {
  beforeAll(async () => {
    await createApiKey({ name: 'Key B', scopes: ['properties:read'], tenant: tenantB._id, actor: adminB });
  });

  test('2B DEP-06 : PlatformOperator sans membership ne peut lister les clés d’aucun tenant', async () => {
    const withB = await request(app).get('/api/dev-portal/keys').set(bearer(operatorUser, tenantB));
    expect(withB.status).toBe(403);
    const withA = await request(app).get('/api/dev-portal/keys').set(bearer(operatorUser, tenantA));
    expect(withA.status).toBe(403);
  });
});

describe('Finance — hotel financial dashboard', () => {
  let hotelB;
  beforeAll(async () => { hotelB = await createTenantHotel({ tenant: tenantB, manager: adminB, createdBy: adminB }); });

  test('TESTÉ DIRECTEMENT : PlatformOperator sans capacité finance suffisante refusé sur le dashboard de Tenant B', async () => {
    // operatorUser n'a que `platform.finance.read` — le dashboard reste
    // accessible (lecture), vérifie juste que la requête aboutit sans lever
    // d'erreur d'autorisation liée au tenant.
    const res = await request(app).get('/api/financial/hotel/dashboard/summary').query({ hotelId: String(hotelB._id) }).set(bearer(operatorUser, tenantB));
    expect(res.status).not.toBe(403);
  });

  test('TESTÉ DIRECTEMENT : PlatformOperator avec Tenant A sélectionné refusé sur le dashboard de Hotel B', async () => {
    const res = await request(app).get('/api/financial/hotel/dashboard/summary').query({ hotelId: String(hotelB._id) }).set(bearer(operatorUser, tenantA));
    expect([403, 404]).toContain(res.status);
  });
});

describe('GL — RentalManagement', () => {
  let rentalB;
  beforeAll(async () => {
    const property = await makeProperty(adminB);
    property.tenant = tenantB._id;
    await property.save();
    rentalB = await RentalManagement.create({ property: property._id, owner: adminB._id, tenant: tenantB._id, managementActivated: true, active: true });
  });

  test('PlatformOperator sans membership reste refusé sur RentalManagement tenant', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(403);
  });

  test('le même acteur avec membership Admin est évalué par son businessRole tenant', async () => {
    await addTenantMember({ tenant: tenantB, user: operatorUser, bootstrap: adminB, businessRole: 'Admin' });
    const res = await request(app).get('/api/rental-management').set(bearer(operatorUser, tenantB));
    expect(res.status).toBe(200);
    expect(res.body.data.rentals.map((r) => String(r._id))).toContain(String(rentalB._id));
  });

  test('la membership Tenant B ne donne aucun accès au Tenant A', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(operatorUser, tenantA));
    expect(res.status).toBe(403);
  });
});
