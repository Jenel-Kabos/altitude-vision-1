const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Reservation = require('../models/AccommodationReservation');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/accommodationReservationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodation-reservations', routes);
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
let proprietor;
let client;
let outsider;
let accommodationA;
let accommodationB;
let reservationA1;
let reservationA2;
let reservationB1;
let reservationB2;

async function makeAccommodation(tenant, owner, suffix) {
  const property = await Property.create({
    tenant: tenant._id,
    title: `HZ03 Villa ${suffix}`,
    description: 'Hébergement sentinelle pour la liste multi-tenant.',
    pole: 'Altimmo',
    type: 'Villa',
    status: 'hebergement',
    price: 35000,
    address: { arrondissement: 'Centre', city: 'Brazzaville' },
    latitude: -4.26,
    longitude: 15.28,
    images: ['https://example.test/hz03.jpg'],
    surface: 100,
    statusAdmin: 'Validée',
    availability: 'Disponible',
    owner: owner._id,
  });
  return Accommodation.create({
    tenant: tenant._id,
    property: property._id,
    accommodationType: 'villa_meublee',
    publicationStatus: 'publie',
    capacity: { maxAdults: 4, maxChildren: 2 },
    createdBy: owner._id,
  });
}

async function makeReservation({ tenant, accommodation, owner, guest, suffix, status = 'pending', createdAt }) {
  return Reservation.create({
    tenant: tenant._id,
    accommodation: accommodation._id,
    guest: guest._id,
    owner: owner._id,
    checkInDate: '2028-09-01',
    checkOutDate: '2028-09-03',
    nights: 2,
    guestCount: 1,
    adults: 1,
    status,
    specialRequests: `HZ03-${suffix}`,
    subtotal: 70000,
    total: 70000,
    createdBy: guest._id,
    createdAt,
    updatedAt: createdAt,
  });
}

const ids = (response) => response.body.data.reservations.map((item) => String(item._id));

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'HZ03 A' });
  const fixtureB = await createTenantFixture({ label: 'HZ03 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  operator = await User.create({ name: 'HZ03 Operator', email: 'hz03-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  proprietor = await User.create({ name: 'HZ03 Owner', email: 'hz03-owner@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  client = await User.create({ name: 'HZ03 Client', email: 'hz03-client@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  outsider = await User.create({ name: 'HZ03 Outsider', email: 'hz03-outsider@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Prestataire', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'HZ03 list certification', capabilities: [] });
  accommodationA = await makeAccommodation(tenantA, proprietor, 'A');
  accommodationB = await makeAccommodation(tenantB, adminB, 'B');
  reservationA1 = await makeReservation({ tenant: tenantA, accommodation: accommodationA, owner: proprietor, guest: client, suffix: 'A1', status: 'pending', createdAt: new Date('2028-01-01') });
  reservationA2 = await makeReservation({ tenant: tenantA, accommodation: accommodationA, owner: proprietor, guest: outsider, suffix: 'A2', status: 'confirmed', createdAt: new Date('2028-01-02') });
  reservationB1 = await makeReservation({ tenant: tenantB, accommodation: accommodationB, owner: adminB, guest: client, suffix: 'B1', status: 'pending', createdAt: new Date('2028-01-03') });
  reservationB2 = await makeReservation({ tenant: tenantB, accommodation: accommodationB, owner: adminB, guest: outsider, suffix: 'B2', status: 'confirmed', createdAt: new Date('2028-01-04') });
});

afterAll(stopFinancialMongo);

test.each(['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'])(
  'staff %s sans tenant échoue fermé au lieu de recevoir la liste globale',
  async (role) => {
    const user = await User.create({ name: `HZ03 ${role}`, email: `hz03-${role.toLowerCase()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
    const response = await request(app).get('/api/accommodation-reservations').set(bearer(user));
    if (response.status === 200) {
      expect(new Set(ids(response))).toEqual(new Set([reservationA1, reservationA2, reservationB1, reservationB2].map((item) => String(item._id))));
      expect(response.body.data.total).toBe(4);
    }
    expect(response.status).toBe(403);
    expect(response.body.data?.reservations).toBeUndefined();
  },
);

test.each([
  ['Admin A', () => adminA, () => tenantA, () => [reservationA1, reservationA2]],
  ['Admin B', () => adminB, () => tenantB, () => [reservationB1, reservationB2]],
])('%s ne reçoit que son tenant', async (_label, actor, tenant, expected) => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(actor(), tenant()));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set(expected().map((item) => String(item._id))));
  expect(response.body.data).toMatchObject({ total: 2, page: 1, totalPages: 1 });
});

test('PlatformOperator global conserve la liste globale légitime', async () => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(operator));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set([reservationA1, reservationA2, reservationB1, reservationB2].map((item) => String(item._id))));
});

test.each([
  ['A', () => tenantA, () => [reservationA1, reservationA2]],
  ['B', () => tenantB, () => [reservationB1, reservationB2]],
])('PlatformOperator scoped %s reste isolé', async (_label, tenant, expected) => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(operator, tenant()));
  expect(response.status).toBe(200);
  expect(new Set(ids(response))).toEqual(new Set(expected().map((item) => String(item._id))));
});

test('Proprietaire conserve uniquement ses réservations par ownership', async () => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(proprietor));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([String(reservationA2._id), String(reservationA1._id)]);
});

test('Client conserve uniquement ses réservations comme guest', async () => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(client));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([String(reservationB1._id), String(reservationA1._id)]);
});

test('un autre rôle authentifié conserve le contrat guest historique', async () => {
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(outsider));
  expect(response.status).toBe(200);
  expect(ids(response)).toEqual([String(reservationB2._id), String(reservationA2._id)]);
});

test('anonymous reste refusé', async () => {
  expect((await request(app).get('/api/accommodation-reservations')).status).toBe(401);
});

test('filtres, pagination, tri, populate et liste vide restent inchangés', async () => {
  const filtered = await request(app).get(`/api/accommodation-reservations?status=confirmed&accommodation=${accommodationA._id}&page=1&limit=1`).set(bearer(adminA, tenantA));
  expect(filtered.status).toBe(200);
  expect(ids(filtered)).toEqual([String(reservationA2._id)]);
  expect(filtered.body.data).toMatchObject({ total: 1, page: 1, totalPages: 1 });
  expect(filtered.body.data.reservations[0].accommodation.property.title).toBe('HZ03 Villa A');
  expect(filtered.body.data.reservations[0].guest.email).toBeTruthy();

  const empty = await request(app).get('/api/accommodation-reservations?status=checked_out').set(bearer(adminA, tenantA));
  expect(empty.status).toBe(200);
  expect(empty.body.data).toMatchObject({ reservations: [], total: 0, page: 1, totalPages: 0 });
});

test('la liste est strictement read-only', async () => {
  const before = await Reservation.find().sort({ _id: 1 }).lean();
  const response = await request(app).get('/api/accommodation-reservations').set(bearer(adminA, tenantA));
  expect(response.status).toBe(200);
  expect(await Reservation.find().sort({ _id: 1 }).lean()).toEqual(before);
});
