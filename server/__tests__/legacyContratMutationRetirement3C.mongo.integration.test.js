// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3C —
// LEGACY-CONTRAT-MUTATION-RETIREMENT.
//
// Certifie que les mutations polymorphiques héritées
//   PUT    /api/contrats/:id
//   DELETE /api/contrats/:id
// retournent désormais 410 `CONTRACT_LEGACY_MUTATION_RETIRED` SANS effet
// de bord, tout en préservant :
//   - la chaîne d'autorité canonique amont (401/403/404 fail-closed
//     avant tout 410 — jamais un resource oracle) ;
//   - les surfaces typées `/api/contrats/{location|vente}/:id` ;
//   - la lecture polymorphique legacy `GET /api/contrats(/:id)` ;
//   - la conclusion marketplace `POST /api/contrats` (PLATFORM only) ;
//   - la lecture rental payment typée ;
//   - le retirement distinct `CONTRACT_PAYMENT_ENDPOINT_RETIRED` (B3).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const rentalContratRoutes = require('../routes/rentalContratRoutes');
const saleContratRoutes = require('../routes/saleContratRoutes');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/contrats/location', rentalContratRoutes);
app.use('/api/contrats/vente', saleContratRoutes);
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenant) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
async function makeUser(overrides = {}) {
  seq += 1;
  return User.create({
    name: `LCR-${seq}`, email: `lcr-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Client', isEmailVerified: true, ...overrides,
  });
}
async function makeProperty(owner, tenantId, overrides = {}) {
  seq += 1;
  return Property.create({
    title: `LCR Villa ${seq}`, description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 400000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id, tenant: tenantId || null, ...overrides,
  });
}
async function makeLocationContrat(property, extras = {}) {
  return Contrat.create({
    type: 'location', bien: property._id, statut: 'actif',
    dateEntree: new Date('2027-01-01'), dateFinBail: new Date('2027-12-31'),
    montantLoyer: 300000, ...extras,
  });
}
async function makeVenteContrat(property, extras = {}) {
  return Contrat.create({
    type: 'vente', bien: property._id, statut: 'en_attente',
    prixVente: 5000000, ...extras,
  });
}
async function operatorWith(capabilities) {
  const user = await makeUser({ role: 'Admin' });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: user._id, actor: granter, reason: 'LCR fixture', capabilities });
  return user;
}
async function scenarioAB() {
  const A = await createTenantFixture({ label: `LCR-A-${seq++}`, withAdminMembership: true });
  const B = await createTenantFixture({ label: `LCR-B-${seq++}`, withAdminMembership: true });
  const ownerA = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: A.tenant, user: ownerA, bootstrap: A.bootstrap });
  const propertyA = await makeProperty(ownerA, A.tenant._id);
  const ownerB = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: B.tenant, user: ownerB, bootstrap: B.bootstrap });
  const propertyB = await makeProperty(ownerB, B.tenant._id);
  return { A, B, propertyA, propertyB, ownerA, ownerB };
}
async function makeMember(tenantFix, businessRole = 'Admin') {
  const user = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: tenantFix.tenant, user, bootstrap: tenantFix.bootstrap, businessRole });
  return user;
}
async function disableModuleFor(tenant, moduleKey) {
  await PlatformTenantFeature.updateOne(
    { tenant: tenant._id, module: moduleKey },
    { $set: { enabled: false, tenant: tenant._id, module: moduleKey } },
    { upsert: true },
  );
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ─────────────────────────────────────────────────────────────────────────
// LCR-01..06 — Legacy PUT retirement + zero-write assertions
// ─────────────────────────────────────────────────────────────────────────

describe('LCR — Legacy PUT retired', () => {
  test('LCR-01/02 (authenticated authorized legacy PUT → 410 + stable code)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 999999 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
  });

  test('LCR-03 (legacy PUT zero Contrat mutation — snapshot invariant)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const before = await Contrat.findById(c._id).lean();
    const admin = await makeMember(s.A, 'Admin');
    await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({
      type: 'vente', statut: 'résilié', bien: '000000000000000000000001',
      locataire: '000000000000000000000002', prixVente: 8888888,
    });
    const after = await Contrat.findById(c._id).lean();
    expect(after.type).toBe(before.type);
    expect(after.statut).toBe(before.statut);
    expect(String(after.bien)).toBe(String(before.bien));
    expect(after.montantLoyer).toBe(before.montantLoyer);
    expect(after.prixVente).toBe(before.prixVente);
  });

  test('LCR-04 (legacy PUT zero Property mutation)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const before = await Property.findById(s.propertyA._id).lean();
    const admin = await makeMember(s.A, 'Admin');
    await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 111 });
    const after = await Property.findById(s.propertyA._id).lean();
    expect(after.availability).toBe(before.availability);
    expect(after.status).toBe(before.status);
  });

  test('LCR-05 (legacy PUT does not touch RentalManagement)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const beforeCount = await RentalManagement.countDocuments({});
    const admin = await makeMember(s.A, 'Admin');
    await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 111 });
    const afterCount = await RentalManagement.countDocuments({});
    expect(afterCount).toBe(beforeCount);
  });

  test('LCR-06 (legacy PUT zero Paiement mutation)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await Paiement.create({ contrat: c._id, mois: 1, annee: 2027, montant: 300000, statut: 'impayé' });
    const before = await Paiement.find({ contrat: c._id }).lean();
    const admin = await makeMember(s.A, 'Admin');
    await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 111 });
    const after = await Paiement.find({ contrat: c._id }).lean();
    expect(after.length).toBe(before.length);
    expect(after[0].montant).toBe(before[0].montant);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LCR-07..11 — Legacy DELETE retirement + zero side-effect
// ─────────────────────────────────────────────────────────────────────────

describe('LCR — Legacy DELETE retired', () => {
  test('LCR-07/08 (authenticated authorized legacy DELETE → 410 + stable code)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
  });

  test('LCR-09 (legacy DELETE does not delete the Contrat)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    await request(app).delete(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(await Contrat.exists({ _id: c._id })).toBeTruthy();
  });

  test('LCR-10 (legacy DELETE does not invoke schedulePropertyExit)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await RentalManagement.create({ property: s.propertyA._id, owner: s.ownerA._id, activeLease: c._id, active: true, managementActivated: true });
    const admin = await makeMember(s.A, 'Admin');
    await request(app).delete(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant));
    const rm = await RentalManagement.findOne({ property: s.propertyA._id });
    // Aucun exit programmé, aucun statut de sortie ; active reste inchangé.
    expect(rm.active).toBe(true);
  });

  test('LCR-11 (legacy DELETE does not delete Paiement)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await Paiement.create({ contrat: c._id, mois: 1, annee: 2027, montant: 300000, statut: 'impayé' });
    const admin = await makeMember(s.A, 'Admin');
    await request(app).delete(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(await Paiement.countDocuments({ contrat: c._id })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LCR-12..16 — Auth chain preserved BEFORE 410 (no resource oracle)
// ─────────────────────────────────────────────────────────────────────────

describe('LCR — Authority preserved before 410 (no oracle)', () => {
  test('LCR-12 (unauthenticated → 401, not 410)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const put = await request(app).put(`/api/contrats/${c._id}`).send({ montantLoyer: 111 });
    expect(put.status).toBe(401);
    const del = await request(app).delete(`/api/contrats/${c._id}`);
    expect(del.status).toBe(401);
  });

  test('LCR-13 (cross-tenant PUT fails closed WITHOUT resource oracle → not 410)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 111 });
    expect(res.status).not.toBe(410);
    expect([403, 404]).toContain(res.status);
  });

  test('LCR-14 (cross-tenant DELETE fails closed WITHOUT resource oracle)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).not.toBe(410);
    expect([403, 404]).toContain(res.status);
  });

  test('LCR-15 (Global User.role=Admin orphan → 403/404, never 410)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const orphan = await makeUser({ role: 'Admin' });
    const put = await request(app).put(`/api/contrats/${c._id}`).set(bearer(orphan, s.A.tenant)).send({ montantLoyer: 111 });
    expect(put.status).not.toBe(410);
    const del = await request(app).delete(`/api/contrats/${c._id}`).set(bearer(orphan, s.A.tenant));
    expect(del.status).not.toBe(410);
  });

  test('LCR-16 (PlatformOperator without tenant membership → 403, never 410)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const op = await operatorWith(['platform.commercial.manage']);
    const put = await request(app).put(`/api/contrats/${c._id}`).set(bearer(op, s.A.tenant)).send({ montantLoyer: 111 });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/contrats/${c._id}`).set(bearer(op, s.A.tenant));
    expect(del.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LCR-17..22 — Typed surfaces remain mutable
// ─────────────────────────────────────────────────────────────────────────

describe('LCR — Typed surfaces remain the exclusive mutation path', () => {
  test('LCR-17 (typed rental PUT still works)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 400000 });
    expect(res.status).toBe(200);
  });
  test('LCR-18 (typed rental DELETE still works)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([200, 409]).toContain(res.status);
  });
  test('LCR-19 (typed sale PUT still works)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ prixVente: 6000000 });
    expect(res.status).toBe(200);
  });
  test('LCR-20 (typed sale DELETE still works)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([200, 409]).toContain(res.status);
  });
  test('LCR-21 (rental typed mutation still requires location module)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 400000 });
    expect(res.status).toBe(403);
  });
  test('LCR-22 (sale typed mutation independent from location module)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ prixVente: 6000000 });
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LCR-23..28 — Read compat + payment + POST formation preserved
// ─────────────────────────────────────────────────────────────────────────

describe('LCR — Polymorphic READ compat + payment + POST formation preserved', () => {
  test('LCR-23 (GET /api/contrats still works)', async () => {
    const s = await scenarioAB();
    await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get('/api/contrats').set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
  });
  test('LCR-24/25 (GET /api/contrats/:id + polymorphic list still returns both types)', async () => {
    const s = await scenarioAB();
    const cR = await makeLocationContrat(s.propertyA);
    const cV = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const list = await request(app).get('/api/contrats').set(bearer(admin, s.A.tenant));
    expect(list.status).toBe(200);
    const types = new Set(list.body.data.contrats.map((c) => c.type));
    expect(types.has('location')).toBe(true);
    expect(types.has('vente')).toBe(true);
    const detailR = await request(app).get(`/api/contrats/${cR._id}`).set(bearer(admin, s.A.tenant));
    expect(detailR.status).toBe(200);
    const detailV = await request(app).get(`/api/contrats/${cV._id}`).set(bearer(admin, s.A.tenant));
    expect(detailV.status).toBe(200);
  });
  test('LCR-26 (POST /:id/paiements retains its distinct CONTRACT_PAYMENT_ENDPOINT_RETIRED code)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).post(`/api/contrats/${c._id}/paiements`).set(bearer(admin, s.A.tenant)).send({ montant: 1 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_PAYMENT_ENDPOINT_RETIRED');
  });
  test('LCR-27 (canonical rental payment read remains functional on typed surface)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
  });
  test('LCR-28 (POST /api/contrats marketplace formation remains functional)', async () => {
    const s = await scenarioAB();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).post('/api/contrats').set(bearer(op, s.A.tenant)).send({
      type: 'location', bien: String(s.propertyA._id),
      dateEntree: new Date('2027-01-01').toISOString(),
      dateFinBail: new Date('2027-12-31').toISOString(),
      montantLoyer: 300000,
    });
    expect(res.status).toBe(201);
  });
});
