const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture } = require('./helpers/tenantAwareFixture');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const organizationService = require('../services/organizationService');
const User = require('../models/User');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const OrgMembership = require('../models/OrgMembership');
const IndividualSubscription = require('../models/IndividualSubscription');
const { errorHandler } = require('../middleware/errorMiddleware');
const {
  assertIndividualRentalPropertyAccess,
  individualRentalPropertyIds,
} = require('../services/rentalIndividualAccessService');

jest.setTimeout(120000);
const app = express();
app.use(express.json());
app.use('/api/rental-management', require('../routes/rentalManagementRoutes'));
app.use(errorHandler);

let seq = 0;
const user = () => User.create({
  name: `C210B Owner ${++seq}`,
  email: `c210b-scope-${seq}-${Date.now()}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
});
const property = (owner, tenant, key) => Property.create({
  title: `C210B ${key}`, description: 'Description suffisamment longue pour validation.', pole: 'Altimmo',
  type: 'Appartement', status: 'location', price: 250000, address: { city: 'Brazzaville', arrondissement: 'Centre' },
  images: ['https://example.test/p.jpg'], surface: 70, statusAdmin: 'Validée', availability: 'Disponible',
  latitude: -4.27, longitude: 15.27, owner: owner._id, tenant: tenant?._id || null,
});
const as = (actor, tenant = null) => ({
  Authorization: `Bearer ${jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

beforeAll(startFinancialMongo);
afterAll(stopFinancialMongo);

beforeEach(async () => {
  await Promise.all([RentalManagement.deleteMany({}), Property.deleteMany({}), IndividualSubscription.deleteMany({}), OrgMembership.deleteMany({}), User.deleteMany({})]);
  await IndividualSubscription.syncIndexes();
});

test('I01–I04 : la population individuelle est strictement tenant:null + owner exact', async () => {
  const [ownerA, ownerB] = await Promise.all([user(), user()]);
  const { tenant } = await createTenantFixture({ label: 'C210B X' });
  const [p1, p2, p3] = await Promise.all([
    property(ownerA, null, 'P1'), property(ownerB, null, 'P2'), property(ownerA, tenant, 'P3'),
  ]);
  await IndividualSubscription.create({ user: ownerA._id, plan: 'essentiel', status: 'active', modulesIncluded: ['location'] });

  await expect(individualRentalPropertyIds(ownerA._id)).resolves.toEqual([p1._id]);
  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerA._id })).resolves.toMatchObject({ scope: 'INDIVIDUAL' });
  await expect(assertIndividualRentalPropertyAccess({ property: p2, userId: ownerA._id })).rejects.toMatchObject({ code: 'INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', statusCode: 404 });
  await expect(assertIndividualRentalPropertyAccess({ property: p3, userId: ownerA._id })).rejects.toMatchObject({ code: 'INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', statusCode: 404 });
});

test('I05–I08 : entitlement requis et expiration sans suppression', async () => {
  const ownerA = await user();
  const p1 = await property(ownerA, null, 'P1');
  const rental = await RentalManagement.create({ property: p1._id, owner: ownerA._id, tenant: null, managementActivated: true });

  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerA._id })).rejects.toMatchObject({ code: 'INDIVIDUAL_ENTITLEMENT_REQUIRED' });
  const subscription = await IndividualSubscription.create({ user: ownerA._id, plan: 'essentiel', status: 'active', modulesIncluded: ['location'] });
  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerA._id })).resolves.toMatchObject({ scope: 'INDIVIDUAL' });
  subscription.status = 'past_due'; await subscription.save();
  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerA._id })).rejects.toMatchObject({ code: 'INDIVIDUAL_ENTITLEMENT_REQUIRED' });

  expect(await Property.exists({ _id: p1._id })).toBeTruthy();
  expect(await RentalManagement.exists({ _id: rental._id })).toBeTruthy();
});

test('I09–I10 : falsification ID/owner refusée même avec un abonnement valide', async () => {
  const [ownerA, ownerB] = await Promise.all([user(), user()]);
  const p1 = await property(ownerA, null, 'P1');
  await IndividualSubscription.create({ user: ownerB._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });
  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerB._id })).rejects.toMatchObject({ statusCode: 404 });
});

test('single-state : un owner canonique ne peut exploiter un portefeuille individuel parallèle', async () => {
  const ownerA = await user();
  const { tenant, bootstrap } = await createTenantFixture({ label: 'C210B canonical owner' });
  await organizationService.grantMembership({ userId: ownerA._id, orgUnitId: tenant.rootOrgUnit, roleInUnit: 'owner', actor: bootstrap });
  await OrgMembership.updateOne({ user: ownerA._id, orgUnit: tenant.rootOrgUnit }, { $set: { businessRole: 'Admin' } });
  const p1 = await property(ownerA, null, 'P1');
  await property(ownerA, tenant, 'P3');
  await IndividualSubscription.create({ user: ownerA._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] });

  await expect(individualRentalPropertyIds(ownerA._id)).rejects.toMatchObject({ code: 'INDIVIDUAL_ORGANIZATION_STATE_CONFLICT', statusCode: 409 });
  await expect(assertIndividualRentalPropertyAccess({ property: p1, userId: ownerA._id })).rejects.toMatchObject({ code: 'INDIVIDUAL_ORGANIZATION_STATE_CONFLICT', statusCode: 409 });
  expect((await Property.findById(p1._id).lean()).tenant).toBeNull();
});

test('HTTP : scope individuel explicite, header tenant résiduel ignoré et IDOR bloqué', async () => {
  const [ownerA, ownerB] = await Promise.all([user(), user()]);
  const { tenant } = await createTenantFixture({ label: 'C210B HTTP X' });
  const [p1, p2, p3] = await Promise.all([
    property(ownerA, null, 'P1'), property(ownerB, null, 'P2'), property(ownerA, tenant, 'P3'),
  ]);
  const [r1, r2, r3] = await Promise.all([
    RentalManagement.create({ property: p1._id, owner: ownerA._id, tenant: null, managementActivated: true }),
    RentalManagement.create({ property: p2._id, owner: ownerB._id, tenant: null, managementActivated: true }),
    RentalManagement.create({ property: p3._id, owner: ownerA._id, tenant: tenant._id, managementActivated: true }),
  ]);
  await Promise.all([ownerA, ownerB].map((actor) => IndividualSubscription.create({ user: actor._id, plan: 'premium', status: 'active', modulesIncluded: ['location'] })));

  const list = await request(app).get('/api/rental-management?scope=individual').set(as(ownerA, tenant));
  expect(list.status).toBe(200);
  expect(list.body.data.rentals.map((row) => row._id)).toEqual([String(r1._id)]);

  expect((await request(app).get(`/api/rental-management/${r1._id}?scope=individual`).set(as(ownerA, tenant))).status).toBe(200);
  expect((await request(app).get(`/api/rental-management/${r2._id}?scope=individual`).set(as(ownerA, tenant))).status).toBe(404);
  expect((await request(app).get(`/api/rental-management/${r3._id}?scope=individual`).set(as(ownerA, tenant))).status).toBe(404);
  expect((await request(app).patch(`/api/rental-management/${r1._id}?scope=individual`).set(as(ownerB)).send({ monthlyRent: 1 })).status).toBe(404);

  const managedByOrganization = await request(app).get('/api/rental-management/owner/my').set(as(ownerA));
  expect(managedByOrganization.status).toBe(200);
  expect(managedByOrganization.body.data.rentals.map((row) => row._id)).toEqual([String(r3._id)]);
});
