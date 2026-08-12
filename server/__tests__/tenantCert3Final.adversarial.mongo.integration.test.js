const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const UserBusinessProfile = require('../models/UserBusinessProfile');
const PlatformTenant = require('../models/PlatformTenant');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const dossierRoutes = require('../routes/dossierRoutes');
const Accommodation = require('../models/Accommodation');
const AccommodationReservation = require('../models/AccommodationReservation');
const FinancialRefund = require('../models/FinancialRefund');
const accommodationReservationRoutes = require('../routes/accommodationReservationRoutes');
const apiPlatformAdminRoutes = require('../routes/apiPlatformAdminRoutes');
const ApiKey = require('../models/ApiKey');
const { createApiKey } = require('../services/publicApi/apiKeyService');
const platformTenantRoutes = require('../routes/platformTenantRoutes');
const userBusinessProfileRoutes = require('../routes/userBusinessProfileRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/platform-tenants', platformTenantRoutes);
app.use('/api/user-business-profiles', userBusinessProfileRoutes);
app.use('/api/dossiers', dossierRoutes);
app.use('/api/accommodation-reservations', accommodationReservationRoutes);
app.use('/api/dev-portal', apiPlatformAdminRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let tenantA;
let tenantB;
let adminA;
let adminB;
let userB;

beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'Cert3 Final A' });
  const fixtureB = await createTenantFixture({ label: 'Cert3 Final B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;
  adminA = (await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap, overrides: { role: 'Admin' } })).user;
  adminB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  userB = (await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap, overrides: { role: 'Client' } })).user;
});

afterEach(async () => UserBusinessProfile.deleteMany({}));
afterAll(async () => stopFinancialMongo());

describe('USER-ARCH — tenant boundary AND RBAC', () => {
  test('B→B : AdminB accorde un profil métier à UserB → 201', async () => {
    const res = await request(app).post(`/api/user-business-profiles/${userB._id}`)
      .set(bearer(adminB, tenantB)).send({ profileType: 'proprietaire_immobilier' });
    expect(res.status).toBe(201);
  });

  test('A→B : AdminA ne peut accorder aucun profil à UserB et aucune mutation partielle ne survient', async () => {
    const res = await request(app).post(`/api/user-business-profiles/${userB._id}`)
      .set(bearer(adminA, tenantA)).send({ profileType: 'proprietaire_immobilier' });
    expect([403, 404]).toContain(res.status);
    expect(await UserBusinessProfile.countDocuments({ user: userB._id })).toBe(0);
  });

  test('A→B : AdminA ne lit ni profils effectifs ni historique de UserB par ObjectId connu', async () => {
    await UserBusinessProfile.create({ user: userB._id, profileType: 'locataire', grantedBy: adminB._id });
    const [effective, history] = await Promise.all([
      request(app).get(`/api/user-business-profiles/${userB._id}`).set(bearer(adminA, tenantA)),
      request(app).get(`/api/user-business-profiles/${userB._id}/history`).set(bearer(adminA, tenantA)),
    ]);
    expect([403, 404]).toContain(effective.status);
    expect([403, 404]).toContain(history.status);
  });
});

describe('PlatformOperator — la perte de membership ne doit jamais créer une élévation globale', () => {
  test('contrôle : AdminA membre ne peut consulter TenantB', async () => {
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
  });

  test('attaque : après révocation de sa dernière membership, AdminA ne devient pas PlatformOperator sur TenantB', async () => {
    const membership = await OrgMembership.findOne({ user: adminA._id, status: 'active' });
    await OrgMembership.updateMany({ user: adminA._id, status: 'active' }, {
      status: 'revoked', revokedAt: new Date(), revokedBy: adminB._id,
    });
    const res = await request(app).get(`/api/platform-tenants/${tenantB._id}`).set(bearer(adminA));
    expect([403, 404]).toContain(res.status);
    await OrgMembership.updateOne({ _id: membership._id }, { status: 'active', revokedAt: null, revokedBy: null });
  });
});

describe('PlatformTenant collection — un Admin tenant-bound ne possède aucune capacité globale implicite', () => {
  test('A→LIST : AdminA ne peut pas lister les métadonnées de TenantB', async () => {
    const res = await request(app).get('/api/platform-tenants').set(bearer(adminA, tenantA));
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain(String(tenantB._id));
    expect(JSON.stringify(res.body)).not.toContain(tenantB.name);
  });

  test('A→CREATE : AdminA ne peut pas créer un tenant plateforme supplémentaire', async () => {
    const before = await PlatformTenant.countDocuments();
    const res = await request(app).post('/api/platform-tenants').set(bearer(adminA, tenantA))
      .send({ name: 'Tenant hostile créé par AdminA' });
    expect([403, 404]).toContain(res.status);
    expect(await PlatformTenant.countDocuments()).toBe(before);
  });
});

describe('Recherche transverse — le canari B ne doit produire aucun résultat chez A', () => {
  test('B→B positif puis A→B négatif sur un vrai dossier GL connu', async () => {
    const marker = 'TENANT_B_SECRET_SEARCH_938472';
    const propertyB = await Property.create({
      title: marker, description: 'Description suffisamment longue pour une fixture adversariale.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 900000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
      images: ['https://placehold.co/1200x800/png'], surface: 90, statusAdmin: 'Validée',
      isPublished: true, availability: 'Loué', owner: userB._id,
    });
    const contractB = await Contrat.create({
      type: 'location', bien: propertyB._id, statut: 'actif', dateEntree: '2028-01-01',
      dateFinBail: '2028-12-31', montantLoyer: 900000,
    });
    const positive = await request(app).get('/api/dossiers/search').query({ q: marker }).set(bearer(adminB, tenantB));
    expect(positive.status).toBe(200);
    expect(positive.body.data.results.some((row) => row.entityId === String(contractB._id))).toBe(true);

    const attack = await request(app).get('/api/dossiers/search').query({ q: marker }).set(bearer(adminA, tenantA));
    expect(attack.status).toBe(200);
    expect(JSON.stringify(attack.body)).not.toContain(marker);
    expect(attack.body.data.results.some((row) => row.entityId === String(contractB._id))).toBe(false);
  });
});

describe('Accommodation Finance — tenant boundary AND autorisation financière', () => {
  test('B→B positif puis A→B refusé sur le résumé financier de la même réservation', async () => {
    const propertyB = await Property.create({
      title: 'Accommodation finance B', description: 'Description suffisamment longue pour une fixture adversariale.',
      pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 500000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2,
      images: ['https://placehold.co/1200x800/png'], surface: 90, statusAdmin: 'Validée',
      isPublished: true, availability: 'Disponible', owner: userB._id,
    });
    const accommodationB = await Accommodation.create({
      property: propertyB._id, createdBy: userB._id, tenant: tenantB._id,
      accommodationType: 'appartement_meuble', capacity: { maxAdults: 2, maxChildren: 0 },
      publicationStatus: 'publie', active: true,
    });
    const reservationB = await AccommodationReservation.create({
      accommodation: accommodationB._id, owner: userB._id, guest: userB._id, createdBy: userB._id,
      tenant: tenantB._id, checkInDate: new Date('2028-01-01'), checkOutDate: new Date('2028-01-03'),
      nights: 2, guestCount: 1, adults: 1, status: 'pending', total: 100000,
    });
    const positive = await request(app).get(`/api/accommodation-reservations/${reservationB._id}/financial-summary`).set(bearer(adminB, tenantB));
    expect(positive.status).toBe(200);
    const attack = await request(app).get(`/api/accommodation-reservations/${reservationB._id}/financial-summary`).set(bearer(adminA, tenantA));
    expect([403, 404]).toContain(attack.status);
    expect(JSON.stringify(attack.body)).not.toContain('100000');
  });

  test('A→B par refundId connu : AdminA ne peut approuver un remboursement B', async () => {
    const reservationB = await AccommodationReservation.findOne({ tenant: tenantB._id });
    const refundB = await FinancialRefund.create({
      domain: 'real_estate', establishmentType: 'Accommodation', establishmentId: reservationB.accommodation,
      financialPayment: new (require('mongoose').Types.ObjectId)(), financialDocument: new (require('mongoose').Types.ObjectId)(),
      subjectType: 'AccommodationReservation', subjectId: reservationB._id,
      amountMinor: 25000, currency: 'XAF', method: 'cash', status: 'requested', reason: 'Canari remboursement B',
      requestedBy: adminB._id, businessOperationKey: `cert3-refund-${Date.now()}`,
    });
    const attack = await request(app).post(`/api/accommodation-reservations/refunds/${refundB._id}/approve`)
      .set(bearer(adminA, tenantA)).set('Idempotency-Key', `hostile-approve-${Date.now()}`).send({});
    expect([403, 404]).toContain(attack.status);
    expect((await FinancialRefund.findById(refundB._id)).status).toBe('requested');
  });
});

describe('API Public developer portal — les clés et journaux restent dans le tenant actif', () => {
  test('B→B positif puis A→B : AdminA ne liste jamais ApiKeyB', async () => {
    const { apiKey: keyB } = await createApiKey({ name: 'API KEY B SECRET', tenant: tenantB._id, actor: adminB });
    const positive = await request(app).get('/api/dev-portal/keys').set(bearer(adminB, tenantB));
    expect(positive.status).toBe(200);
    expect(positive.body.data.keys.some((key) => String(key._id) === String(keyB._id))).toBe(true);
    const attack = await request(app).get('/api/dev-portal/keys').set(bearer(adminA, tenantA));
    expect(attack.status).toBe(200);
    expect(JSON.stringify(attack.body)).not.toContain('API KEY B SECRET');
    expect(attack.body.data.keys.some((key) => String(key._id) === String(keyB._id))).toBe(false);
  });

  test('mass assignment : AdminA ne peut créer une clé rattachée à TenantB', async () => {
    const res = await request(app).post('/api/dev-portal/keys').set(bearer(adminA, tenantA))
      .send({ name: 'HOSTILE KEY', tenant: String(tenantB._id), scopes: ['properties:read'] });
    expect(res.status).toBe(201);
    const stored = await ApiKey.findById(res.body.data.apiKey._id);
    expect(String(stored.tenant)).toBe(String(tenantA._id));
  });
});
