const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const Property = require('../models/Property');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const { errorHandler } = require('../middleware/errorMiddleware');
const app = express();
app.use('/api/property-asset', require('../routes/propertyAssetRoutes'));
app.use(errorHandler);
jest.setTimeout(120000);
beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);
let a, b;
beforeEach(async () => {
  a = await createTenantFixture({ withAdminMembership: true });
  b = await createTenantFixture({ withAdminMembership: true });
});
const property = (tenant, overrides = {}) => Property.create({
  title: 'Portfolio tenant test', description: 'Description suffisante pour le test de portefeuille.',
  owner: a.bootstrap._id, tenant: tenant?._id || null, pole: 'Altimmo', type: 'Bureau',
  status: 'location', price: 100000, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', surface: 90, latitude: -4.26, longitude: 15.24,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, images: ['https://example.test/test.png'], ...overrides,
});
const get = (user = a.bootstrap, tenant = a.tenant, status = 'location') => {
  const req = request(app).get(`/api/property-asset/portfolio/dashboard?status=${status}`)
    .set('Authorization', `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`);
  return tenant ? req.set('X-Platform-Tenant-Id', String(tenant._id)) : req;
};
const dashboard = async (...args) => { const res = await get(...args); expect(res.status).toBe(200); return res.body.data.dashboard; };
test('KPI-TENANT-01 active tenant rental is visible', async () => {
  await property(a.tenant); expect((await dashboard()).valeurTotale).toBe(100000);
});
test('KPI-TENANT-02 other tenant with the same owner is excluded', async () => {
  await property(b.tenant); expect((await dashboard()).totalBiens).toBe(0);
});
test('KPI-TENANT-03 legacy null tenant Bureau 650k is excluded', async () => {
  await property(null, { price: 650000 }); expect((await dashboard()).totalBiens).toBe(0);
});
test('KPI-TENANT-04 global Admin without membership denied', async () => {
  await require('../models/OrgMembership').deleteMany({ user: a.bootstrap._id });
  expect((await get()).status).toBe(403);
});
test('KPI-TENANT-05 membership Admin is authority even with global Client identity', async () => {
  await User.updateOne({ _id: a.bootstrap._id }, { role: 'Client' });
  await property(a.tenant, { owner: b.bootstrap._id });
  await property(b.tenant); await property(null);
  expect((await dashboard()).totalBiens).toBe(1);
});
test('KPI-TENANT-06 authorized switch A to B returns only B', async () => {
  await addTenantMember({ tenant: b.tenant, user: a.bootstrap, bootstrap: b.bootstrap, businessRole: 'Admin' });
  await property(a.tenant); await property(b.tenant, { price: 200000 });
  expect((await dashboard()).valeurTotale).toBe(100000);
  expect((await dashboard(a.bootstrap, b.tenant)).valeurTotale).toBe(200000);
});
test('KPI-TENANT-07 sale excluded from rental', async () => {
  await property(a.tenant, { status: 'vente' }); expect((await dashboard()).totalBiens).toBe(0);
});
test('KPI-TENANT-08 rental excluded from sale', async () => {
  await property(a.tenant); expect((await dashboard(a.bootstrap, a.tenant, 'vente')).totalBiens).toBe(0);
});
test('KPI-TENANT-09 no resolvable tenant fails closed', async () => {
  await require('../models/OrgMembership').deleteMany({ user: a.bootstrap._id });
  const res = await get(a.bootstrap, null); expect(res.status).toBe(403);
  expect(res.body.message).toMatch(/tenant/i);
});
test('KPI-TENANT-10 forged inaccessible tenant header denied', async () => {
  expect((await get(a.bootstrap, b.tenant)).status).toBe(403);
});
test('KPI-TENANT-11 PlatformOperator cannot get global portfolio or replace membership', async () => {
  await PlatformOperator.create({ user: a.bootstrap._id, status: 'active', capabilities: ['platform.properties.read'], grantedBy: b.bootstrap._id, grantReason: 'Test isolation' });
  await require('../models/OrgMembership').deleteMany({ user: a.bootstrap._id });
  expect((await get(a.bootstrap, null)).status).toBe(403);
  expect((await get()).status).toBe(403);
});
test('KPI-TENANT-12 occupied unpublished assets remain in tenant patrimonial KPI', async () => {
  await property(a.tenant, { availability: 'Loué', assetCycle: 'en_location', isPublished: false });
  const data = await dashboard(); expect(data.totalBiens).toBe(1); expect(data.biensOccupes).toBe(1);
});

test('KPI-TENANT-13 service without tenant fails closed', async () => {
  const { getPortfolioDashboard } = require('../services/propertyAssetPortfolioService');
  await expect(getPortfolioDashboard({ status: 'location' })).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED', statusCode: 403 });
});
test.each(['suspended', 'revoked'])('KPI-TENANT-14 inactive membership %s cannot authorize portfolio', async status => {
  await require('../models/OrgMembership').updateMany({ user: a.bootstrap._id }, { status });
  expect((await get()).status).toBe(403);
});
