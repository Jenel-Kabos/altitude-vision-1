const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const Block = require('../models/AccommodationAvailabilityBlock');
const NightLock = require('../models/AccommodationNightLock');
const Reservation = require('../models/AccommodationReservation');
const Notification = require('../models/Notification');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', routes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let ownerA;
let ownerB;
let operator;
let accommodationA;
let accommodationB;

async function makeAccommodation(tenant, owner, suffix) {
  const property = await Property.create({
    tenant: tenant._id,
    title: `Calendar Villa ${suffix}`,
    description: 'Description complète destinée au test calendrier tenant.',
    pole: 'Altimmo',
    type: 'Villa',
    status: 'hebergement',
    price: 35000,
    address: { arrondissement: 'Centre', city: 'Brazzaville' },
    latitude: -4.26,
    longitude: 15.28,
    images: ['https://example.test/calendar-villa.jpg'],
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

async function makeBlock(accommodation, creator, offset = 0) {
  const startDate = new Date(Date.UTC(2032, 0, 10 + offset));
  const endDate = new Date(Date.UTC(2032, 0, 12 + offset));
  const block = await Block.create({ accommodation: accommodation._id, startDate, endDate, type: 'maintenance', reason: 'Sentinelle tenant', createdBy: creator._id });
  await NightLock.create({ accommodation: accommodation._id, date: startDate, sourceType: 'block', sourceId: block._id, operationToken: new mongoose.Types.ObjectId() });
  return block;
}

async function snapshot(accommodation, block) {
  return {
    blocks: await Block.countDocuments({ accommodation: accommodation._id }),
    targetBlock: block ? await Block.findById(block._id).lean() : null,
    locks: await NightLock.countDocuments({ accommodation: accommodation._id }),
    reservations: await Reservation.countDocuments({ accommodation: accommodation._id }),
    notifications: await Notification.countDocuments(),
    documents: await FinancialDocument.countDocuments(),
    payments: await FinancialPayment.countDocuments(),
    accommodation: await Accommodation.findById(accommodation._id).lean(),
  };
}

async function expectUnchanged(before, accommodation, block) {
  expect(await Block.countDocuments({ accommodation: accommodation._id })).toBe(before.blocks);
  expect(block ? await Block.findById(block._id).lean() : null).toEqual(before.targetBlock);
  expect(await NightLock.countDocuments({ accommodation: accommodation._id })).toBe(before.locks);
  expect(await Reservation.countDocuments({ accommodation: accommodation._id })).toBe(before.reservations);
  expect(await Notification.countDocuments()).toBe(before.notifications);
  expect(await FinancialDocument.countDocuments()).toBe(before.documents);
  expect(await FinancialPayment.countDocuments()).toBe(before.payments);
  expect(await Accommodation.findById(accommodation._id).lean()).toEqual(before.accommodation);
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Calendar A' });
  const fixtureB = await createTenantFixture({ label: 'Calendar B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  ownerA = await User.create({ name: 'Calendar Owner A', email: 'calendar-owner-a@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  ownerB = await User.create({ name: 'Calendar Owner B', email: 'calendar-owner-b@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  operator = await User.create({ name: 'Calendar Operator', email: 'calendar-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'Certification calendar tenant', capabilities: [] });
  accommodationA = await makeAccommodation(tenantA, ownerA, 'A');
  accommodationB = await makeAccommodation(tenantB, ownerB, 'B');
});

afterAll(stopFinancialMongo);

describe.each([
  ['A→B', () => adminA, () => tenantA, () => accommodationB, () => ownerB],
  ['B→A', () => adminB, () => tenantB, () => accommodationA, () => ownerA],
])('%s — refus tenant avant tout effet de bord', (_label, actor, scope, target, targetOwner) => {
  test('READ blocks est masqué', async () => {
    const block = await makeBlock(target(), targetOwner(), 0);
    const before = await snapshot(target(), block);
    const res = await request(app).get(`/api/accommodations/${target()._id}/availability-blocks`).set(bearer(actor(), scope()));
    expect(res.status).toBe(404);
    await expectUnchanged(before, target(), block);
  });

  test('READ calendar est masqué', async () => {
    const block = await makeBlock(target(), targetOwner(), 3);
    const before = await snapshot(target(), block);
    const res = await request(app).get(`/api/accommodations/${target()._id}/reservation-calendar`).query({ from: '2032-01-01', to: '2032-02-01' }).set(bearer(actor(), scope()));
    expect(res.status).toBe(404);
    await expectUnchanged(before, target(), block);
  });

  test('CREATE block est masqué', async () => {
    const before = await snapshot(target());
    const res = await request(app).post(`/api/accommodations/${target()._id}/availability-blocks`).set(bearer(actor(), scope())).send({ startDate: '2033-02-10', endDate: '2033-02-12', type: 'administrative', reason: 'Tentative cross-tenant' });
    expect(res.status).toBe(404);
    await expectUnchanged(before, target());
  });

  test('DELETE block est masqué', async () => {
    const block = await makeBlock(target(), targetOwner(), 6);
    const before = await snapshot(target(), block);
    const res = await request(app).delete(`/api/accommodations/${target()._id}/availability-blocks/${block._id}`).set(bearer(actor(), scope()));
    expect(res.status).toBe(404);
    await expectUnchanged(before, target(), block);
  });
});

describe('RBAC et comportements historiques préservés', () => {
  test.each([
    ['Admin A→A', () => adminA, () => tenantA, () => accommodationA],
    ['Admin B→B', () => adminB, () => tenantB, () => accommodationB],
  ])('%s peut lire et gérer les blocs', async (_label, actor, scope, target) => {
    const list = await request(app).get(`/api/accommodations/${target()._id}/availability-blocks`).set(bearer(actor(), scope()));
    expect(list.status).toBe(200);
    const calendar = await request(app).get(`/api/accommodations/${target()._id}/reservation-calendar`).query({ from: '2034-01-01', to: '2034-02-01' }).set(bearer(actor(), scope()));
    expect(calendar.status).toBe(200);
    const created = await request(app).post(`/api/accommodations/${target()._id}/availability-blocks`).set(bearer(actor(), scope())).send({ startDate: '2034-03-10', endDate: '2034-03-12', type: 'administrative', reason: 'Autorisé' });
    expect(created.status).toBe(201);
    const deleted = await request(app).delete(`/api/accommodations/${target()._id}/availability-blocks/${created.body.data.block._id}`).set(bearer(actor(), scope()));
    expect(deleted.status).toBe(204);
  });

  test('staff autorisé par rôle mais sans tenant échoue fermé', async () => {
    const outsider = await User.create({ name: 'Calendar No Tenant', email: 'calendar-no-tenant@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    const res = await request(app).get(`/api/accommodations/${accommodationA._id}/availability-blocks`).set(bearer(outsider));
    expect(res.status).toBe(403);
  });

  test('PlatformOperator global conserve read/create/delete sur A et B', async () => {
    for (const target of [accommodationA, accommodationB]) {
      expect((await request(app).get(`/api/accommodations/${target._id}/availability-blocks`).set(bearer(operator))).status).toBe(200);
      const created = await request(app).post(`/api/accommodations/${target._id}/availability-blocks`).set(bearer(operator)).send({ startDate: '2035-04-10', endDate: '2035-04-12', type: 'administrative', reason: 'Opérateur global' });
      expect(created.status).toBe(201);
      expect((await request(app).delete(`/api/accommodations/${target._id}/availability-blocks/${created.body.data.block._id}`).set(bearer(operator))).status).toBe(204);
    }
  });

  test.each([
    ['A', () => tenantA, () => accommodationA, () => accommodationB],
    ['B', () => tenantB, () => accommodationB, () => accommodationA],
  ])('PlatformOperator scoped %s est limité au tenant sélectionné', async (_label, scope, own, other) => {
    expect((await request(app).get(`/api/accommodations/${own()._id}/availability-blocks`).set(bearer(operator, scope()))).status).toBe(200);
    expect((await request(app).get(`/api/accommodations/${other()._id}/availability-blocks`).set(bearer(operator, scope()))).status).toBe(404);
  });

  test('Proprietaire conserve create/calendar/delete sur sa ressource et le refus ownership sur une autre', async () => {
    const created = await request(app).post(`/api/accommodations/${accommodationA._id}/availability-blocks`).set(bearer(ownerA)).send({ startDate: '2036-05-10', endDate: '2036-05-12', type: 'owner_block', reason: 'Owner' });
    expect(created.status).toBe(201);
    expect((await request(app).get(`/api/accommodations/${accommodationA._id}/reservation-calendar`).query({ from: '2036-05-01', to: '2036-06-01' }).set(bearer(ownerA))).status).toBe(200);
    expect((await request(app).delete(`/api/accommodations/${accommodationA._id}/availability-blocks/${created.body.data.block._id}`).set(bearer(ownerA))).status).toBe(204);
    expect((await request(app).post(`/api/accommodations/${accommodationB._id}/availability-blocks`).set(bearer(ownerA)).send({ startDate: '2036-06-10', endDate: '2036-06-12', type: 'owner_block' })).status).toBe(403);
  });
});
