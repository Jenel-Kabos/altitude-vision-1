const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const organizationService = require('../services/organizationService');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const { createFullAccommodation, duplicateAccommodation } = require('../services/accommodationService');
const { duplicateHotel } = require('../services/hotelService');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const {
  OWNER_ORGANIZATIONAL_STATE,
  OWNER_ASSET_CONSISTENCY,
  resolveOwnerOrganizationalState,
  inspectOwnerOrganizationalConsistency,
  resolvePropertyCreationTenant,
} = require('../services/platformTenant/organizationAssetInvariantService');

jest.setTimeout(180000);
const app = express(); app.use(express.json()); app.use('/api/properties', propertyRoutes); app.use(errorHandler);
const bearer = (actor, tenant = null) => ({
  Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
const mobilePayload = (extra = {}) => ({
  titre: 'Bien mobile C29', description: 'Description mobile C2.9 suffisamment détaillée.', prix: 100000,
  superficie: 100, ville: 'Brazzaville', arrondissement: 'Centre', rue: 'Rue C29',
  type: 'Villa', categorie: 'location', photos: ['https://example.test/c29-mobile.jpg'], ...extra,
});
let sequence = 0;
const user = (role = 'Proprietaire') => User.create({
  name: `C29 ${++sequence}`, email: `c29-${Date.now()}-${sequence}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const property = (owner, tenant = null, extra = {}) => Property.create({
  owner, tenant, title: `C29 Property ${++sequence}`, description: 'Description C2.9 suffisamment détaillée.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 100000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26,
  longitude: 15.28, surface: 100, images: ['https://example.test/c29.jpg'],
  availability: 'Disponible', statusAdmin: 'En attente', ...extra,
});
const grantOwner = async (owner, fixture) => organizationService.grantMembership({
  userId: owner._id, orgUnitId: fixture.tenant.rootOrgUnit, roleInUnit: 'owner',
  businessRole: 'Admin', actor: fixture.bootstrap,
});

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(clearFinancialMongo);

test('C29-01 — independent conserve tenant:null pour une nouvelle Property', async () => {
  const owner = await user();
  expect(await resolveOwnerOrganizationalState(owner._id)).toMatchObject({ state: OWNER_ORGANIZATIONAL_STATE.INDEPENDENT, tenantId: null });
  expect(await resolvePropertyCreationTenant({ ownerId: owner._id })).toBeNull();
});

test('C29-02/03 — owner Tenant A reçoit A malgré une demande personnelle/null', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 A' }); await grantOwner(owner, a);
  expect(await resolveOwnerOrganizationalState(owner._id)).toMatchObject({ state: OWNER_ORGANIZATIONAL_STATE.ORGANIZATION_OWNER, tenantId: String(a.tenant._id) });
  expect(String(await resolvePropertyCreationTenant({ ownerId: owner._id }))).toBe(String(a.tenant._id));
});

test('C29-04 — owner A + contexte B est un conflit explicite sans write', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 A' }); const b = await createTenantFixture({ label: 'C29 B' }); await grantOwner(owner, a);
  await expect(resolvePropertyCreationTenant({ ownerId: owner._id, contextualTenantId: b.tenant._id }))
    .rejects.toMatchObject({ code: 'OWNER_ORGANIZATION_TENANT_CONFLICT' });
  expect(await Property.countDocuments()).toBe(0);
});

test('C29-05 — simple Collaborateur garde son patrimoine personnel indépendant', async () => {
  const member = await user(); const a = await createTenantFixture({ label: 'C29 member' });
  await organizationService.grantMembership({ userId: member._id, orgUnitId: a.tenant.rootOrgUnit, businessRole: 'Collaborateur', actor: a.bootstrap });
  expect((await resolveOwnerOrganizationalState(member._id)).state).toBe(OWNER_ORGANIZATIONAL_STATE.INDEPENDENT);
  expect(await resolvePropertyCreationTenant({ ownerId: member._id })).toBeNull();
});

test('C29-06/07 — PlatformOperator actuel ou ancien ne produit aucun ownership', async () => {
  const operator = await user('Admin'); const fixture = await createTenantFixture({ label: 'C29 technical', bootstrap: operator });
  const record = await PlatformOperator.create({ user: operator._id, status: 'active', capabilities: ['platform.tenants.manage'], grantedBy: operator._id, grantReason: 'C29' });
  expect((await resolveOwnerOrganizationalState(operator._id)).state).toBe(OWNER_ORGANIZATIONAL_STATE.INDEPENDENT);
  await PlatformOperator.updateOne({ _id: record._id }, { $set: { status: 'revoked' } });
  expect((await resolveOwnerOrganizationalState(operator._id)).state).toBe(OWNER_ORGANIZATIONAL_STATE.INDEPENDENT);
  expect(fixture.tenant.createdBy).toEqual(operator._id);
});

test('C29-08 — plusieurs owner memberships donnent AMBIGUOUS sans sélection implicite', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 multi A' }); const b = await createTenantFixture({ label: 'C29 multi B' });
  await grantOwner(owner, a); await grantOwner(owner, b);
  expect(await resolveOwnerOrganizationalState(owner._id)).toMatchObject({ state: OWNER_ORGANIZATIONAL_STATE.AMBIGUOUS, tenantId: null });
  await expect(resolvePropertyCreationTenant({ ownerId: owner._id })).rejects.toMatchObject({ code: 'OWNER_ORGANIZATION_AMBIGUOUS' });
});

test('C29-09 — hybride legacy A/null est détecté et jamais réparé', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 hybrid' }); await grantOwner(owner, a);
  const inA = await property(owner._id, a.tenant._id); const legacy = await property(owner._id, null);
  expect(await inspectOwnerOrganizationalConsistency(owner._id)).toMatchObject({ consistency: OWNER_ASSET_CONSISTENCY.INCONSISTENT });
  await expect(resolvePropertyCreationTenant({ ownerId: owner._id })).rejects.toMatchObject({ code: 'OWNER_ORGANIZATIONAL_STATE_INCONSISTENT' });
  expect((await Property.findById(inA._id)).tenant).toEqual(a.tenant._id);
  expect((await Property.findById(legacy._id)).tenant).toBeNull();
});

test('C29-10 — Property Tenant B d’un owner A est un conflit sans mutation', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 conflict A' }); const b = await createTenantFixture({ label: 'C29 conflict B' }); await grantOwner(owner, a);
  const conflict = await property(owner._id, b.tenant._id);
  expect(await inspectOwnerOrganizationalConsistency(owner._id)).toMatchObject({ consistency: OWNER_ASSET_CONSISTENCY.CROSS_TENANT_CONFLICT });
  await expect(resolvePropertyCreationTenant({ ownerId: owner._id })).rejects.toMatchObject({ code: 'OWNER_ORGANIZATION_ASSET_CONFLICT' });
  expect((await Property.findById(conflict._id)).tenant).toEqual(b.tenant._id);
});

test('C29-14 — actif historique tenant:null ne rend pas l’état actif incohérent', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 historical' }); await grantOwner(owner, a);
  await property(owner._id, a.tenant._id); const historical = await property(owner._id, null, { availability: 'Vendu', assetCycle: 'vendu' });
  expect(await inspectOwnerOrganizationalConsistency(owner._id)).toMatchObject({ consistency: OWNER_ASSET_CONSISTENCY.CONSISTENT });
  expect((await Property.findById(historical._id)).tenant).toBeNull();
});

test('C29-C2.8M — état Mila-like avant INCONSISTENT puis cible CONSISTENT', async () => {
  const owner = await user(); const mila = await createTenantFixture({ label: 'Mila Events C29' }); await grantOwner(owner, mila);
  await property(owner._id, mila.tenant._id, { title: 'Mila Hotel', status: 'hebergement' });
  const bureau = await property(owner._id, null, { title: 'BUREAU A LOUER' });
  const parcelle = await property(owner._id, null, { title: 'PARCELLE A VENDRE', status: 'vente' });
  expect((await inspectOwnerOrganizationalConsistency(owner._id)).consistency).toBe(OWNER_ASSET_CONSISTENCY.INCONSISTENT);
  await Property.updateMany({ _id: { $in: [bureau._id, parcelle._id] } }, { $set: { tenant: mila.tenant._id } });
  expect((await inspectOwnerOrganizationalConsistency(owner._id)).consistency).toBe(OWNER_ASSET_CONSISTENCY.CONSISTENT);
});

test('C29-02/03 HTTP Mobile — owner organisationnel crée dans A et le payload tenant:null ne décide rien', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 HTTP A' }); await grantOwner(owner, a);
  const response = await request(app).post('/api/properties/mobile').set(bearer(owner)).send(mobilePayload({ tenant: null }));
  expect(response.status).toBe(201);
  expect(String(response.body.data.property.tenant)).toBe(String(a.tenant._id));
});

test('C29-05 HTTP Mobile — simple membre crée toujours son bien personnel tenant:null', async () => {
  const member = await user(); const a = await createTenantFixture({ label: 'C29 HTTP member' });
  await organizationService.grantMembership({ userId: member._id, orgUnitId: a.tenant.rootOrgUnit, businessRole: 'Collaborateur', actor: a.bootstrap });
  const response = await request(app).post('/api/properties/mobile').set(bearer(member)).send(mobilePayload());
  expect(response.status).toBe(201);
  expect(response.body.data.property.tenant).toBeNull();
});

test('C29-18 — generic update ne peut modifier directement Property.tenant', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 immutable A' }); const b = await createTenantFixture({ label: 'C29 immutable B' });
  const item = await property(owner._id, a.tenant._id);
  const response = await request(app).put(`/api/properties/${item._id}`).set(bearer(owner)).send({ title: 'Titre inchangé tenant', tenant: b.tenant._id, '$set': { tenant: b.tenant._id } });
  expect(response.status).toBe(200);
  expect((await Property.findById(item._id)).tenant).toEqual(a.tenant._id);
});

test('C29-11/12 gate — les clones Accommodation et Hotel conservent la provenance organisationnelle de leur Property', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 clones' }); await grantOwner(owner, a);
  const accommodationProperty = await property(owner._id, a.tenant._id, { status: 'hebergement', title: 'Villa source' });
  const accommodation = await Accommodation.create({
    property: accommodationProperty._id, tenant: a.tenant._id, accommodationType: 'villa_meublee',
    createdBy: owner._id, publicationStatus: 'brouillon', active: true,
  });
  const accommodationClone = await duplicateAccommodation({
    accommodation, property: accommodationProperty,
    actingUser: { id: owner._id, _id: owner._id, platformTenant: a.tenant },
  });
  expect(accommodationClone.property.tenant).toEqual(a.tenant._id);

  const hotelProperty = await property(owner._id, a.tenant._id, { status: 'hebergement', title: 'Hotel source' });
  const hotel = await Hotel.create({
    name: 'Hotel source C29', property: hotelProperty._id, tenant: a.tenant._id,
    manager: owner._id, createdBy: owner._id, publicationStatus: 'brouillon', active: true,
  });
  const hotelClone = await duplicateHotel({
    hotel, property: hotelProperty,
    actingUser: { id: owner._id, _id: owner._id, platformTenant: a.tenant },
  });
  expect(hotelClone.property.tenant).toEqual(a.tenant._id);
  expect(String(hotelClone.hotel.tenant)).toBe(String(a.tenant._id));
});

test('C29-11 — la création Accommodation dérive le tenant depuis l’owner, jamais depuis un acteur sans contexte', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 accommodation owner' }); await grantOwner(owner, a);
  const result = await createFullAccommodation({
    propertyData: {
      owner: owner._id, title: 'Accommodation C29', description: 'Description Accommodation C2.9.',
      pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 50000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26,
      longitude: 15.28, surface: 100, images: ['https://example.test/c29-accommodation.jpg'],
      availability: 'Disponible', statusAdmin: 'En attente',
    },
    accommodationData: { accommodationType: 'villa_meublee', publicationStatus: 'brouillon' },
    rateData: null, hotelInput: null,
    actingUser: { id: owner._id, _id: owner._id },
  });
  expect(result.property.tenant).toEqual(a.tenant._id);
  expect(result.accommodation.tenant).toEqual(a.tenant._id);
});

test('C29-10 duplication — une source Tenant B pour un owner canonique A est refusée avant tout clone', async () => {
  const owner = await user(); const a = await createTenantFixture({ label: 'C29 clone conflict A' }); const b = await createTenantFixture({ label: 'C29 clone conflict B' }); await grantOwner(owner, a);
  const source = await property(owner._id, b.tenant._id, { status: 'hebergement', title: 'Source conflictuelle' });
  const accommodation = await Accommodation.create({ property: source._id, tenant: b.tenant._id, accommodationType: 'villa_meublee', createdBy: owner._id });
  const before = await Property.countDocuments();
  await expect(duplicateAccommodation({ accommodation, property: source, actingUser: { id: owner._id, _id: owner._id, platformTenant: b.tenant } }))
    .rejects.toMatchObject({ code: 'OWNER_ORGANIZATION_TENANT_CONFLICT' });
  expect(await Property.countDocuments()).toBe(before);
});
