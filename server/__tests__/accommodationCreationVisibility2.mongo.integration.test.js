jest.mock('../config/cloudinary', () => {
  const actual = jest.requireActual('../config/cloudinary');
  let image = 0;
  return {
    ...actual,
    uploadToCloudinary: jest.fn(async () => ({ secure_url: `https://cloudinary.test/hotfix-${++image}.jpg` })),
  };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const accommodationRoutes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');
const { getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', accommodationRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const completeCreate = (actor, tenant, suffix, overrides = {}) => {
  let call = request(app)
    .post('/api/accommodations/admin')
    .set(bearer(actor, tenant))
    .field('title', `HOTFIX2 Hébergement ${suffix}`)
    .field('description', 'Hébergement complet de certification du workflow administrateur.')
    .field('price', '45000')
    .field('pole', 'Altimmo')
    .field('type', 'Villa')
    .field('surface', '120')
    .field('address', JSON.stringify({ arrondissement: 'Bacongo', city: 'Brazzaville' }))
    .field('latitude', '-4.2661')
    .field('longitude', '15.2832')
    .field('location', JSON.stringify({ type: 'Point', coordinates: [15.2832, -4.2661] }))
    .field('bedrooms', '3')
    .field('bathrooms', overrides.bathrooms ?? '2')
    .field('accommodationType', 'villa_meublee')
    .field('capacity[maxAdults]', '4')
    .field('capacity[maxChildren]', '2')
    .field('checkInTime', '14:00')
    .field('checkOutTime', '11:00')
    .field('nightlyPrice', '45000')
    .field('accommodationAmenities', JSON.stringify({ cuisine: ['four'] }))
    .field('includedServices', JSON.stringify({ menage: true }));
  for (let index = 0; index < 3; index += 1) {
    call = call.attach('images', Buffer.from(`image-${suffix}-${index}`), { filename: `${suffix}-${index}.jpg`, contentType: 'image/jpeg' });
  }
  return call;
};

let tenantA;
let tenantB;
let adminA;
let adminB;
let unscopedAdmin;
let operator;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Accommodation hotfix A' });
  const fixtureB = await createTenantFixture({ label: 'Accommodation hotfix B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  unscopedAdmin = await User.create({ name: 'Unscoped Admin', email: 'hotfix2-unscoped@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  operator = await User.create({ name: 'Scoped Operator', email: 'hotfix2-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HOTFIX accommodation scoped create', capabilities: [] });
});

afterAll(stopFinancialMongo);

test('RED→GREEN — création Admin A persiste le tenant sur la paire et reste invisible au tenant B', async () => {
  const response = await completeCreate(adminA, tenantA, 'A');
  expect(response.status).toBe(201);
  expect(response.body.data.lifecycle).toEqual({ publicationStatus: 'soumis', visibility: 'pending_moderation' });

  const accommodation = await Accommodation.findById(response.body.data.accommodation._id).lean();
  const property = await Property.findById(response.body.data.property._id).lean();
  expect(String(accommodation.tenant)).toBe(String(tenantA._id));
  expect(String(property.tenant)).toBe(String(tenantA._id));
  expect(String(accommodation.property)).toBe(String(property._id));
  expect(String(property.owner)).toBe(String(adminA._id));
  expect(accommodation.publicationStatus).toBe('soumis');
  expect(property).toMatchObject({ status: 'hebergement', statusAdmin: 'En attente', isPublished: false });

  const pendingA = await request(app).get('/api/accommodations/status/pending').set(bearer(adminA, tenantA));
  const pendingB = await request(app).get('/api/accommodations/status/pending').set(bearer(adminB, tenantB));
  expect(pendingA.body.data.accommodations.map((item) => item._id)).toContain(String(accommodation._id));
  expect(pendingB.body.data.accommodations.map((item) => item._id)).not.toContain(String(accommodation._id));
});

test('RED→GREEN — tenant B est attribué à B et les créations sans sélection valide échouent fermées', async () => {
  const responseB = await completeCreate(adminB, tenantB, 'B');
  expect(responseB.status).toBe(201);
  expect(String((await Accommodation.findById(responseB.body.data.accommodation._id).lean()).tenant)).toBe(String(tenantB._id));
  expect(String((await Property.findById(responseB.body.data.property._id).lean()).tenant)).toBe(String(tenantB._id));

  expect((await completeCreate(unscopedAdmin, null, 'UNSCOPED')).status).toBe(403);
  expect((await completeCreate(operator, null, 'OPERATOR-GLOBAL')).status).toBe(403);
  expect((await completeCreate(operator, tenantA, 'OPERATOR-A')).status).toBe(201);
});

test('RED→GREEN — incomplet reste brouillon et le contrat explicite sa visibilité', async () => {
  const response = await completeCreate(adminA, tenantA, 'DRAFT', { bathrooms: '0' });
  expect(response.status).toBe(201);
  expect(response.body.data.lifecycle).toEqual({ publicationStatus: 'brouillon', visibility: 'draft' });
  expect(response.body.data.accommodation.publicationStatus).toBe('brouillon');
  expect(response.body.data.property).toMatchObject({ statusAdmin: 'En attente', isPublished: false });
});

test('RED→GREEN — validation synchronise Property, rend la ressource visible et aligne KPI/portfolio', async () => {
  const created = await completeCreate(adminA, tenantA, 'PUBLISH');
  const accommodationId = created.body.data.accommodation._id;
  const propertyId = created.body.data.property._id;

  const validated = await request(app).patch(`/api/accommodations/${accommodationId}/validate`).set(bearer(adminA, tenantA));
  expect(validated.status).toBe(200);
  expect(validated.body.data.accommodation.publicationStatus).toBe('publie');
  expect(await Property.findById(propertyId).lean()).toMatchObject({ statusAdmin: 'Validée', isPublished: true, tenant: tenantA._id });

  const list = await request(app)
    .get('/api/accommodations/admin/list?status=publie&independentOnly=true&validatedOnly=true&activeOnly=true')
    .set(bearer(adminA, tenantA));
  expect(list.body.data.accommodations.map((item) => item._id)).toContain(String(accommodationId));

  const scopeUserIds = [adminA._id];
  const portfolio = await getPropertyPortfolioForTenantScope({ scopeUserIds });
  const stats = await getDashboardKpis({ scopeUserIds });
  expect(stats.Altimmo).toBe(portfolio.stats.total);
});
