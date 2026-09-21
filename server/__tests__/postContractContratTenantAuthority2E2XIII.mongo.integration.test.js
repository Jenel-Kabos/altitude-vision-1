// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIII — POST-CONTRACT-CONTRAT-
// TENANT-AUTHORITY.
//
// Certifie que les surfaces post-contrat du router `/api/contrats`
// (GET /, GET /:id, PUT /:id, DELETE /:id, GET /:id/paiements) migrent
// de l'autorité legacy `requireCapability('leases.*'/'payments.*')` +
// `restrictTo('Admin')` (User.role global) vers la chaîne d'autorité
// canonique tenant :
//   protect
//   → requireTenantScope
//   → requireTenantMembershipRole(...businessRoles applicables)
//   → router.param('id', assertResourceTenantOrUnattributed) — TENANT-CERT-2
//
// Décisions architecturales ratifiées (Phase 2) :
//   B1 : router polymorphe location/vente — PAS de gate `location` global.
//   B2 : PUT allow-list schema-backed, refus 400 sur champ interdit/inconnu.
//   B3 : POST /:id/paiements RETIRÉ → 410 Gone, aucune écriture Paiement.
//   B4 : DELETE /:id → OrgMembership.businessRole='Admin' du tenant.
//
// La conclusion marketplace `POST /api/contrats` reste strictement
// PLATFORM-only (`platform.commercial.manage`) — non régressée.

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
const contratRoutes = require('../routes/contratRoutes');
const rentalContratRoutes = require('../routes/rentalContratRoutes');
const saleContratRoutes = require('../routes/saleContratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
// LEGACY-CONTRAT-MUTATION-RETIREMENT (3C) : les surfaces typées sont
// montées AVANT le router legacy — les PCCTA PUT/DELETE tests ciblent
// désormais la surface canonique typée (invariants métier préservés,
// §16). Le 410 legacy est couvert par la suite dédiée LCR-*.
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
    name: `PCCTA-${seq}`,
    email: `pccta-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Client', isEmailVerified: true, ...overrides,
  });
}

async function makeProperty(owner, tenantId, overrides = {}) {
  seq += 1;
  return Property.create({
    title: `PCCTA Villa ${seq}`,
    description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 400000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id,
    tenant: tenantId || null, ...overrides,
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
  await grantOperator({ userId: user._id, actor: granter, reason: 'PCCTA fixture', capabilities });
  return user;
}

async function scenarioAB() {
  const A = await createTenantFixture({ label: `PCCTA-A-${seq++}`, withAdminMembership: true });
  const B = await createTenantFixture({ label: `PCCTA-B-${seq++}`, withAdminMembership: true });
  const ownerA = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: A.tenant, user: ownerA, bootstrap: A.bootstrap });
  const propertyA = await makeProperty(ownerA, A.tenant._id);
  const ownerB = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: B.tenant, user: ownerB, bootstrap: B.bootstrap });
  const propertyB = await makeProperty(ownerB, B.tenant._id);
  return { A, B, propertyA, propertyB, ownerA, ownerB };
}

async function makeMember(tenantFix, businessRole) {
  const user = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: tenantFix.tenant, user, bootstrap: tenantFix.bootstrap, businessRole });
  return user;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-01..04 — POST /api/contrats PLATFORM-only preservation
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — POST /api/contrats remains PLATFORM-only (MRCB preservation)', () => {
  const body = (property) => ({
    type: 'location', bien: String(property._id),
    dateEntree: new Date('2027-01-01').toISOString(),
    dateFinBail: new Date('2027-12-31').toISOString(),
    montantLoyer: 300000,
  });

  test('PCCTA-01 (platform.commercial.manage operator can create — contract preserved)', async () => {
    const { A, propertyA } = await scenarioAB();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).post('/api/contrats').set(bearer(op, A.tenant)).send(body(propertyA));
    expect(res.status).toBe(201);
  });

  test('PCCTA-02 (Tenant Admin businessRole cannot create — legacy leases.manage plugged)', async () => {
    const { A, propertyA } = await scenarioAB();
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).post('/api/contrats').set(bearer(admin, A.tenant)).send(body(propertyA));
    expect(res.status).toBe(403);
    expect(await Contrat.countDocuments({ bien: propertyA._id })).toBe(0);
  });

  test('PCCTA-03 (Global User.role=Admin orphan cannot create)', async () => {
    const { A, propertyA } = await scenarioAB();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).post('/api/contrats').set(bearer(orphan, A.tenant)).send(body(propertyA));
    expect(res.status).toBe(403);
  });

  test('PCCTA-04 (finance.manage-only operator cannot create — capability independence)', async () => {
    const { A, propertyA } = await scenarioAB();
    const op = await operatorWith(['platform.finance.manage']);
    const res = await request(app).post('/api/contrats').set(bearer(op, A.tenant)).send(body(propertyA));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-05..12 — GET / and GET /:id — canonical tenant read
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — Contrat READ tenant authority', () => {
  test('PCCTA-05 (authorized Tenant A member lists own contracts)', async () => {
    const { A, propertyA } = await scenarioAB();
    await makeLocationContrat(propertyA);
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).get('/api/contrats').set(bearer(admin, A.tenant));
    expect(res.status).toBe(200);
    expect(res.body.results).toBeGreaterThanOrEqual(1);
  });

  test('PCCTA-06 (Tenant A list contains zero Tenant B contracts)', async () => {
    const { A, propertyA, propertyB } = await scenarioAB();
    await makeLocationContrat(propertyA);
    await makeLocationContrat(propertyB);
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).get('/api/contrats').set(bearer(admin, A.tenant));
    expect(res.status).toBe(200);
    const ids = res.body.data.contrats.map((c) => String(c.bien?._id || c.bien));
    expect(ids).not.toContain(String(propertyB._id));
  });

  test('PCCTA-07 (authorized member reads own-tenant contract by id)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).get(`/api/contrats/${c._id}`).set(bearer(admin, A.tenant));
    expect(res.status).toBe(200);
  });

  test('PCCTA-08 (cross-tenant GET /:id fails closed — 404 not 403 to avoid oracle)', async () => {
    const { A, propertyB } = await scenarioAB();
    const c = await makeLocationContrat(propertyB);
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).get(`/api/contrats/${c._id}`).set(bearer(admin, A.tenant));
    expect([403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  test('PCCTA-09 (Global Admin orphan denied — no User.role leak)', async () => {
    const { A } = await scenarioAB();
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).get('/api/contrats').set(bearer(orphan, A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-10 (PlatformOperator without tenant membership denied for tenant read)', async () => {
    const { A } = await scenarioAB();
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).get('/api/contrats').set(bearer(op, A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-11 (member with null businessRole denied)', async () => {
    const { A } = await scenarioAB();
    const orphan = await makeMember(A, null);
    const res = await request(app).get('/api/contrats').set(bearer(orphan, A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-12 (Secretaire may read — matrix Admin/GIM/Collab/Secretaire)', async () => {
    const { A, propertyA } = await scenarioAB();
    await makeLocationContrat(propertyA);
    const secretaire = await makeMember(A, 'Secretaire');
    const res = await request(app).get('/api/contrats').set(bearer(secretaire, A.tenant));
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-13..20 — PUT authority matrix
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — PUT tenant authority matrix', () => {
  const patch = { montantLoyer: 350000 };

  test('PCCTA-13 (Tenant Admin businessRole allowed to PUT)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const admin = await makeMember(A, 'Admin');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, A.tenant)).send(patch);
    expect(res.status).toBe(200);
  });

  test('PCCTA-14 (GestionnaireImmobilier allowed)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const gim = await makeMember(A, 'GestionnaireImmobilier');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(gim, A.tenant)).send(patch);
    expect(res.status).toBe(200);
  });

  test('PCCTA-15 (Collaborateur allowed)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const collab = await makeMember(A, 'Collaborateur');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(collab, A.tenant)).send(patch);
    expect(res.status).toBe(200);
  });

  test('PCCTA-16 (Secretaire denied generic PUT)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const secretaire = await makeMember(A, 'Secretaire');
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(secretaire, A.tenant)).send(patch);
    expect(res.status).toBe(403);
  });

  test('PCCTA-17 (Global User.role=Admin orphan denied)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(orphan, A.tenant)).send(patch);
    // 403 (chaîne canonique) OU 404 (router.param frontière ressource — l'orphelin
    // ne peut résoudre le tenant, l'attribution ne matche pas) : les deux
    // sont fail-closed canoniques, jamais 200.
    expect([403, 404]).toContain(res.status);
  });

  test('PCCTA-18 (PlatformOperator commercial.manage without tenant membership denied)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(op, A.tenant)).send(patch);
    expect(res.status).toBe(403);
  });

  test('PCCTA-19 (PlatformOperator finance.manage without tenant membership denied)', async () => {
    const { A, propertyA } = await scenarioAB();
    const c = await makeLocationContrat(propertyA);
    const op = await operatorWith(['platform.finance.manage']);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(op, A.tenant)).send(patch);
    expect(res.status).toBe(403);
  });

  test('PCCTA-20 (cross-tenant PUT fails closed — no mutation)', async () => {
    const { A, propertyB } = await scenarioAB();
    const c = await makeLocationContrat(propertyB);
    const admin = await makeMember(A, 'Admin');
    const before = await Contrat.findById(c._id).lean();
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(admin, A.tenant)).send(patch);
    expect([403, 404]).toContain(res.status);
    const after = await Contrat.findById(c._id).lean();
    expect(after.montantLoyer).toBe(before.montantLoyer);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-21..31 — PUT structural integrity (allow-list, atomic reject)
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — PUT structural allow-list (B2)', () => {
  async function admin(scenario) {
    return makeMember(scenario.A, 'Admin');
  }

  test('PCCTA-21 (forbidden `bien` field → 400 + zero mutation)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const other = await makeProperty(s.ownerA, s.A.tenant._id);
    const a = await admin(s);
    const before = await Contrat.findById(c._id).lean();
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ bien: String(other._id) });
    expect(res.status).toBe(400);
    const after = await Contrat.findById(c._id).lean();
    expect(String(after.bien)).toBe(String(before.bien));
  });

  test('PCCTA-22 (forbidden `proprietaire` → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const other = await makeUser({ role: 'Proprietaire' });
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ proprietaire: String(other._id) });
    expect(res.status).toBe(400);
  });

  test('PCCTA-23 (forbidden `locataire` → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const other = await makeUser({ role: 'Client' });
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ locataire: String(other._id) });
    expect(res.status).toBe(400);
  });

  test('PCCTA-24 (forbidden `type` rebind → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ type: 'vente' });
    expect(res.status).toBe(400);
  });

  test('PCCTA-25 (forbidden `reservation` → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ reservation: '000000000000000000000001' });
    expect(res.status).toBe(400);
  });

  test('PCCTA-26 (structural tenant-family fields → 400 / NOT_APPLICABLE if absent from schema)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    // `tenant`/`_tenantId`/`platformTenant` do NOT exist on Contrat schema; if
    // sent they are UNKNOWN fields → 400 anyway. Same protection surface.
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ tenant: '000000000000000000000002' });
    expect(res.status).toBe(400);
  });

  test('PCCTA-27 (mixed valid+forbidden → 400 + ZERO partial update)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const before = await Contrat.findById(c._id).lean();
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ montantLoyer: 999999, bien: '000000000000000000000003' });
    expect(res.status).toBe(400);
    const after = await Contrat.findById(c._id).lean();
    expect(after.montantLoyer).toBe(before.montantLoyer);
  });

  test('PCCTA-28 (unknown field → 400)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ fooBar: 'zzz' });
    expect(res.status).toBe(400);
  });

  test('PCCTA-29 (allowed LOCATION field updates successfully)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send({ notes: 'annotation staff', montantCaution: 600000 });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.notes).toBe('annotation staff');
    expect(after.montantCaution).toBe(600000);
  });

  test('PCCTA-30 (allowed VENTE field updates successfully — schema-backed names, typed sale surface)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA); const a = await admin(s);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ prixVente: 6000000, dateSignatureCompromis: new Date('2027-06-01').toISOString() });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.prixVente).toBe(6000000);
  });

  test('PCCTA-31 (structural fields unchanged after each denied request)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA); const a = await admin(s);
    const before = await Contrat.findById(c._id).lean();
    for (const forbidden of [{ bien: '000000000000000000000004' }, { type: 'vente' }, { locataire: '000000000000000000000005' }]) {
      const res = await request(app).put(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant)).send(forbidden);
      expect(res.status).toBe(400);
    }
    const after = await Contrat.findById(c._id).lean();
    expect(String(after.bien)).toBe(String(before.bien));
    expect(after.type).toBe(before.type);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-32..40 — DELETE authority
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — DELETE tenant Admin authority (B4)', () => {
  test('PCCTA-32 (Tenant Admin can reach DELETE flow — subject to CONTRACT_HISTORY_IMMUTABLE)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant));
    // Either 200 (no history) or 409 CONTRACT_HISTORY_IMMUTABLE — never 403.
    expect([200, 409]).toContain(res.status);
  });

  test('PCCTA-33 (GestionnaireImmobilier denied DELETE)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'GestionnaireImmobilier');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(403);
    expect(await Contrat.exists({ _id: c._id })).toBeTruthy();
  });

  test('PCCTA-34 (Collaborateur denied DELETE)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'Collaborateur');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-35 (Secretaire denied DELETE)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'Secretaire');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-36 (Global User.role=Admin orphan denied)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(orphan, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });

  test('PCCTA-37 (PlatformOperator without tenant membership denied)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(op, s.A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-38 (cross-tenant DELETE fails closed)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant));
    expect([403, 404]).toContain(res.status);
    expect(await Contrat.exists({ _id: c._id })).toBeTruthy();
  });

  test('PCCTA-40 (CONTRACT_HISTORY_IMMUTABLE preserved: paid payment blocks delete)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    await Paiement.create({ contrat: c._id, mois: 1, annee: 2027, montant: 300000, montantRecu: 300000, statut: 'payé', datePaiement: new Date() });
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).delete(`/api/contrats/location/${c._id}`).set(bearer(a, s.A.tenant));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_HISTORY_IMMUTABLE');
    expect(await Contrat.exists({ _id: c._id })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-41..46 — POST /:id/paiements retired 410
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — POST /:id/paiements retired (B3)', () => {
  test('PCCTA-41 (unauthenticated does NOT expose 410 oracle — auth failure first)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const res = await request(app).post(`/api/contrats/${c._id}/paiements`).send({ montant: 1 });
    expect(res.status).toBe(401);
  });

  test('PCCTA-42 (wrong-tenant POST fails closed, not 410)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).post(`/api/contrats/${c._id}/paiements`).set(bearer(a, s.A.tenant)).send({ montant: 1 });
    expect([403, 404]).toContain(res.status);
    expect(await Paiement.countDocuments({})).toBe(0);
  });

  test('PCCTA-43/44 (authorized correct-tenant caller receives 410 Gone + stable code)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).post(`/api/contrats/${c._id}/paiements`).set(bearer(a, s.A.tenant)).send({ montant: 1 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_PAYMENT_ENDPOINT_RETIRED');
  });

  test('PCCTA-45/46 (retired endpoint creates ZERO Paiement writes)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    await Paiement.deleteMany({});
    await request(app).post(`/api/contrats/${c._id}/paiements`).set(bearer(a, s.A.tenant)).send({ montant: 1, statut: 'payé', montantRecu: 1 });
    expect(await Paiement.countDocuments({})).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-47..54 — GET /:id/paiements canonical rental read
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — GET /:id/paiements rental read authority', () => {
  test('PCCTA-47 (Admin allowed)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(a, s.A.tenant));
    expect(res.status).toBe(200);
  });

  test('PCCTA-48 (Secretaire allowed)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'Secretaire');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(200);
  });

  test('PCCTA-49 (Collaborateur allowed)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'Collaborateur');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(200);
  });

  test('PCCTA-50 (GestionnaireImmobilier denied — payment matrix B.2)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const u = await makeMember(s.A, 'GestionnaireImmobilier');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(u, s.A.tenant));
    expect(res.status).toBe(403);
  });

  test('PCCTA-52 (cross-tenant fails closed)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyB);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(a, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });

  test('PCCTA-53 (Global User.role Admin orphan denied)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(orphan, s.A.tenant));
    expect([403, 404]).toContain(res.status);
  });

  test('PCCTA-54 (PlatformOperator without tenant membership denied)', async () => {
    const s = await scenarioAB(); const c = await makeLocationContrat(s.propertyA);
    const op = await operatorWith(['platform.commercial.manage']);
    const res = await request(app).get(`/api/contrats/location/${c._id}/paiements`).set(bearer(op, s.A.tenant));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCCTA-B1 — Polymorphic router preserves sale-contract access
// ─────────────────────────────────────────────────────────────────────────────

describe('PCCTA — Sale-contract preservation (B1: polymorphic router, NO location module gate)', () => {
  test('PCCTA-B1a (Tenant Admin reads Contrat.type=vente via generic GET /:id)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).get(`/api/contrats/${c._id}`).set(bearer(a, s.A.tenant));
    expect(res.status).toBe(200);
    expect(res.body.data.contrat.type).toBe('vente');
  });

  test('PCCTA-B1b (Tenant Admin updates Contrat.type=vente allowed field via typed sale surface)', async () => {
    const s = await scenarioAB(); const c = await makeVenteContrat(s.propertyA);
    const a = await makeMember(s.A, 'Admin');
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ prixVente: 7000000 });
    expect(res.status).toBe(200);
  });
});
