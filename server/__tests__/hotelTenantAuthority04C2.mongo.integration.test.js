const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { createFullAccommodation } = require('../services/accommodationService');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotels', require('../routes/hotelRoutes'));
app.use('/api/accommodations', require('../routes/accommodationRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (role, label) => User.create({
  name: `C2 Hotel ${label} ${++seq}`,
  email: `c2-hotel-${label}-${seq}-${Date.now()}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
});

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  S.a = await createTenantFixture({ label: 'C2 Hotel A', withAdminMembership: true });
  S.b = await createTenantFixture({ label: 'C2 Hotel B', withAdminMembership: true });
  S.hotelA = await Hotel.create({ name: 'C2 Hotel A resource', tenant: S.a.tenant._id, manager: S.a.bootstrap._id, createdBy: S.a.bootstrap._id, publicationStatus: 'publie', active: true });
  S.hotelB = await Hotel.create({ name: 'C2 Hotel B resource', tenant: S.b.tenant._id, manager: S.b.bootstrap._id, createdBy: S.b.bootstrap._id, publicationStatus: 'publie', active: true });

  S.granting = await makeUser('Admin', 'granting');
  await grantOperator({ userId: S.granting._id, actor: S.a.bootstrap, reason: 'C2 fixture', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
});
afterAll(stopFinancialMongo);

describe('PA-04C2 — PlatformOperator in TENANT needs the exact Hotel capability', () => {
  test('support-only operator cannot read or deactivate a Hotel after selecting its tenant', async () => {
    const support = await makeUser('Admin', 'support-only');
    await grantOperator({ userId: support._id, actor: S.granting, reason: 'support only', capabilities: ['platform.support.read'] });

    const read = await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(support, S.a.tenant));
    const mutate = await request(app).patch(`/api/hotels/${S.hotelA._id}/deactivate`).set(bearer(support, S.a.tenant));

    expect(read.status).toBe(403);
    expect(mutate.status).toBe(403);
    expect((await Hotel.findById(S.hotelA._id).lean()).active).toBe(true);
  });

  test('read capability reads but cannot mutate; manage capability can mutate', async () => {
    const reader = await makeUser('Admin', 'reader');
    await grantOperator({ userId: reader._id, actor: S.granting, reason: 'reader', capabilities: ['platform.hotels.read'] });
    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(reader, S.a.tenant))).status).toBe(200);
    expect((await request(app).patch(`/api/hotels/${S.hotelA._id}/deactivate`).set(bearer(reader, S.a.tenant))).status).toBe(403);

    const manager = await makeUser('Admin', 'platform-manager');
    await grantOperator({ userId: manager._id, actor: S.granting, reason: 'manager', capabilities: ['platform.hotels.read', 'platform.hotels.manage'] });
    expect((await request(app).patch(`/api/hotels/${S.hotelA._id}/deactivate`).set(bearer(manager, S.a.tenant))).status).toBe(200);
  });
});

describe('PA-04C2 — TENANT Hotel authority comes from OrgMembership.businessRole', () => {
  test('global non-Admin with tenant businessRole Admin may read and mutate', async () => {
    const tenantAdmin = await makeUser('Client', 'tenant-admin');
    await addTenantMember({ tenant: S.a.tenant, user: tenantAdmin, bootstrap: S.a.bootstrap, businessRole: 'Admin' });
    await Hotel.updateOne({ _id: S.hotelA._id }, { $set: { active: true, status: 'actif' } });

    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(tenantAdmin))).status).toBe(200);
    expect((await request(app).patch(`/api/hotels/${S.hotelA._id}/deactivate`).set(bearer(tenantAdmin))).status).toBe(200);
  });

  test('global Admin without membership receives no tenant Hotel authority', async () => {
    const legacyAdmin = await makeUser('Admin', 'legacy-admin');
    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(legacyAdmin))).status).toBe(403);
  });

  test('CommunityManager membership receives no Hotel administration authority by default', async () => {
    const community = await makeUser('CommunityManager', 'community');
    await addTenantMember({ tenant: S.a.tenant, user: community, bootstrap: S.a.bootstrap, businessRole: 'CommunityManager' });
    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(community))).status).toBe(403);
  });

  test('cross-tenant Hotel id is concealed as 404 while same-tenant insufficient authority remains 403', async () => {
    const collaborator = await makeUser('Client', 'collaborator');
    await addTenantMember({ tenant: S.a.tenant, user: collaborator, bootstrap: S.a.bootstrap, businessRole: 'Collaborateur' });
    expect((await request(app).get(`/api/hotels/${S.hotelB._id}`).set(bearer(collaborator))).status).toBe(404);

    const community = await makeUser('CommunityManager', 'community-local');
    await addTenantMember({ tenant: S.a.tenant, user: community, bootstrap: S.a.bootstrap, businessRole: 'CommunityManager' });
    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(community))).status).toBe(403);
  });
});

describe('PA-04C2 — linked resource provenance is direct', () => {
  test('owner Accommodation copies Property.tenant instead of requester tenant context', async () => {
    let property;
    try {
      property = await Property.create({
        title: 'C2 personal furnished property', description: 'Personal property', price: 1000,
        owner: S.a.bootstrap._id, tenant: null, status: 'hebergement', category: 'hebergement',
        pole: 'Altimmo', type: 'Appartement', surface: 50, latitude: -4.26, longitude: 15.28,
        address: { arrondissement: 'Centre', city: 'Brazzaville' }, images: ['https://example.test/c2.jpg'], availability: 'Disponible',
      });
      const res = await request(app).post('/api/accommodations').set(bearer(S.a.bootstrap)).send({
        property: String(property._id), accommodationType: 'appartement_meuble',
      });
      expect(res.status).toBe(201);
      expect((await Accommodation.findOne({ property: property._id }).lean()).tenant).toBeNull();
    } finally {
      if (property) {
        await Accommodation.deleteMany({ property: property._id });
        await Property.deleteOne({ _id: property._id });
      }
    }
  });

  test('existing Hotel from Tenant B cannot be linked to a new Tenant A Property/Accommodation', async () => {
    const before = await Property.countDocuments();
    await expect(createFullAccommodation({
      propertyData: {
        title: 'Cross tenant attempt', description: 'blocked', price: 1000, owner: S.a.bootstrap._id,
        status: 'hebergement', pole: 'Altimmo', type: 'Appartement', surface: 50, latitude: -4.26, longitude: 15.28,
        address: { arrondissement: 'Centre', city: 'Brazzaville' }, images: ['https://example.test/cross.jpg'], availability: 'Disponible',
      },
      accommodationData: { accommodationType: 'hotel' }, rateData: null,
      hotelInput: { mode: 'existing', hotelId: String(S.hotelB._id) },
      actingUser: { id: String(S.a.bootstrap._id), platformTenant: S.a.tenant },
    })).rejects.toMatchObject({ statusCode: 404, code: 'HOTEL_TENANT_MISMATCH' });
    expect(await Property.countDocuments()).toBe(before);
  });
});
