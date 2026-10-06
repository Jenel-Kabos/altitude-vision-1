const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const PlatformOperator = require('../models/PlatformOperator');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const propertyAssetRoutes = require('../routes/propertyAssetRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/property-asset', propertyAssetRoutes);
app.use(errorHandler);

const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

let tenantA; let tenantB; let adminA; let ownerA; let fullOperator;
let propertyA; let propertyB; let propertyNull;

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await clearFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PA04B Asset A' });
  const fixtureB = await createTenantFixture({ label: 'PA04B Asset B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, businessRole: 'Admin', overrides: { role: 'Admin' } })).user;
  ownerA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, businessRole: 'Collaborateur', overrides: { role: 'Proprietaire' } })).user;
  fullOperator = await User.create({
    name: 'PA04B Full Operator', email: `pa04b-full-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true,
  });
  await PlatformOperator.create({
    user: fullOperator._id,
    status: 'active',
    capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES],
    grantedBy: fullOperator._id,
    grantReason: 'PA04B scope integration fixture',
  });
  const makeProperty = (title, tenant) => ({
    _id: new mongoose.Types.ObjectId(), title, owner: ownerA._id, tenant,
    status: 'vente', statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', pole: 'Altimmo', type: 'Villa', price: 1,
    createdAt: new Date(), updatedAt: new Date(),
  });
  [propertyA, propertyB, propertyNull] = [
    makeProperty('Asset A', tenantA._id),
    makeProperty('Asset B', tenantB._id),
    makeProperty('Asset Null', null),
  ];
  await Property.collection.insertMany([propertyA, propertyB, propertyNull]);
});

test.each(['propertyA', 'propertyB', 'propertyNull'])(
  'PLATFORM + platform.properties.read can read cockpit history for %s',
  async (key) => {
    const property = { propertyA, propertyB, propertyNull }[key];
    const response = await request(app).get(`/api/property-asset/${property._id}/history`).set(bearer(fullOperator));
    expect(response.status).toBe(200);
  },
);

test('Tenant A can read Tenant A but cannot read Tenant B or tenant:null even through owner fallback', async () => {
  const ownTenant = await request(app).get(`/api/property-asset/${propertyA._id}/history`).set(bearer(adminA, tenantA._id));
  const crossTenant = await request(app).get(`/api/property-asset/${propertyB._id}/history`).set(bearer(adminA, tenantA._id));
  const unattributed = await request(app).get(`/api/property-asset/${propertyNull._id}/history`).set(bearer(adminA, tenantA._id));
  expect(ownTenant.status).toBe(200);
  expect(crossTenant.status).toBe(403);
  expect(unattributed.status).toBe(403);
});

test('forged platform hints do not turn a tenant Admin into PLATFORM', async () => {
  const response = await request(app)
    .get(`/api/property-asset/${propertyB._id}/history?platformScoped=true&mode=platform`)
    .set(bearer(adminA, tenantA._id));
  expect(response.status).toBe(403);
});
