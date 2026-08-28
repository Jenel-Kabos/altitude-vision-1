const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const RoomCategory = require('../models/RoomCategory');
const HotelReservation = require('../models/HotelReservation');
const routes = require('../routes/hotelReservationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotel-reservations', routes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let operator;
let client;
let proprietor;
let hotelA;
let hotelB;
let reservationsA;
let reservationsB;

async function makeReservation({ tenant, hotel, roomCategory, suffix, status, amount, createdAt }) {
  return HotelReservation.create({
    tenant: tenant._id,
    reference: `HZ05-${suffix}`,
    hotel: hotel._id,
    roomCategory: roomCategory._id,
    guest: {
      firstName: `Guest-${suffix}`,
      lastName: 'Synthetic',
      email: `guest-${suffix.toLowerCase()}@example.test`,
      phone: `+2420000${suffix}`,
      country: 'CG',
    },
    checkInDate: new Date('2028-06-01T12:00:00.000Z'),
    checkOutDate: new Date('2028-06-03T12:00:00.000Z'),
    roomsCount: 1,
    adults: 2,
    children: 0,
    unitPrice: amount / 2,
    subtotal: amount,
    totalAmount: amount,
    currency: 'XAF',
    status,
    source: 'admin_dashboard',
    specialRequests: `SPECIAL-${suffix}`,
    createdAt,
    updatedAt: createdAt,
  });
}

const ids = (response) => response.body.data.reservations.map((item) => String(item._id));
const expectedIds = (items) => items.map((item) => String(item._id));

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'HZ05 A' });
  const fixtureB = await createTenantFixture({ label: 'HZ05 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  operator = await User.create({ name: 'HZ05 Operator', email: 'hz05-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  client = await User.create({ name: 'HZ05 Client', email: 'hz05-client@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  proprietor = await User.create({ name: 'HZ05 Owner', email: 'hz05-owner@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HZ05 admin lists certification', capabilities: [] });

  hotelA = await createTenantHotel({ tenant: tenantA, manager: adminA, createdBy: adminA, overrides: { name: 'HZ05 Hotel A' } });
  hotelB = await createTenantHotel({ tenant: tenantB, manager: adminB, createdBy: adminB, overrides: { name: 'HZ05 Hotel B' } });
  const categoryA = await RoomCategory.create({ hotel: hotelA._id, name: 'HZ05 Category A', createdBy: adminA._id });
  const categoryB = await RoomCategory.create({ hotel: hotelB._id, name: 'HZ05 Category B', createdBy: adminB._id });

  reservationsA = [
    await makeReservation({ tenant: tenantA, hotel: hotelA, roomCategory: categoryA, suffix: 'A1', status: 'pending', amount: 111, createdAt: new Date('2028-01-01') }),
    await makeReservation({ tenant: tenantA, hotel: hotelA, roomCategory: categoryA, suffix: 'A2', status: 'confirmed', amount: 112, createdAt: new Date('2028-01-02') }),
  ];
  reservationsB = [
    await makeReservation({ tenant: tenantB, hotel: hotelB, roomCategory: categoryB, suffix: 'B1', status: 'pending', amount: 777, createdAt: new Date('2028-02-01') }),
    await makeReservation({ tenant: tenantB, hotel: hotelB, roomCategory: categoryB, suffix: 'B2', status: 'confirmed', amount: 778, createdAt: new Date('2028-02-02') }),
    await makeReservation({ tenant: tenantB, hotel: hotelB, roomCategory: categoryB, suffix: 'B3', status: 'pending', amount: 779, createdAt: new Date('2028-02-03') }),
  ];
});

afterAll(stopFinancialMongo);

test.each([
  ['A', () => adminA, () => tenantA, () => reservationsA],
  ['B', () => adminB, () => tenantB, () => reservationsB],
])('Admin %s ne reçoit que son tenant sur /admin/list, total compris', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/hotel-reservations/admin/list').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set(expectedIds(expected())));
  expect(response.body.data.total).toBe(expected().length);
  expect(response.body.data).toMatchObject({ page: 1, limit: 20 });
});

test.each([
  ['A', () => adminA, () => tenantA, () => reservationsA.filter((item) => item.status === 'pending')],
  ['B', () => adminB, () => tenantB, () => reservationsB.filter((item) => item.status === 'pending')],
])('Admin %s ne reçoit que ses pending sur /status/pending', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/hotel-reservations/status/pending').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set(expectedIds(expected())));
});

test('Admin A ne peut pas cibler hotel B ni injecter tenant B', async () => {
  const byHotel = await request(app).get(`/api/hotel-reservations/admin/list?hotelId=${hotelB._id}`).set(bearer(adminA, tenantA));
  expect(byHotel.status).toBe(200);
  expect(byHotel.body.data).toMatchObject({ reservations: [], total: 0, page: 1, limit: 20 });

  const injectedTenant = await request(app).get(`/api/hotel-reservations/admin/list?tenant=${tenantB._id}`).set(bearer(adminA, tenantA));
  expect(injectedTenant.status).toBe(200);
  expect(new Set(ids(injectedTenant))).toEqual(new Set(expectedIds(reservationsA)));
  expect(injectedTenant.body.data.total).toBe(2);
});

test.each(['Admin', 'GestionnaireImmobilier', 'Collaborateur'])(
  'rôle autorisé %s sans tenant échoue fermé sur les deux listes',
  async (role) => {
    const user = await User.create({ name: `HZ05 ${role}`, email: `hz05-${role.toLowerCase()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
    for (const path of ['/admin/list', '/status/pending']) {
      const response = await request(app).get(`/api/hotel-reservations${path}`).set(bearer(user));
      expect(response.status).toBe(403);
      expect(response.body.data?.reservations).toBeUndefined();
    }
  },
);

test('PlatformOperator global conserve records et total globaux', async () => {
  const list = await request(app).get('/api/hotel-reservations/admin/list').set(bearer(operator));
  expect(list.status).toBe(200);
  expect(new Set(ids(list))).toEqual(new Set(expectedIds([...reservationsA, ...reservationsB])));
  expect(list.body.data.total).toBe(5);

  const pending = await request(app).get('/api/hotel-reservations/status/pending').set(bearer(operator));
  expect(new Set(ids(pending))).toEqual(new Set(expectedIds([...reservationsA, ...reservationsB].filter((item) => item.status === 'pending'))));
});

test.each([
  ['A', () => tenantA, () => reservationsA],
  ['B', () => tenantB, () => reservationsB],
])('PlatformOperator scoped %s reste isolé sur les deux listes', async (_label, tenant, expected) => {
  const list = await request(app).get('/api/hotel-reservations/admin/list').set(bearer(operator, tenant()));
  expect(list.status).toBe(200);
  expect(new Set(ids(list))).toEqual(new Set(expectedIds(expected())));
  expect(list.body.data.total).toBe(expected().length);

  const pending = await request(app).get('/api/hotel-reservations/status/pending').set(bearer(operator, tenant()));
  expect(new Set(ids(pending))).toEqual(new Set(expectedIds(expected().filter((item) => item.status === 'pending'))));
});

test('PII, demandes spéciales et montants B ne fuient pas vers Admin A', async () => {
  const response = await request(app).get('/api/hotel-reservations/admin/list').set(bearer(adminA, tenantA));
  const serialized = JSON.stringify(response.body);
  expect(serialized).not.toContain('Guest-B');
  expect(serialized).not.toContain('SPECIAL-B');
  expect(serialized).not.toContain('777');
  expect(serialized).not.toContain('778');
  expect(serialized).not.toContain('779');
});

test('filtres, recherche, pagination, sort et populate restent composés avec le tenant', async () => {
  const response = await request(app)
    .get('/api/hotel-reservations/admin/list?status=pending&search=HZ05-A1&page=1&limit=1')
    .set(bearer(adminA, tenantA));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([String(reservationsA[0]._id)]);
  expect(response.body.data).toMatchObject({ total: 1, page: 1, limit: 1 });
  expect(response.body.data.reservations[0].hotel.name).toBe('HZ05 Hotel A');
  expect(response.body.data.reservations[0].roomCategory.name).toBe('HZ05 Category A');
});

test.each([['Client', () => client], ['Proprietaire', () => proprietor]])('%s reste refusé par le RBAC sur les deux listes', async (_role, actor) => {
  for (const path of ['/admin/list', '/status/pending']) {
    expect((await request(app).get(`/api/hotel-reservations${path}`).set(bearer(actor()))).status).toBe(403);
  }
});

test.each(['/admin/list', '/status/pending'])('anonymous reste refusé sur GET %s', async (path) => {
  expect((await request(app).get(`/api/hotel-reservations${path}`)).status).toBe(401);
});

test('les deux listes sont strictement read-only', async () => {
  const before = await HotelReservation.find().sort({ _id: 1 }).lean();
  expect((await request(app).get('/api/hotel-reservations/admin/list').set(bearer(adminA, tenantA))).status).toBe(200);
  expect((await request(app).get('/api/hotel-reservations/status/pending').set(bearer(adminA, tenantA))).status).toBe(200);
  expect(await HotelReservation.find().sort({ _id: 1 }).lean()).toEqual(before);
});
