const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const organizationService = require('../services/organizationService');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Hotel = require('../models/Hotel');
const PlatformOperator = require('../models/PlatformOperator');
const propertyRoutes = require('../routes/propertyRoutes');
const accommodationRoutes = require('../routes/accommodationRoutes');
const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const {
  REASON,
  regularizeAssetProjectionBatch,
} = require('../services/platformTenant/assetProjectionConsistencyApplyService');

jest.setTimeout(180000);

const ORPHAN_HOTEL_IDS = ['6a92b52800a8fa25e13e7916', '6a92b8a300a8fa25e13e7cc5'];
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
const propertyTitles = (response) => (response.body.data?.properties || []).map(({ title }) => title).sort();

let sequence = 0;
const makeUser = (label, role = 'Proprietaire') => User.create({
  name: label,
  email: `c28m-post-${++sequence}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role,
  isEmailVerified: true, isActive: true, status: 'Actif',
});
const makeProperty = (owner, title, status, tenant = null) => Property.create({
  title, status, tenant, owner: owner._id,
  description: `Fixture post-condition C2.8M ${title} suffisamment détaillée.`,
  pole: 'Altimmo', type: status === 'vente' ? 'Parcelle' : status === 'location' ? 'Bureau' : 'Villa',
  price: 1000000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' },
  latitude: -4.26, longitude: 15.28, surface: 100,
  images: ['https://example.test/c28m-post.jpg'],
  statusAdmin: 'Validée', isPublished: true, availability: 'Disponible',
});

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);
beforeEach(clearFinancialMongo);

test('C2.8M — l’apply atomique produit exactement le patrimoine owner et les projections Mila Events attendus', async () => {
  const milaFixture = await createTenantFixture({ label: 'Mila Events post-condition' });
  const altitudeFixture = await createTenantFixture({ label: 'Altitude Vision post-condition' });
  const otherFixture = await createTenantFixture({ label: 'Tenant B post-condition' });
  const owner = await makeUser('huinlogistics Boss');
  const tenantAdmin = milaFixture.bootstrap;
  const actor = await makeUser('C2.8M Platform Operator', 'Admin');
  const sentinelOwner = await makeUser('Sentinel Owner');

  await organizationService.grantMembership({
    userId: owner._id,
    orgUnitId: milaFixture.tenant.rootOrgUnit,
    roleInUnit: 'owner',
    businessRole: 'Admin',
    actor: tenantAdmin,
  });
  await organizationService.grantMembership({
    userId: tenantAdmin._id,
    orgUnitId: milaFixture.tenant.rootOrgUnit,
    businessRole: 'Admin',
    actor: tenantAdmin,
  });
  await PlatformOperator.create({
    user: actor._id, status: 'active', capabilities: ['platform.properties.manage'],
    grantedBy: actor._id, grantReason: 'C2.8M post-condition locale',
  });

  const milaHotelProperty = await makeProperty(owner, 'Mila Hotel', 'hebergement', milaFixture.tenant._id);
  const bureau = await makeProperty(owner, 'BUREAU A LOUER', 'location', null);
  const parcelle = await makeProperty(owner, 'PARCELLE A VENDRE', 'vente', null);
  await makeProperty(sentinelOwner, 'SENTINEL TENANT NULL', 'vente', null);
  await makeProperty(sentinelOwner, 'SENTINEL TENANT B', 'location', otherFixture.tenant._id);

  const milaHotel = await Hotel.create({
    name: 'Mila Hotel', property: milaHotelProperty._id, tenant: milaFixture.tenant._id,
    manager: owner._id, createdBy: owner._id,
    publicationStatus: 'publie', status: 'actif', active: true,
  });
  await Accommodation.create({
    property: milaHotelProperty._id, tenant: milaFixture.tenant._id,
    accommodationType: 'hotel', hotel: milaHotel._id,
    publicationStatus: 'publie', active: true, createdBy: owner._id,
  });
  await Promise.all(ORPHAN_HOTEL_IDS.map((_id, index) => Hotel.create({
    _id,
    name: `Altitude orphan ${index + 1}`,
    property: new mongoose.Types.ObjectId(),
    tenant: altitudeFixture.tenant._id,
    manager: altitudeFixture.bootstrap._id,
    createdBy: altitudeFixture.bootstrap._id,
    publicationStatus: 'publie', status: 'actif', active: true,
  })));

  const accommodationCountBefore = await Accommodation.countDocuments({});
  const hotelCountBefore = await Hotel.countDocuments({});

  const applyResult = await regularizeAssetProjectionBatch({
    mode: 'apply',
    targetTenantId: milaFixture.tenant._id,
    expectedOwnerId: owner._id,
    propertyIds: [bureau._id, parcelle._id],
    actorId: actor._id,
    reason: REASON,
    operationId: `C2_8M_POST_${++sequence}`,
  });

  const [mine, registry, sales, rentals, accommodations, hotels] = await Promise.all([
    request(app).get('/api/properties/my-properties').set(bearer(owner)),
    request(app).get('/api/properties?dashboardRegistry=1').set(bearer(tenantAdmin, milaFixture.tenant)),
    request(app).get('/api/properties?dashboardRegistry=1&offerType=vente').set(bearer(tenantAdmin, milaFixture.tenant)),
    request(app).get('/api/properties?dashboardRegistry=1&offerType=location').set(bearer(tenantAdmin, milaFixture.tenant)),
    request(app).get('/api/accommodations/admin/list?status=publie&independentOnly=true&validatedOnly=true&activeOnly=true').set(bearer(tenantAdmin, milaFixture.tenant)),
    request(app).get('/api/hotels/portfolio').set(bearer(tenantAdmin, milaFixture.tenant)),
  ]);

  expect(mine.status).toBe(200);
  expect(propertyTitles(mine)).toEqual(['BUREAU A LOUER', 'Mila Hotel', 'PARCELLE A VENDRE']);
  expect(registry.status).toBe(200);
  expect(propertyTitles(registry)).toEqual(['BUREAU A LOUER', 'Mila Hotel', 'PARCELLE A VENDRE']);
  expect(propertyTitles(sales)).toEqual(['PARCELLE A VENDRE']);
  expect(propertyTitles(rentals)).toEqual(['BUREAU A LOUER']);
  expect(accommodations.body.data).toMatchObject({ accommodations: [], total: 0 });
  expect(hotels.body.data.total).toBe(1);
  expect(hotels.body.data.hotels.map(({ name }) => name)).toEqual(['Mila Hotel']);

  const serialized = JSON.stringify({ registry: registry.body, sales: sales.body, rentals: rentals.body, accommodations: accommodations.body, hotels: hotels.body });
  expect(serialized).not.toContain('SENTINEL TENANT NULL');
  expect(serialized).not.toContain('SENTINEL TENANT B');
  expect(serialized).not.toContain('Altitude orphan');
  ORPHAN_HOTEL_IDS.forEach((id) => {
    expect(serialized).not.toContain(id);
    expect(JSON.stringify(applyResult)).not.toContain(id);
  });
  expect(applyResult.items.map(({ propertyId }) => propertyId).sort()).toEqual([String(bureau._id), String(parcelle._id)].sort());
  expect(await Accommodation.countDocuments({})).toBe(accommodationCountBefore);
  expect(await Hotel.countDocuments({})).toBe(hotelCountBefore);
  expect(await Hotel.countDocuments({ name: 'Mila Hotel' })).toBe(1);
  const finalProperties = await Property.find({ _id: { $in: [milaHotelProperty._id, bureau._id, parcelle._id] } }).lean();
  expect(finalProperties).toHaveLength(3);
  expect(finalProperties.every((property) => String(property.owner) === String(owner._id))).toBe(true);
  expect(finalProperties.every((property) => String(property.tenant) === String(milaFixture.tenant._id))).toBe(true);
});
