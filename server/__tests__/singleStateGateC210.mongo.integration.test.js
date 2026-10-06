// C2.10 — gate single-state focalisé. Complète C2.9
// (ownerOrganizationalStateInvariantC29) sur les seuls chemins qu'il ne prouvait
// pas encore de bout en bout : création Web HTTP (S2/S3/S4), payload forgé Mobile
// (S4) et créations complètes Vente/Location (S7/S8). Un owner organisationnel ne
// peut créer aucun bien actif `tenant:null`, ni choisir un autre tenant.
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'https://example.test/c210.jpg' }),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const organizationService = require('../services/organizationService');
const User = require('../models/User');
const Property = require('../models/Property');
const { createFullSaleProperty } = require('../services/salePropertyService');
const { createFullRentalProperty } = require('../services/rentalPropertyService');
const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const bearer = (actor, tenant = null) => ({
  Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
let sequence = 0;
const makeUser = (role = 'Proprietaire') => User.create({
  name: `C210 ${++sequence}`, email: `c210-${Date.now()}-${sequence}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});
const grantOwner = (owner, fixture) => organizationService.grantMembership({
  userId: owner._id, orgUnitId: fixture.tenant.rootOrgUnit, roleInUnit: 'owner', businessRole: 'Admin', actor: fixture.bootstrap,
});
const webCreate = (actor, fields = {}, tenantHeader = null) => {
  const req = request(app).post('/api/properties').set(bearer(actor, tenantHeader))
    .field('title', `C210 Web ${++sequence}`)
    .field('description', 'Description C2.10 suffisamment détaillée pour la validation.')
    .field('price', '150000').field('pole', 'Altimmo').field('status', 'location').field('type', 'Villa')
    .field('surface', '90').field('latitude', '-4.26').field('longitude', '15.28')
    .field('address', JSON.stringify({ city: 'Brazzaville', arrondissement: 'Centre' }))
    .attach('images', Buffer.from('c210-image'), 'c210.jpg');
  Object.entries(fields).forEach(([key, value]) => req.field(key, value));
  return req;
};
const mobilePayload = (extra = {}) => ({
  titre: `C210 Mobile ${++sequence}`, description: 'Description mobile C2.10 suffisamment détaillée.', prix: 120000,
  superficie: 80, ville: 'Brazzaville', arrondissement: 'Centre', rue: 'Rue C210',
  type: 'Villa', categorie: 'location', photos: ['https://example.test/c210-mobile.jpg'], ...extra,
});
const fullPropertyData = (owner, extra = {}) => ({
  owner: owner._id, title: `C210 Full ${++sequence}`, description: 'Description C2.10 suffisamment détaillée.',
  pole: 'Altimmo', type: 'Villa', price: 200000, surface: 100,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.28,
  images: ['https://example.test/c210-full.jpg'], availability: 'Disponible', statusAdmin: 'En attente', ...extra,
});

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(clearFinancialMongo);

describe('C2.10 — Web HTTP (POST /api/properties)', () => {
  test('S1 — independent crée un bien personnel tenant:null', async () => {
    const owner = await makeUser();
    const res = await webCreate(owner);
    expect(res.status).toBe(201);
    expect((await Property.findOne({ owner: owner._id }).lean()).tenant).toBeNull();
  });

  test('S2/S3 — owner Tenant A : le bien est créé dans A même avec tenant:null demandé par le client', async () => {
    const owner = await makeUser(); const a = await createTenantFixture({ label: 'C210 A' }); await grantOwner(owner, a);
    const res = await webCreate(owner, { tenant: 'null' });
    expect(res.status).toBe(201);
    const created = await Property.find({ owner: owner._id }).lean();
    expect(created).toHaveLength(1);
    expect(String(created[0].tenant)).toBe(String(a.tenant._id));
  });

  test('S4 — owner Tenant A : tenant B forgé dans le body ou l’en-tête n’est jamais appliqué', async () => {
    const owner = await makeUser(); const a = await createTenantFixture({ label: 'C210 A' }); const b = await createTenantFixture({ label: 'C210 B' });
    await grantOwner(owner, a);
    const res = await webCreate(owner, { tenant: String(b.tenant._id) }, b.tenant);
    const created = await Property.find({ owner: owner._id }).lean();
    if (res.status === 201) {
      expect(created.map((p) => String(p.tenant))).toEqual([String(a.tenant._id)]);
    } else {
      expect(res.status).toBe(409);
      expect(created).toHaveLength(0);
    }
    expect(await Property.countDocuments({ tenant: b.tenant._id })).toBe(0);
  });
});

describe('C2.10 — Mobile HTTP (POST /api/properties/mobile)', () => {
  test('S4/S6 — owner Tenant A : tenant B forgé dans le payload Mobile n’est jamais appliqué', async () => {
    const owner = await makeUser(); const a = await createTenantFixture({ label: 'C210 A' }); const b = await createTenantFixture({ label: 'C210 B' });
    await grantOwner(owner, a);
    const res = await request(app).post('/api/properties/mobile').set(bearer(owner)).send(mobilePayload({ tenant: String(b.tenant._id) }));
    expect([200, 201]).toContain(res.status);
    const created = await Property.find({ owner: owner._id }).lean();
    expect(created.map((p) => String(p.tenant))).toEqual([String(a.tenant._id)]);
    expect(await Property.countDocuments({ tenant: b.tenant._id })).toBe(0);
  });
});

describe('C2.10 — créations complètes Vente/Location', () => {
  test.each([
    ['S7 Vente', (data, actingUser) => createFullSaleProperty({ propertyData: { ...data, status: 'vente' }, saleData: {}, actingUser })],
    ['S8 Location', (data, actingUser) => createFullRentalProperty({ propertyData: { ...data, status: 'location' }, rentalData: {}, actingUser })],
  ])('%s — owner Tenant A reçoit A, independent reste tenant:null, tenant B forgé est refusé sans write', async (label, create) => {
    const owner = await makeUser(); const a = await createTenantFixture({ label: `C210 ${label} A` }); const b = await createTenantFixture({ label: `C210 ${label} B` });
    await grantOwner(owner, a);
    const created = await create(fullPropertyData(owner, { tenant: null }), owner);
    expect(String(created.property.tenant)).toBe(String(a.tenant._id));

    const independent = await makeUser();
    const personal = await create(fullPropertyData(independent), independent);
    expect(personal.property.tenant).toBeNull();

    await expect(create(fullPropertyData(owner, { tenant: b.tenant._id }), owner))
      .rejects.toMatchObject({ code: 'OWNER_ORGANIZATION_TENANT_CONFLICT' });
    expect(await Property.countDocuments({ tenant: b.tenant._id })).toBe(0);
    expect(await Property.countDocuments({ owner: owner._id })).toBe(1);
  });
});
