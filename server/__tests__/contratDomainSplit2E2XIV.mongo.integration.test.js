// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT.
//
// Certifie la séparation stricte des surfaces LOCATION et VENTE du domaine
// Contrat (§26 du lot). Le modèle Mongo Contrat reste polymorphe
// (`CONTRAT_STORAGE_SPLIT_REQUIRED=NO`) — la séparation vit dans les
// routes/middlewares/services, jamais dans un deuxième modèle.
//
// Surfaces certifiées :
//   /api/contrats/location   — module location + type='location' guard
//   /api/contrats/vente      — pas de module gate + type='vente' guard
//   /api/contrats            — LEGACY compat (§16 option B) : polymorphe,
//                              PUT/DELETE type-aware via
//                              ensureModuleAvailableForContratType.
//
// La conclusion marketplace `POST /api/contrats` reste PLATFORM-only.

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
    name: `CDS-${seq}`, email: `cds-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Client', isEmailVerified: true, ...overrides,
  });
}
async function makeProperty(owner, tenantId, overrides = {}) {
  seq += 1;
  return Property.create({
    title: `CDS Villa ${seq}`, description: 'Description assez longue pour la validation Property.',
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
  await grantOperator({ userId: user._id, actor: granter, reason: 'CDS fixture', capabilities });
  return user;
}
async function scenarioAB() {
  const A = await createTenantFixture({ label: `CDS-A-${seq++}`, withAdminMembership: true });
  const B = await createTenantFixture({ label: `CDS-B-${seq++}`, withAdminMembership: true });
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
// CDS-01..09 — Module boundary + domain lists
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Module boundary + domain filtering', () => {
  test('CDS-01 (tenant with location module reads own rental contract)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
  });

  test('CDS-02 (tenant WITHOUT location module cannot read rental contract via typed surface)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(403);
    // Le `code` structuré est porté par TenantModuleGateError mais
    // errorMiddleware ne le sérialise que pour un enum restreint de names
    // — le 403 canonique reste la garantie fonctionnelle attendue ici.
  });

  test('CDS-03 (tenant without location module CAN read own sale contract — B1 core)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
  });

  test('CDS-04 (rental list contains only type=location)', async () => {
    const s = await scenarioAB();
    await makeLocationContrat(s.propertyA);
    await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get('/api/contrats/location').set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
    for (const c of res.body.data.contrats) expect(c.type).toBe('location');
  });

  test('CDS-05 (sale list contains only type=vente)', async () => {
    const s = await scenarioAB();
    await makeLocationContrat(s.propertyA);
    await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get('/api/contrats/vente').set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
    for (const c of res.body.data.contrats) expect(c.type).toBe('vente');
  });

  test('CDS-06 (rental route rejects sale contract ID → 404)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTRAT_DOMAIN_MISMATCH');
  });

  test('CDS-07 (sale route rejects rental contract ID → 404)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTRAT_DOMAIN_MISMATCH');
  });

  test('CDS-08 (rental PUT requires location module)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 400000 });
    expect(res.status).toBe(403);
  });

  test('CDS-09 (sale PUT works even with location module disabled)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ prixVente: 6000000 });
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-10..13 — Allow-list preservation + type immutable
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Structural allow-list preserved on both surfaces', () => {
  test('CDS-10 (rental PUT preserves allow-list — forbidden `bien` → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ bien: '000000000000000000000001' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTRACT_FIELD_NOT_MUTABLE');
  });

  test('CDS-11 (sale PUT preserves allow-list — forbidden `bien` → 400)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ bien: '000000000000000000000002' });
    expect(res.status).toBe(400);
  });

  test('CDS-12 (rental PUT cannot rebind type → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ type: 'vente' });
    expect(res.status).toBe(400);
  });

  test('CDS-13 (sale PUT cannot rebind type → 400)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ type: 'location' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-14..17 — DELETE authority + bypass negatives
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — DELETE authority preserved on both surfaces', () => {
  test('CDS-14 (rental DELETE tenant Admin allowed, GIM denied)', async () => {
    const s = await scenarioAB();
    const c1 = await makeLocationContrat(s.propertyA);
    const gim = await makeMember(s.A, 'GestionnaireImmobilier');
    const denied = await request(app).delete(`/api/contrats/location/${c1._id}`).set(bearer(gim, s.A.tenant));
    expect(denied.status).toBe(403);
    const admin = await makeMember(s.A, 'Admin');
    const ok = await request(app).delete(`/api/contrats/location/${c1._id}`).set(bearer(admin, s.A.tenant));
    expect([200, 409]).toContain(ok.status);
  });

  test('CDS-15 (sale DELETE tenant Admin allowed, Collab denied)', async () => {
    const s = await scenarioAB();
    const c1 = await makeVenteContrat(s.propertyA);
    const collab = await makeMember(s.A, 'Collaborateur');
    const denied = await request(app).delete(`/api/contrats/vente/${c1._id}`).set(bearer(collab, s.A.tenant));
    expect(denied.status).toBe(403);
    const admin = await makeMember(s.A, 'Admin');
    const ok = await request(app).delete(`/api/contrats/vente/${c1._id}`).set(bearer(admin, s.A.tenant));
    expect([200, 409]).toContain(ok.status);
  });

  test('CDS-16 (Global User.role=Admin orphan cannot bypass rental OR sale)', async () => {
    const s = await scenarioAB();
    const cR = await makeLocationContrat(s.propertyA);
    const cV = await makeVenteContrat(s.propertyA);
    const orphan = await makeUser({ role: 'Admin' });
    const r1 = await request(app).delete(`/api/contrats/location/${cR._id}`).set(bearer(orphan, s.A.tenant));
    expect([403, 404]).toContain(r1.status);
    const r2 = await request(app).delete(`/api/contrats/vente/${cV._id}`).set(bearer(orphan, s.A.tenant));
    expect([403, 404]).toContain(r2.status);
  });

  test('CDS-17 (PlatformOperator commercial.manage without tenant membership cannot bypass rental OR sale)', async () => {
    const s = await scenarioAB();
    const cR = await makeLocationContrat(s.propertyA);
    const cV = await makeVenteContrat(s.propertyA);
    const op = await operatorWith(['platform.commercial.manage']);
    const r1 = await request(app).get(`/api/contrats/location/${cR._id}`).set(bearer(op, s.A.tenant));
    expect(r1.status).toBe(403);
    const r2 = await request(app).get(`/api/contrats/vente/${cV._id}`).set(bearer(op, s.A.tenant));
    expect(r2.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-18..23 — Cross-tenant isolation on typed surfaces
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Cross-tenant isolation on typed surfaces', () => {
  test('CDS-18 (cross-tenant rental GET blocked)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });
  test('CDS-19 (cross-tenant sale GET blocked)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });
  test('CDS-20 (cross-tenant rental PUT blocked + zero mutation)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const before = await Contrat.findById(c._id).lean();
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 111 });
    expect([403, 404]).toContain(res.status);
    const after = await Contrat.findById(c._id).lean();
    expect(after.montantLoyer).toBe(before.montantLoyer);
  });
  test('CDS-21 (cross-tenant sale PUT blocked + zero mutation)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyB);
    const before = await Contrat.findById(c._id).lean();
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ prixVente: 111 });
    expect([403, 404]).toContain(res.status);
    const after = await Contrat.findById(c._id).lean();
    expect(after.prixVente).toBe(before.prixVente);
  });
  test('CDS-22/23 (cross-tenant DELETE blocked — rental AND sale)', async () => {
    const s = await scenarioAB();
    const cR = await makeLocationContrat(s.propertyB);
    const cV = await makeVenteContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const r1 = await request(app).delete(`/api/contrats/location/${cR._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(r1.status);
    const r2 = await request(app).delete(`/api/contrats/vente/${cV._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(r2.status);
    expect(await Contrat.exists({ _id: cR._id })).toBeTruthy();
    expect(await Contrat.exists({ _id: cV._id })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-24..28 — Payment surface preservation
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Payment surface preservation', () => {
  test('CDS-24 (rental payment read requires location module)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await disableModuleFor(s.A.tenant, 'location');
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(403);
  });
  test('CDS-25 (sale ID rejected by rental payment read → 404 domain mismatch)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(404);
  });
  test('CDS-26/27 (retired payment POST remains 410 on typed rental surface, zero Paiement)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    await Paiement.deleteMany({});
    const res = await request(app).post(`/api/contrats/location/${c._id}/paiements`).set(bearer(admin, s.A.tenant)).send({ montant: 1 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_PAYMENT_ENDPOINT_RETIRED');
    expect(await Paiement.countDocuments({})).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-29..30 — Lifecycle / side-effect regression
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Lifecycle / side-effect preservation', () => {
  test('CDS-29 (rental lease lifecycle regression: PUT status transition still delegated on typed surface)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    // Statut transition légale actif→résilié doit passer par lifecycle
    // service (le controller délègue).
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ statut: 'résilié' });
    expect([200, 409]).toContain(res.status); // 200 si transition permise, 409 sinon
  });
  test('CDS-30 (sale PUT does NOT invoke rental lifecycle service — sale has its OWN machine, SCL-2)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    // SCL-2 : la modification directe de `statut='actif'` est désormais
    // rejetée par la machine d'état VENTE (saleContractLifecycleService) —
    // la seule voie vers `actif` est la transition vers `acte_signe`. La
    // machine d'état LOCATION n'est jamais invoquée (invariant conservé).
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ statut: 'actif' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_STATUT_LOCKED_BY_LIFECYCLE');
    const after = await Contrat.findById(c._id).lean();
    expect(after.statut).toBe('en_attente');
    expect(after.cycleHistory).toEqual([]); // machine LOCATION jamais invoquée
    expect(after.saleCycleHistory).toEqual([]); // aucune transition VENTE effectuée non plus
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-33/34 — Wrong-domain + wrong-tenant compounded
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Wrong-domain + wrong-tenant compound blocks', () => {
  test('CDS-33 (Tenant A rental route cannot expose Tenant B sale contract)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });
  test('CDS-34 (Tenant A sale route cannot expose Tenant B rental contract)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-35 — Marketplace formation regression
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — POST /api/contrats marketplace formation preserved', () => {
  test('CDS-35a (platform.commercial.manage operator still creates via POST /api/contrats)', async () => {
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
  test('CDS-35b (Tenant Admin cannot create via POST /api/contrats)', async () => {
    const s = await scenarioAB();
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).post('/api/contrats').set(bearer(admin, s.A.tenant)).send({
      type: 'location', bien: String(s.propertyA._id),
      dateEntree: new Date('2027-01-01').toISOString(),
      dateFinBail: new Date('2027-12-31').toISOString(),
      montantLoyer: 300000,
    });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CDS-36..40 — Structural + unknown field on typed surfaces
// ─────────────────────────────────────────────────────────────────────────

describe('CDS — Structural integrity on typed surfaces', () => {
  test('CDS-36 (Property rebinding blocked on rental typed PUT)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ bien: String(s.propertyB._id) });
    expect(res.status).toBe(400);
  });
  test('CDS-37 (owner rebinding blocked on sale typed PUT)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(admin, s.A.tenant)).send({ proprietaire: '000000000000000000000009' });
    expect(res.status).toBe(400);
  });
  test('CDS-38 (locataire rebinding blocked on rental typed PUT)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ locataire: '000000000000000000000009' });
    expect(res.status).toBe(400);
  });
  test('CDS-39 (unknown PUT field rejected on rental AND sale)', async () => {
    const s = await scenarioAB();
    const cR = await makeLocationContrat(s.propertyA);
    const cV = await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const r1 = await request(app).put(`/api/contrats/location/${cR._id}`).set(bearer(admin, s.A.tenant)).send({ xyz: 1 });
    expect(r1.status).toBe(400);
    const r2 = await request(app).put(`/api/contrats/vente/${cV._id}`).set(bearer(admin, s.A.tenant)).send({ xyz: 1 });
    expect(r2.status).toBe(400);
  });
  test('CDS-40 (mixed valid+forbidden PUT is atomic — zero partial update)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const before = await Contrat.findById(c._id).lean();
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 999999, type: 'vente' });
    expect(res.status).toBe(400);
    const after = await Contrat.findById(c._id).lean();
    expect(after.montantLoyer).toBe(before.montantLoyer);
    expect(after.type).toBe(before.type);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LEGACY-CDS — Legacy /api/contrats compat wrapper (§16 option B)
// ─────────────────────────────────────────────────────────────────────────

describe('LEGACY-CDS — Polymorphic legacy surface, type-aware wrapper', () => {
  test('LEGACY-CDS-01 (legacy GET still lists both types — polymorphic read compat preserved)', async () => {
    const s = await scenarioAB();
    await makeLocationContrat(s.propertyA);
    await makeVenteContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).get('/api/contrats').set(bearer(admin, s.A.tenant));
    expect(res.status).toBe(200);
    const types = new Set(res.body.data.contrats.map((c) => c.type));
    expect(types.has('location')).toBe(true);
    expect(types.has('vente')).toBe(true);
  });
  // LEGACY-CDS-03/03b/05 étaient certifiées Phase 3 sur le wrapper legacy
  // PUT type-aware. Phase 3C — LEGACY-CONTRAT-MUTATION-RETIREMENT — retire
  // définitivement PUT/DELETE /api/contrats/:id. La certification des
  // invariants (module gate, type immutabilité) est désormais portée par
  // les surfaces typées `/api/contrats/{location|vente}/:id` (voir CDS-02,
  // CDS-08, CDS-12, CDS-13). Ici on assère seulement que la surface
  // legacy retourne bien 410 sans effet de bord ni oracle cross-tenant.
  test('LEGACY-CDS-03 (legacy PUT is retired → 410 CONTRACT_LEGACY_MUTATION_RETIRED, zero mutation)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const before = await Contrat.findById(c._id).lean();
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ montantLoyer: 400000 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
    const after = await Contrat.findById(c._id).lean();
    expect(after.montantLoyer).toBe(before.montantLoyer);
  });
  test('LEGACY-CDS-05 (legacy PUT retired uniformly whatever the payload — no partial write)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const admin = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/${c._id}`).set(bearer(admin, s.A.tenant)).send({ type: 'vente', prixVente: 111 });
    expect(res.status).toBe(410);
    const after = await Contrat.findById(c._id).lean();
    expect(after.type).toBe('location');
  });
});
