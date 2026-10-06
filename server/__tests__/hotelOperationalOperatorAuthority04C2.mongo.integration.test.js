// PLATFORM-ADMIN-04C2 — autorité opérationnelle Hotel : trois chemins distincts.
//
//   PLATFORM               : PlatformOperator actif + capability exacte (global)
//   OPÉRATEUR EN TENANT T  : PlatformOperator actif + capability exacte, strictement
//                            borné à Hotel.tenant === T (jamais B, jamais tenant:null),
//                            sans OrgMembership artificielle
//   TENANT MÉTIER          : OrgMembership active + businessRole (HOTEL_TENANT_ROLES)
//   SELF-SERVICE           : Hotel.manager / HotelStaffAssignment, jamais une autorité tenant
//
// Correspondance de capabilities (aucune capability nouvelle) : une capability
// opérationnelle `*.view` exige `platform.hotels.read` OU `platform.hotels.manage`
// (INVARIANTS.md « read/manage separation ») ; toute autre capability opérationnelle
// exige `platform.hotels.manage`.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const HotelReservation = require('../models/HotelReservation');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/hotels', require('../routes/hotelRoutes'));
app.use('/api/hotel-reservations', require('../routes/hotelReservationRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});
let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({ name: `HOA ${label} ${seq}`, email: `hoa-${label}-${seq}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
};
const makeReservation = (tenant, hotel, user) => HotelReservation.create({
  tenant: tenant?._id || null, hotel: hotel._id, roomCategory: new mongoose.Types.ObjectId(), guestUser: user._id,
  guest: { firstName: 'Ada', lastName: 'Lovelace', email: `ada-hoa-${Date.now()}-${seq}@example.test`, country: 'CG' },
  checkInDate: new Date('2026-11-01'), checkOutDate: new Date('2026-11-03'), roomsCount: 1, adults: 1,
  unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF',
  rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 },
  status: 'confirmed', source: 'owner_dashboard', createdBy: user._id,
});

const categories = (hotel, user, tenant) => request(app).get(`/api/hotels/${hotel._id}/room-categories`).set(bearer(user, tenant));
const createFaq = (hotel, user, tenant) => request(app).post(`/api/hotels/${hotel._id}/faq`).set(bearer(user, tenant)).send({ question: 'Horaires ?', answer: 'Toute la journée.' });
const reservation = (resa, user, tenant) => request(app).get(`/api/hotel-reservations/${resa._id}`).set(bearer(user, tenant));
const accessibleNames = async (user, tenant) => {
  const res = await request(app).get('/api/hotels/accessible').set(bearer(user, tenant));
  return { status: res.status, names: (res.body.data?.hotels || []).map((hotel) => hotel.name).sort() };
};

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  const fA = await createTenantFixture({ label: 'HOA Tenant A', withAdminMembership: true });
  const fB = await createTenantFixture({ label: 'HOA Tenant B', withAdminMembership: true });
  S.A = fA.tenant; S.B = fB.tenant; S.adminA = fA.bootstrap; S.adminB = fB.bootstrap;
  S.memberA = (await createTenantUser({ tenant: S.A, bootstrap: S.adminA, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' })).user;
  S.selfManager = await makeUser('Proprietaire', 'self-manager');

  S.hotelA = await createTenantHotel({ tenant: S.A, manager: S.adminA, createdBy: S.adminA, overrides: { name: 'HOA Hotel A' } });
  S.hotelB = await createTenantHotel({ tenant: S.B, manager: S.adminB, createdBy: S.adminB, overrides: { name: 'HOA Hotel B' } });
  // tenant:null géré par un membre de A : l'inférence (manager/createdBy) ne doit JAMAIS l'attribuer à A.
  S.hotelNullInferred = await Hotel.create({ name: 'HOA Hotel null inferred', tenant: null, manager: S.memberA._id, createdBy: S.memberA._id, publicationStatus: 'publie' });
  S.hotelNullSelf = await Hotel.create({ name: 'HOA Hotel null self', tenant: null, manager: S.selfManager._id, createdBy: S.selfManager._id, publicationStatus: 'publie' });
  S.resA = await makeReservation(S.A, S.hotelA, S.memberA);
  S.resB = await makeReservation(S.B, S.hotelB, S.adminB);

  S.full = await makeUser('Admin', 'full');
  await grantOperator({ userId: S.full._id, actor: S.adminA, reason: 'HOA full', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  S.reader = await makeUser('Collaborateur', 'reader');
  await grantOperator({ userId: S.reader._id, actor: S.full, reason: 'HOA reader', capabilities: ['platform.hotels.read'] });
  S.manager = await makeUser('Collaborateur', 'manager');
  await grantOperator({ userId: S.manager._id, actor: S.full, reason: 'HOA manager', capabilities: ['platform.hotels.manage'] });
  S.support = await makeUser('Admin', 'support');
  await grantOperator({ userId: S.support._id, actor: S.full, reason: 'HOA support', capabilities: ['platform.support.read'] });

  S.tenantAdminCanonical = (await createTenantUser({ tenant: S.A, bootstrap: S.adminA, overrides: { role: 'Client' }, businessRole: 'Admin' })).user;
  S.gestionnaire = (await createTenantUser({ tenant: S.A, bootstrap: S.adminA, overrides: { role: 'GestionnaireImmobilier' }, businessRole: 'GestionnaireImmobilier' })).user;
  S.legacyGestionnaire = (await createTenantUser({ tenant: S.A, bootstrap: S.adminA, overrides: { role: 'GestionnaireImmobilier' } })).user;
  S.legacyAdmin = (await createTenantUser({ tenant: S.A, bootstrap: S.adminA, overrides: { role: 'Admin' } })).user;
  S.tenantsBefore = await Hotel.find({}).select('tenant').lean();
});
afterAll(stopFinancialMongo);

describe('PLATFORM — opérateur complet', () => {
  test('lecture globale : Hotel A, Hotel tenant:null (contrat PA-04C) et réservation A', async () => {
    expect((await request(app).get(`/api/hotels/${S.hotelA._id}`).set(bearer(S.full))).status).toBe(200);
    expect((await request(app).get(`/api/hotels/${S.hotelNullInferred._id}`).set(bearer(S.full))).status).toBe(200);
    expect((await reservation(S.resA, S.full)).status).toBe(200);
  });
});

describe('Opérateur en vue TENANT — capability exacte, strictement borné au tenant sélectionné', () => {
  test('R2 — platform.hotels.read + Tenant A → catégories et réservation de Hotel A', async () => {
    expect((await categories(S.hotelA, S.reader, S.A)).status).toBe(200);
    expect((await reservation(S.resA, S.reader, S.A)).status).toBe(200);
  });

  test('platform.hotels.read + Tenant A → Hotel B et tenant:null refusés (aucune inférence manager/createdBy)', async () => {
    expect([403, 404]).toContain((await categories(S.hotelB, S.reader, S.A)).status);
    expect([403, 404]).toContain((await reservation(S.resB, S.reader, S.A)).status);
    expect([403, 404]).toContain((await categories(S.hotelNullInferred, S.reader, S.A)).status);
    expect([403, 404]).toContain((await categories(S.hotelNullSelf, S.reader, S.A)).status);
  });

  test('platform.hotels.read + Tenant A → hôtels accessibles = uniquement les hôtels directement attribués à A', async () => {
    const { status, names } = await accessibleNames(S.reader, S.A);
    expect(status).toBe(200);
    expect(names).toEqual(['HOA Hotel A']);
  });

  test('platform.hotels.read ne mute jamais (READ != MANAGE)', async () => {
    expect((await createFaq(S.hotelA, S.reader, S.A)).status).toBe(403);
  });

  test('platform.hotels.manage + Tenant A → mutation opérationnelle A autorisée, lecture A autorisée, B et tenant:null refusés', async () => {
    expect((await createFaq(S.hotelA, S.manager, S.A)).status).toBe(201);
    expect((await categories(S.hotelA, S.manager, S.A)).status).toBe(200);
    expect([403, 404]).toContain((await createFaq(S.hotelB, S.manager, S.A)).status);
    expect([403, 404]).toContain((await createFaq(S.hotelNullInferred, S.manager, S.A)).status);
  });

  test('opérateur support-only + Tenant A → aucune administration Hotel', async () => {
    expect((await categories(S.hotelA, S.support, S.A)).status).toBe(403);
    expect((await createFaq(S.hotelA, S.support, S.A)).status).toBe(403);
    expect((await reservation(S.resA, S.support, S.A)).status).toBe(403);
    expect((await accessibleNames(S.support, S.A)).names).toEqual([]);
  });
});

describe('Autorité métier TENANT — businessRole canonique, jamais User.role', () => {
  test('Tenant Admin canonique (User.role Client, businessRole Admin) → lecture et mutation A', async () => {
    expect((await categories(S.hotelA, S.tenantAdminCanonical)).status).toBe(200);
    expect((await createFaq(S.hotelA, S.tenantAdminCanonical)).status).toBe(201);
  });

  test('GestionnaireImmobilier canonique → lecture A', async () => {
    expect((await categories(S.hotelA, S.gestionnaire)).status).toBe(200);
  });

  test('User.role GestionnaireImmobilier ou Admin seul (membership sans businessRole) → refusé', async () => {
    expect((await categories(S.hotelA, S.legacyGestionnaire)).status).toBe(403);
    expect((await categories(S.hotelA, S.legacyAdmin)).status).toBe(403);
  });

  test('Tenant Admin canonique A → Hotel B et tenant:null refusés', async () => {
    expect([403, 404]).toContain((await categories(S.hotelB, S.tenantAdminCanonical)).status);
    expect([403, 404]).toContain((await categories(S.hotelNullInferred, S.tenantAdminCanonical)).status);
  });
});

describe('UNRESOLVED et self-service', () => {
  test('opérateur sans tenant sélectionné → aucune administration opérationnelle Hotel', async () => {
    expect((await categories(S.hotelA, S.reader)).status).toBe(403);
    expect((await categories(S.hotelA, S.manager)).status).toBe(403);
  });

  test('utilisateur sans tenant ni rattachement → refusé', async () => {
    const stranger = await makeUser('Client', 'stranger');
    expect((await categories(S.hotelA, stranger)).status).toBe(403);
  });

  test('Hotel.manager self-service conserve son hôtel tenant:null, sans autorité tenant', async () => {
    expect((await categories(S.hotelNullSelf, S.selfManager)).status).toBe(200);
    expect([403, 404]).toContain((await categories(S.hotelA, S.selfManager)).status);
    expect((await request(app).get('/api/hotels/admin/list').set(bearer(S.selfManager))).status).toBe(403);
  });
});

describe('Provenance', () => {
  test('aucune opération ne modifie Hotel.tenant', async () => {
    const after = await Hotel.find({ _id: { $in: S.tenantsBefore.map((hotel) => hotel._id) } }).select('tenant').lean();
    const index = new Map(S.tenantsBefore.map((hotel) => [String(hotel._id), String(hotel.tenant)]));
    after.forEach((hotel) => expect(String(hotel.tenant)).toBe(index.get(String(hotel._id))));
  });
});
