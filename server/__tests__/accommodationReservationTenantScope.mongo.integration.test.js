const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const RatePlan = require('../models/RatePlan');
const Reservation = require('../models/AccommodationReservation');
const NightLock = require('../models/AccommodationNightLock');
const Notification = require('../models/Notification');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const routes = require('../routes/accommodationReservationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
const app = express(); app.use(express.json()); app.use('/api/accommodation-reservations', routes); app.use(errorHandler);
const bearer = (user, tenant) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`, ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}) });
const endpoint = { confirmed: 'confirm', cancelled: 'cancel', checked_in: 'check-in', checked_out: 'check-out', no_show: 'no-show' };
const initial = { confirmed: 'pending', cancelled: 'confirmed', checked_in: 'confirmed', checked_out: 'checked_in', no_show: 'confirmed' };
let tenantA; let tenantB; let adminA; let adminB; let guest; let operator; let proprietor; let accommodationA; let accommodationB;
let reservationSequence = 0;

async function makeAccommodation(tenant, owner, suffix) {
  const property = await Property.create({ tenant: tenant._id, title: `Villa ${suffix}`, description: 'Description complète destinée au test de frontière tenant.', pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 35000, address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28, images: ['https://example.test/villa.jpg'], surface: 100, statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id });
  const accommodation = await Accommodation.create({ tenant: tenant._id, property: property._id, accommodationType: 'villa_meublee', publicationStatus: 'publie', capacity: { maxAdults: 4, maxChildren: 2 }, createdBy: owner._id });
  await RatePlan.create({ accommodation: accommodation._id, mode: 'nightly', amount: 35000, currency: 'XAF', active: true, createdBy: owner._id });
  return accommodation;
}

async function makeReservation(tenant, accommodation, owner, target) {
  reservationSequence += 1;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const from = target === 'checked_in' ? today : new Date(today.getTime() + (10 + reservationSequence * 3) * 86400000);
  const to = new Date(from.getTime() + 2 * 86400000);
  return Reservation.create({ tenant: tenant._id, accommodation: accommodation._id, guest: guest._id, owner: owner._id, checkInDate: from, checkOutDate: to, nights: 2, guestCount: 1, adults: 1, status: initial[target], subtotal: 70000, total: 70000, createdBy: guest._id });
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Reservation A' }); const fixtureB = await createTenantFixture({ label: 'Reservation B' });
  tenantA = fixtureA.tenant; tenantB = fixtureB.tenant;
  ({ user: adminA } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } }));
  ({ user: adminB } = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } }));
  guest = await User.create({ name: 'Reservation Guest', email: 'reservation-scope-guest@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  operator = await User.create({ name: 'Reservation Operator', email: 'reservation-scope-operator@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  proprietor = await User.create({ name: 'Reservation Owner', email: 'reservation-scope-owner@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  await grantOperator({ userId: operator._id, actor: adminA, reason: 'Certification reservation tenant', capabilities: [] });
  accommodationA = await makeAccommodation(tenantA, adminA, 'A'); accommodationB = await makeAccommodation(tenantB, adminB, 'B');
});
afterAll(stopFinancialMongo);

describe.each(Object.keys(endpoint))('%s — frontière tenant avant effets de bord', (target) => {
  test.each([
    ['A→B', () => adminA, () => tenantA, () => tenantB, () => accommodationB, () => adminB],
    ['B→A', () => adminB, () => tenantB, () => tenantA, () => accommodationA, () => adminA],
  ])('%s est masqué et ne mute rien', async (_label, actor, actorTenant, resourceTenant, accommodation, owner) => {
    const reservation = await makeReservation(resourceTenant(), accommodation(), owner(), target);
    if (target === 'cancelled' || target === 'no_show') await NightLock.create({ accommodation: reservation.accommodation, date: reservation.checkInDate, sourceType: 'reservation', sourceId: reservation._id, operationToken: new mongoose.Types.ObjectId() });
    const before = { notifications: await Notification.countDocuments(), documents: await FinancialDocument.countDocuments(), payments: await FinancialPayment.countDocuments(), allocations: await PaymentAllocation.countDocuments(), ledger: await FinancialLedgerEntry.countDocuments(), locks: await NightLock.countDocuments({ sourceId: reservation._id }), accommodation: await Accommodation.findById(reservation.accommodation).lean() };
    const res = await request(app).post(`/api/accommodation-reservations/${reservation._id}/${endpoint[target]}`).set(bearer(actor(), actorTenant())).send({ reason: 'scope test' });
    expect(res.status).toBe(404);
    const stored = await Reservation.findById(reservation._id);
    expect(stored.status).toBe(initial[target]); expect(stored.workflowHistory).toHaveLength(0);
    expect(await Notification.countDocuments()).toBe(before.notifications); expect(await FinancialDocument.countDocuments()).toBe(before.documents);
    expect(await FinancialPayment.countDocuments()).toBe(before.payments); expect(await PaymentAllocation.countDocuments()).toBe(before.allocations); expect(await FinancialLedgerEntry.countDocuments()).toBe(before.ledger);
    expect(await NightLock.countDocuments({ sourceId: reservation._id })).toBe(before.locks);
    expect(await Accommodation.findById(reservation.accommodation).lean()).toMatchObject({ publicationStatus: before.accommodation.publicationStatus, active: before.accommodation.active });
  });

  test.each([
    ['A→A', () => adminA, () => tenantA, () => accommodationA],
    ['B→B', () => adminB, () => tenantB, () => accommodationB],
  ])('%s conserve la mutation autorisée', async (_label, actor, tenant, accommodation) => {
    const reservation = await makeReservation(tenant(), accommodation(), actor(), target);
    const res = await request(app).post(`/api/accommodation-reservations/${reservation._id}/${endpoint[target]}`).set(bearer(actor(), tenant())).send({ reason: 'authorized test' });
    expect(res.status).toBe(200);
    expect((await Reservation.findById(reservation._id)).status).toBe(target);
  });
});

test('un Admin sans tenant échoue fermé avant lecture de la réservation', async () => {
  const outsider = await User.create({ name: 'No tenant', email: 'reservation-no-tenant@example.test', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const reservation = await makeReservation(tenantA, accommodationA, adminA, 'cancelled');
  const res = await request(app).post(`/api/accommodation-reservations/${reservation._id}/cancel`).set({ Authorization: `Bearer ${jwt.sign({ id: outsider._id, tokenVersion: 0 }, process.env.JWT_SECRET)}` });
  expect(res.status).toBe(403); expect((await Reservation.findById(reservation._id)).status).toBe('confirmed');
});

describe('PlatformOperator et ownership', () => {
  test('PlatformOperator global peut muter les réservations A et B', async () => {
    for (const [tenant, accommodation, owner] of [[tenantA, accommodationA, adminA], [tenantB, accommodationB, adminB]]) {
      const reservation = await makeReservation(tenant, accommodation, owner, 'cancelled');
      const res = await request(app).post(`/api/accommodation-reservations/${reservation._id}/cancel`).set(bearer(operator)).send({ reason: 'global operator' });
      expect(res.status).toBe(200); expect((await Reservation.findById(reservation._id)).status).toBe('cancelled');
    }
  });

  test.each([
    ['A', () => tenantA, () => accommodationA, () => adminA, () => tenantB, () => accommodationB, () => adminB],
    ['B', () => tenantB, () => accommodationB, () => adminB, () => tenantA, () => accommodationA, () => adminA],
  ])('PlatformOperator scoped %s reste isolé', async (_label, scope, ownAccommodation, ownOwner, otherTenant, otherAccommodation, otherOwner) => {
    const allowed = await makeReservation(scope(), ownAccommodation(), ownOwner(), 'cancelled');
    const denied = await makeReservation(otherTenant(), otherAccommodation(), otherOwner(), 'cancelled');
    expect((await request(app).post(`/api/accommodation-reservations/${allowed._id}/cancel`).set(bearer(operator, scope())).send({ reason: 'scoped operator' })).status).toBe(200);
    expect((await request(app).post(`/api/accommodation-reservations/${denied._id}/cancel`).set(bearer(operator, scope())).send({ reason: 'scoped operator' })).status).toBe(404);
    expect((await Reservation.findById(denied._id)).status).toBe('confirmed');
  });

  test('Proprietaire conserve son ownership sans tenant', async () => {
    const own = await makeReservation(tenantA, accommodationA, proprietor, 'cancelled');
    const other = await makeReservation(tenantA, accommodationA, adminA, 'cancelled');
    expect((await request(app).post(`/api/accommodation-reservations/${own._id}/cancel`).set(bearer(proprietor)).send({ reason: 'owner' })).status).toBe(200);
    expect((await request(app).post(`/api/accommodation-reservations/${other._id}/cancel`).set(bearer(proprietor)).send({ reason: 'not owner' })).status).toBe(403);
  });
});
