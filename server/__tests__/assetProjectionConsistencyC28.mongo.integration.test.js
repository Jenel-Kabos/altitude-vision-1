const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const organizationService = require('../services/organizationService');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const propertyRoutes = require('../routes/propertyRoutes');
const accommodationRoutes = require('../routes/accommodationRoutes');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/hotels', hotelRoutes);
app.use(errorHandler);

const bearer = (user, tenant = null) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

const titles = (response) => (response.body.data?.properties || []).map((item) => item.title).sort();

let tenant;
let tenantAdmin;
let owner;

beforeAll(async () => {
  await startFinancialMongo();
  const fixture = await createTenantFixture({ label: 'C28 Mila Events', withAdminMembership: true });
  tenant = fixture.tenant;
  tenantAdmin = fixture.bootstrap;
  owner = await User.create({
    name: 'C28 huinlogistics Boss', email: 'c28-owner@example.test',
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Proprietaire', isEmailVerified: true,
  });
  await organizationService.grantMembership({
    userId: owner._id, orgUnitId: tenant.rootOrgUnit, roleInUnit: 'owner',
    businessRole: 'Admin', actor: tenantAdmin,
  });

  const makeProperty = (title, status, propertyTenant) => Property.create({
    title, status, tenant: propertyTenant, owner: owner._id,
    description: `Fixture C2.8 ${title} avec description suffisamment longue.`,
    pole: 'Altimmo', type: 'Villa', price: 100000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.28, surface: 100,
    images: ['https://example.test/c28.jpg'], statusAdmin: 'Validée',
    isPublished: true, availability: 'Disponible',
  });
  const [p1] = await Promise.all([
    makeProperty('C28 Mila Hotel', 'hebergement', tenant._id),
    makeProperty('C28 Bureau à louer', 'location', tenant._id),
    makeProperty('C28 Parcelle à vendre', 'vente', tenant._id),
    makeProperty('C28 Bien indépendant', 'location', null),
  ]);
  const hotel = await Hotel.create({
    name: 'C28 Mila Hotel', property: p1._id, tenant: tenant._id,
    manager: owner._id, createdBy: owner._id,
    publicationStatus: 'publie', status: 'actif', active: true,
  });
  await Accommodation.create({
    property: p1._id, tenant: tenant._id, accommodationType: 'hotel',
    hotel: hotel._id, publicationStatus: 'publie', active: true,
    createdBy: owner._id,
  });
});

afterAll(stopFinancialMongo);

test('C2.8 projects one canonical heritage without merging domain contracts', async () => {
  const mine = await request(app).get('/api/properties/my-properties').set(bearer(owner));
  expect(mine.status).toBe(200);
  expect(titles(mine)).toEqual([
    'C28 Bien indépendant', 'C28 Bureau à louer', 'C28 Mila Hotel', 'C28 Parcelle à vendre',
  ]);

  const registry = await request(app).get('/api/properties?dashboardRegistry=1').set(bearer(tenantAdmin, tenant));
  expect(registry.status).toBe(200);
  expect(titles(registry)).toEqual(['C28 Bureau à louer', 'C28 Mila Hotel', 'C28 Parcelle à vendre']);
  expect(JSON.stringify(registry.body)).not.toContain('C28 Bien indépendant');

  const sales = await request(app).get('/api/properties?dashboardRegistry=1&offerType=vente').set(bearer(tenantAdmin, tenant));
  expect(titles(sales)).toEqual(['C28 Parcelle à vendre']);
  const rentals = await request(app).get('/api/properties?dashboardRegistry=1&offerType=location').set(bearer(tenantAdmin, tenant));
  expect(titles(rentals)).toEqual(['C28 Bureau à louer']);

  const accommodations = await request(app)
    .get('/api/accommodations/admin/list?status=publie&independentOnly=true&validatedOnly=true&activeOnly=true')
    .set(bearer(tenantAdmin, tenant));
  expect(accommodations.status).toBe(200);
  expect(accommodations.body.data).toMatchObject({ accommodations: [], total: 0 });

  const hotels = await request(app).get('/api/hotels/portfolio').set(bearer(tenantAdmin, tenant));
  expect(hotels.status).toBe(200);
  expect(hotels.body.data.total).toBe(1);
  expect(hotels.body.data.hotels[0]).toMatchObject({ name: 'C28 Mila Hotel' });
});
