// F-U2.14 — /checkout-financial-readiness pour le gestionnaire d'établissement
// (`hotel.manager`) : `assertReservationAccess` sortait par la branche « owner »
// sans propager le contexte tenant résolu, si bien que l'autorisation
// financière (capacité dérivée de l'OrgMembership) refusait toujours (403),
// alors que la route financière équivalente (requireTenantScope) l'autorisait.
// La correction ne fait que propager le contexte DÉJÀ résolu : la capacité
// financière et l'appartenance au tenant restent exigées (tests négatifs).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
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
let financeReader;
let noFinanceRole;
let readerReservation;
let noRoleReservation;

async function makeReservation({ tenant, hotel, roomCategory, suffix }) {
  return HotelReservation.create({
    tenant: tenant._id,
    reference: `FU214-${suffix}`,
    hotel: hotel._id,
    roomCategory: roomCategory._id,
    guest: { firstName: `Guest-${suffix}`, lastName: 'Synthetic', email: `fu214-${suffix.toLowerCase()}@example.test`, phone: '+242060000000', country: 'CG' },
    checkInDate: new Date('2028-06-01T12:00:00.000Z'),
    checkOutDate: new Date('2028-06-03T12:00:00.000Z'),
    roomsCount: 1, adults: 2, children: 0,
    unitPrice: 50000, subtotal: 100000, totalAmount: 100000, currency: 'XAF',
    status: 'confirmed',
    source: 'admin_dashboard',
  });
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'FU214 A' });
  const fixtureB = await createTenantFixture({ label: 'FU214 B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  ({ user: financeReader } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Proprietaire' }, businessRole: 'GestionnaireImmobilier' }));
  ({ user: noFinanceRole } = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Proprietaire' } }));
  const readerHotel = await createTenantHotel({ tenant: tenantA, manager: financeReader, createdBy: fixtureA.bootstrap, overrides: { name: 'FU214 Hotel lecteur' } });
  const noRoleHotel = await createTenantHotel({ tenant: tenantA, manager: noFinanceRole, createdBy: fixtureA.bootstrap, overrides: { name: 'FU214 Hotel sans rôle' } });
  const readerCategory = await RoomCategory.create({ hotel: readerHotel._id, name: 'FU214 Cat lecteur', createdBy: financeReader._id });
  const noRoleCategory = await RoomCategory.create({ hotel: noRoleHotel._id, name: 'FU214 Cat sans rôle', createdBy: noFinanceRole._id });
  readerReservation = await makeReservation({ tenant: tenantA, hotel: readerHotel, roomCategory: readerCategory, suffix: 'R1' });
  noRoleReservation = await makeReservation({ tenant: tenantA, hotel: noRoleHotel, roomCategory: noRoleCategory, suffix: 'N1' });
});

afterAll(stopFinancialMongo);

const readiness = (reservation, user, tenant) => request(app)
  .get(`/api/hotel-reservations/${reservation._id}/checkout-financial-readiness`)
  .set(bearer(user, tenant));

test('le gestionnaire avec lecture financière dans son tenant obtient l’état financier (200)', async () => {
  const response = await readiness(readerReservation, financeReader, tenantA);
  expect(response.status).toBe(200);
  expect(response.body.data.financialReadiness).toBeDefined();
});

test('le gestionnaire SANS rôle métier financier reste refusé (403)', async () => {
  const response = await readiness(noRoleReservation, noFinanceRole, tenantA);
  expect(response.status).toBe(403);
  expect(response.body.data?.financialReadiness).toBeUndefined();
});

test('un tenant étranger injecté par en-tête ne donne jamais accès', async () => {
  const response = await readiness(readerReservation, financeReader, tenantB);
  expect(response.status).not.toBe(200);
  expect(response.body.data?.financialReadiness).toBeUndefined();
});
