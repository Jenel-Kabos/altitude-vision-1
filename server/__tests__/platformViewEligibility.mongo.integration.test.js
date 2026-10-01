// PLATFORM-ADMIN-04A — Groupes C (contexte), D (anciens bypass ad hoc),
// E (requirePlatformOperatorCapability + /platform-operators/me) et
// F (opérateur partiel avec tenant sélectionné, isolation tenant).
//
// L'opérateur « partiel » détient TOUTES les capabilities requises sauf une
// (`platform.operators.manage`) : il possède donc chaque capability métier
// testée ici, ce qui isole précisément la gate d'éligibilité de la gate de
// capability. Un second opérateur partiel (sans `platform.marketing.read`)
// couvre la gouvernance des opérateurs.
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, createTenantHotel } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const HotelReservation = require('../models/HotelReservation');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/properties', require('../routes/propertyRoutes'));
app.use('/api/accommodations', require('../routes/accommodationRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));
app.use('/api/reporting', require('../routes/reportingRoutes'));
app.use('/api/users', require('../routes/userRoutes'));
app.use('/api/conversations', require('../routes/conversationRoutes'));
app.use('/api/hotels', require('../routes/hotelRoutes'));
app.use('/api/hotel-reservations', require('../routes/hotelReservationRoutes'));
app.use('/api/accommodation-reservations', require('../routes/accommodationReservationRoutes'));
app.use('/api/platform-operators', require('../routes/platformOperatorRoutes'));
app.use('/api/transactions', require('../routes/transactionRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({
    name: `PA04A ${label}`, email: `pa04a-${label}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true,
  });
};

const S = {};
const without = (capability) => PLATFORM_VIEW_REQUIRED_CAPABILITIES.filter((item) => item !== capability);

async function makeHebergement({ tenant, owner, title, publicationStatus = 'soumis' }) {
  const property = await Property.create({
    tenant: tenant?._id || null, title, description: 'PA04A fixture', pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 50000,
    address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28, images: ['https://example.test/x.jpg'], surface: 80, availability: 'Disponible', owner: owner._id,
  });
  const accommodation = await Accommodation.create({
    tenant: tenant?._id || null, property: property._id, accommodationType: 'villa_meublee', publicationStatus,
    capacity: { maxAdults: 2, maxChildren: 0 }, createdBy: owner._id, submittedAt: new Date(),
  });
  return { property, accommodation };
}

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PA04A Tenant A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'PA04A Tenant B', withAdminMembership: true });
  S.tenantA = fixtureA.tenant; S.tenantB = fixtureB.tenant;
  S.adminA = fixtureA.bootstrap; S.adminB = fixtureB.bootstrap;
  ({ user: S.memberA } = await createTenantUser({ tenant: S.tenantA, bootstrap: S.adminA, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' }));
  ({ user: S.memberB } = await createTenantUser({ tenant: S.tenantB, bootstrap: S.adminB, overrides: { role: 'Collaborateur' }, businessRole: 'Collaborateur' }));
  S.independentOwner = await makeUser('Proprietaire', 'independent-owner');

  S.full = await makeUser('Admin', 'full-operator');
  S.partial = await makeUser('Admin', 'partial-operator');
  S.partialGovernance = await makeUser('Admin', 'partial-governance');
  S.legacyAdmin = await makeUser('Admin', 'legacy-admin');
  await grantOperator({ userId: S.full._id, actor: S.adminA, reason: 'PA04A full operator', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  await grantOperator({ userId: S.partial._id, actor: S.adminA, reason: 'PA04A partial operator', capabilities: without('platform.operators.manage') });
  await grantOperator({ userId: S.partialGovernance._id, actor: S.adminA, reason: 'PA04A partial governance', capabilities: without('platform.marketing.read') });

  S.A1 = await makeHebergement({ tenant: S.tenantA, owner: S.adminA, title: 'PA04A A1' });
  S.B1 = await makeHebergement({ tenant: S.tenantB, owner: S.adminB, title: 'PA04A B1' });
  S.U1 = await makeHebergement({ tenant: null, owner: S.independentOwner, title: 'PA04A U1' });

  S.hotelA = await createTenantHotel({ tenant: S.tenantA, manager: S.adminA, createdBy: S.adminA, overrides: { publicationStatus: 'soumis' } });
  S.reservationA = await HotelReservation.create({
    tenant: S.tenantA._id, hotel: S.hotelA._id, roomCategory: new mongoose.Types.ObjectId(), guestUser: S.memberA._id,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada-pa04a@example.test', country: 'CG' },
    checkInDate: new Date('2026-11-01'), checkOutDate: new Date('2026-11-03'), roomsCount: 1, adults: 1,
    unitPrice: 30000, subtotal: 60000, totalAmount: 60000, currency: 'XAF',
    rateSnapshot: { rateType: 'nightly', amount: 30000, currency: 'XAF', version: 1 },
    status: 'confirmed', source: 'owner_dashboard', createdBy: S.memberA._id,
  });
});

afterAll(stopFinancialMongo);

const titles = (res) => (res.body.data?.properties || []).map((item) => item.title);
const pendingTitles = (res) => (res.body.data?.accommodations || []).map((item) => item.property?.title);
const expectNotEligible = (res) => {
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('PLATFORM_VIEW_NOT_ELIGIBLE');
};

describe('Groupe C — résolution du contexte plateforme', () => {
  const routes = [
    '/api/properties?dashboardRegistry=1&limit=50',
    '/api/accommodations/status/pending',
    '/api/admin/stats',
    '/api/reporting/executive',
  ];

  test.each(routes)('opérateur partiel sans tenant → 403 PLATFORM_VIEW_NOT_ELIGIBLE sur %s', async (path) => {
    expectNotEligible(await request(app).get(path).set(bearer(S.partial)));
  });

  test.each(routes)('opérateur complet sans tenant → 200 sur %s', async (path) => {
    const res = await request(app).get(path).set(bearer(S.full));
    expect(res.status).toBe(200);
  });

  test('opérateur complet : registre global = Tenant A + Tenant B + tenant:null', async () => {
    const res = await request(app).get('/api/properties?dashboardRegistry=1&limit=50').set(bearer(S.full));
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(expect.arrayContaining(['PA04A A1', 'PA04A B1', 'PA04A U1']));
  });

  test('opérateur complet : modération hébergement globale inclut tenant:null', async () => {
    const res = await request(app).get('/api/accommodations/status/pending').set(bearer(S.full));
    expect(res.status).toBe(200);
    expect(pendingTitles(res)).toEqual(expect.arrayContaining(['PA04A A1', 'PA04A B1', 'PA04A U1']));
  });

  test('Admin historique sans PlatformOperator → jamais de scope plateforme', async () => {
    const res = await request(app).get('/api/properties?dashboardRegistry=1').set(bearer(S.legacyAdmin));
    expect(res.status).toBe(403);
  });
});

describe('Groupe D — anciens bypass `isPlatformOperatorContext && !platformTenant`', () => {
  test('users : opérateur partiel sans tenant → 403, aucune donnée globale', async () => {
    const res = await request(app).get('/api/users').set(bearer(S.partial));
    expectNotEligible(res);
    expect(res.body.data).toBeUndefined();
  });

  test('users/:id : opérateur partiel sans tenant → 403', async () => {
    expectNotEligible(await request(app).get(`/api/users/${S.memberB._id}`).set(bearer(S.partial)));
  });

  test('users : opérateur complet sans tenant → lecture globale', async () => {
    const res = await request(app).get(`/api/users/${S.memberB._id}`).set(bearer(S.full));
    expect(res.status).toBe(200);
  });

  // PA-04A CLOSURE (H3) — `platform.support.read` ouvre le workflow
  // platform-native spécialisé `support_inbox` (borné à l'inbox support) à un
  // opérateur partiel, sans jamais lui donner la Vue plateforme.
  test('conversations : opérateur partiel (platform.support.read) sans tenant → workflow support spécialisé, jamais la Vue plateforme', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(S.partial));
    expect(res.status).toBe(200);
    expectNotEligible(await request(app).get('/api/users').set(bearer(S.partial)));
    const me = await request(app).get('/api/platform-operators/me').set(bearer(S.partial));
    expect(me.body.data.platformViewEligible).toBe(false);
  });

  test('conversations : opérateur complet sans tenant → branche plateforme', async () => {
    const res = await request(app).get('/api/conversations/count/unread').set(bearer(S.full));
    expect(res.status).toBe(200);
  });

  test('hotel-reservations/:id : opérateur partiel sans tenant n’est jamais « staff global »', async () => {
    const res = await request(app).get(`/api/hotel-reservations/${S.reservationA._id}`).set(bearer(S.partial));
    expect([403, 404]).toContain(res.status);
    expect(res.body.data).toBeUndefined();
  });

  test('hotel-reservations/:id : opérateur complet sans tenant → lecture plateforme', async () => {
    const res = await request(app).get(`/api/hotel-reservations/${S.reservationA._id}`).set(bearer(S.full));
    expect(res.status).toBe(200);
  });

  test.each(['/api/accommodation-reservations', '/api/accommodation-reservations/refunds/operations', '/api/accommodation-reservations/deductions/operations'])(
    'accommodation-reservations : opérateur partiel sans tenant → 403 sur %s',
    async (path) => {
      expectNotEligible(await request(app).get(path).set(bearer(S.partial)));
    },
  );

  test('portfolio : opérateur partiel sans tenant → 403 (aucun portefeuille global)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(S.partial));
    expect(res.status).toBe(403);
  });

  test('catalogue staff : opérateur partiel sans tenant → 403', async () => {
    expectNotEligible(await request(app).get('/api/properties').set(bearer(S.partial)));
  });

  test('modération hôtel : opérateur partiel (platform.hotels.manage) sans tenant → 403 PLATFORM_VIEW_NOT_ELIGIBLE', async () => {
    expectNotEligible(await request(app).patch(`/api/hotels/${S.hotelA._id}/reject`).set(bearer(S.partial)).send({ reason: 'PA04A' }));
  });
});

describe('Groupe E — surfaces platform-native et /platform-operators/me', () => {
  test('opérateur partiel + platform.users.read sans tenant → 403 sur le registre owners', async () => {
    expectNotEligible(await request(app).get('/api/admin/owners').set(bearer(S.partial)));
  });

  test('opérateur partiel avec platform.operators.manage → 403 sur la gouvernance opérateurs', async () => {
    expectNotEligible(await request(app).get('/api/platform-operators').set(bearer(S.partialGovernance)));
  });

  test('opérateur partiel → platform.properties.manage global (recommande) refusé', async () => {
    expectNotEligible(await request(app).patch(`/api/properties/${S.A1.property._id}/recommande`).set(bearer(S.partial)).send({ recommande: true }));
  });

  test('opérateur complet → surfaces platform-native accessibles', async () => {
    expect((await request(app).get('/api/admin/owners').set(bearer(S.full))).status).toBe(200);
    expect((await request(app).get('/api/platform-operators').set(bearer(S.full))).status).toBe(200);
  });

  test('GET /platform-operators/me : partiel → 200 + platformViewEligible false', async () => {
    const res = await request(app).get('/api/platform-operators/me').set(bearer(S.partial));
    expect(res.status).toBe(200);
    expect(res.body.data.platformViewEligible).toBe(false);
    expect(res.body.data.operator).toMatchObject({ status: 'active' });
  });

  test('GET /platform-operators/me : complet → platformViewEligible true', async () => {
    const res = await request(app).get('/api/platform-operators/me').set(bearer(S.full));
    expect(res.status).toBe(200);
    expect(res.body.data.platformViewEligible).toBe(true);
  });

  test('GET /platform-operators/me : non-opérateur → operator null + platformViewEligible false, rien d’autre', async () => {
    const res = await request(app).get('/api/platform-operators/me').set(bearer(S.legacyAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ operator: null, platformViewEligible: false });
  });

  test('GET /platform-operators/me n’expose aucune liste de capabilities manquantes', async () => {
    const res = await request(app).get('/api/platform-operators/me').set(bearer(S.partial));
    expect(Object.keys(res.body.data).sort()).toEqual(['operator', 'platformViewEligible']);
    expect(JSON.stringify(res.body)).not.toMatch(/missing/i);
  });
});

describe('Groupe F — opérateur partiel avec tenant sélectionné et isolation', () => {
  test('opérateur partiel + Tenant A → modération hébergement A uniquement', async () => {
    const res = await request(app).get('/api/accommodations/status/pending').set(bearer(S.partial, S.tenantA));
    expect(res.status).toBe(200);
    expect(pendingTitles(res)).toEqual(['PA04A A1']);
  });

  test('opérateur partiel + Tenant B → registre B uniquement, jamais tenant:null', async () => {
    const res = await request(app).get('/api/properties?dashboardRegistry=1&limit=50').set(bearer(S.partial, S.tenantB));
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['PA04A B1']);
  });

  test('opérateur partiel + Tenant A → reporting tenant autorisé', async () => {
    expect((await request(app).get('/api/reporting/executive').set(bearer(S.partial, S.tenantA))).status).toBe(200);
  });

  test('opérateur partiel + Tenant A → utilisateurs du tenant A, jamais ceux de B', async () => {
    const own = await request(app).get(`/api/users/${S.memberA._id}`).set(bearer(S.partial, S.tenantA));
    const other = await request(app).get(`/api/users/${S.memberB._id}`).set(bearer(S.partial, S.tenantA));
    expect(own.status).toBe(200);
    expect(other.status).toBe(404);
  });

  test('opérateur partiel + Tenant A → mutation utilisateur tenant-scopée conservée', async () => {
    const res = await request(app).patch(`/api/users/${S.memberA._id}/activate`).set(bearer(S.partial, S.tenantA));
    expect(res.status).not.toBe(403);
    expect(res.status).toBeLessThan(500);
  });

  test('opérateur partiel + Tenant A → transactions tenant-scopées conservées', async () => {
    expect((await request(app).get('/api/transactions').set(bearer(S.partial, S.tenantA))).status).toBe(200);
  });

  test('opérateur partiel + Tenant A → réservation hôtel du tenant A accessible', async () => {
    expect((await request(app).get(`/api/hotel-reservations/${S.reservationA._id}`).set(bearer(S.partial, S.tenantA))).status).toBe(200);
  });

  test('Admin tenant A et Admin tenant B restent isolés, sans tenant:null', async () => {
    const a = await request(app).get('/api/properties?dashboardRegistry=1&limit=50').set(bearer(S.adminA, S.tenantA));
    const b = await request(app).get('/api/properties?dashboardRegistry=1&limit=50').set(bearer(S.adminB, S.tenantB));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(titles(a)).toEqual(['PA04A A1']);
    expect(titles(b)).toEqual(['PA04A B1']);
  });

  test('Admin tenant A ne peut pas entrer en Vue plateforme', async () => {
    const res = await request(app).get('/api/accommodations/status/pending').set(bearer(S.adminA));
    expect(res.status).toBe(200);
    expect(pendingTitles(res)).toEqual(['PA04A A1']);
  });
});
