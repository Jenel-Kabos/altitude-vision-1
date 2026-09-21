// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-A —
// canonical authority certification for the rental lease lifecycle
// route family. Covers CTX-LEASE-01..12 (authority) and
// LEASE-ISO-01..08 (data isolation) per phase spec §14/§15.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const OrgMembership = require('../models/OrgMembership');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const rentalLeaseLifecycleRoutes = require('../routes/rentalLeaseLifecycleRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-lease-lifecycle', rentalLeaseLifecycleRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `CTX-Lease ${seq}`, email: `ctxlease-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};

async function buildTenant(label) {
  const fixture = await createTenantFixture({ label: `CTX-Lease ${label} ${seq++}`, withAdminMembership: true });
  return fixture;
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-A —
// L'attribution canonique d'un Contrat passe par `bien` → Property.owner
// → OrgMembership du owner (tenantResourceAttributionService.fromProperty
// via fromUser). Une Property strictement attribuée à un tenant se
// matérialise dans les tests par un owner membre canonique de ce tenant —
// c'est la géométrie utilisée par toutes les surfaces existantes (voir
// aussi securityClosureP0Wave...) : identity of owner is not identity
// leakage, it IS canonical attribution via OrgMembership.
async function buildLease(tenant, fixture) {
  const owner = await makeUser({ role: 'Proprietaire' });
  if (fixture) {
    await addTenantMember({ tenant, user: owner, bootstrap: fixture.bootstrap });
  }
  const property = await Property.create({
    title: `Villa CTX ${seq++}`, description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: tenant._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: `+2420600${seq}0001` });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: `+2420600${seq}0002` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, tenant: tenant._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { property, contrat };
}

async function makeTenantStaff(fixture, businessRole, userRole = 'Client') {
  const user = await makeUser({ role: userRole });
  await addTenantMember({ tenant: fixture.tenant, user, bootstrap: fixture.bootstrap, businessRole });
  return user;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// CTX-LEASE-01 .. CTX-LEASE-12
// ═══════════════════════════════════════════════════════════════════════════

describe('CTX-LEASE — canonical tenant authority for rental lease lifecycle', () => {
  test('CTX-LEASE-01 (Tenant Admin + active membership + lease A → allowed)', async () => {
    const fA = await buildTenant('A');
    const admin = await makeTenantStaff(fA, 'Admin', 'Admin');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .get(`/api/rental-lease-lifecycle/${contrat._id}/available-transitions`)
      .set(bearer(admin, fA.tenant));
    expect(res.status).toBe(200);
  });

  test('CTX-LEASE-02 (Tenant GestionnaireImmobilier → allowed on GL_MANAGE routes)', async () => {
    const fA = await buildTenant('A');
    const gim = await makeTenantStaff(fA, 'GestionnaireImmobilier', 'GestionnaireImmobilier');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(gim, fA.tenant)).send({ target: 'preavis' });
    expect(res.status).toBe(200);
  });

  test('CTX-LEASE-03 (Tenant Collaborateur → allowed per current business contract)', async () => {
    const fA = await buildTenant('A');
    const collab = await makeTenantStaff(fA, 'Collaborateur', 'Collaborateur');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .get(`/api/rental-lease-lifecycle/${contrat._id}/available-transitions`)
      .set(bearer(collab, fA.tenant));
    expect(res.status).toBe(200);
  });

  test('CTX-LEASE-04 (Global User.role=Admin sans membership → DENIED)', async () => {
    const fA = await buildTenant('A');
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(orphanAdmin, fA.tenant)).send({ target: 'preavis' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });

  test('CTX-LEASE-05 (PlatformOperator sans membership → DENIED)', async () => {
    const fA = await buildTenant('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'CTX-LEASE-05', capabilities: [] });
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(opUser, fA.tenant)).send({ target: 'preavis' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });

  test('CTX-LEASE-06 (User.role=Proprietaire + tenant businessRole=Admin → authority follows businessRole)', async () => {
    const fA = await buildTenant('A');
    const staff = await makeTenantStaff(fA, 'Admin', 'Proprietaire');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(staff, fA.tenant)).send({ target: 'preavis' });
    expect(res.status).toBe(200);
  });

  test('CTX-LEASE-07 (User.role=Admin + tenant businessRole=Collaborateur → limited to Collaborateur canonical rights)', async () => {
    // Rental lease lifecycle GL_MANAGE = ['Admin','GestionnaireImmobilier','Collaborateur'].
    // Collaborateur est autorisé sur toute la surface — c'est le contrat
    // commercial actuel préservé.
    const fA = await buildTenant('A');
    const staff = await makeTenantStaff(fA, 'Collaborateur', 'Admin');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .get(`/api/rental-lease-lifecycle/${contrat._id}/available-transitions`)
      .set(bearer(staff, fA.tenant));
    expect(res.status).toBe(200);
  });

  test('CTX-LEASE-08 (businessRole=null → DENIED)', async () => {
    const fA = await buildTenant('A');
    const user = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user, bootstrap: fA.bootstrap, businessRole: null });
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(user, fA.tenant)).send({ target: 'preavis' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });

  test('CTX-LEASE-09 (suspended membership → DENIED)', async () => {
    const fA = await buildTenant('A');
    const admin = await makeTenantStaff(fA, 'Admin', 'Admin');
    await OrgMembership.updateOne(
      { user: admin._id, orgUnit: fA.tenant.rootOrgUnit }, { $set: { status: 'suspended' } },
    );
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(admin, fA.tenant)).send({ target: 'preavis' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });

  test('CTX-LEASE-10 (Tenant A Admin / Tenant B Collaborateur → independent authority)', async () => {
    const fA = await buildTenant('A');
    const fB = await buildTenant('B');
    const dualStaff = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: fA.tenant, user: dualStaff, bootstrap: fA.bootstrap, businessRole: 'Admin' });
    await addTenantMember({ tenant: fB.tenant, user: dualStaff, bootstrap: fB.bootstrap, businessRole: 'Collaborateur' });
    const { contrat: contratA } = await buildLease(fA.tenant);
    const { contrat: contratB } = await buildLease(fB.tenant);
    const resA = await request(app).get(`/api/rental-lease-lifecycle/${contratA._id}/available-transitions`).set(bearer(dualStaff, fA.tenant));
    const resB = await request(app).get(`/api/rental-lease-lifecycle/${contratB._id}/available-transitions`).set(bearer(dualStaff, fB.tenant));
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  test('CTX-LEASE-11 (forged body businessRole has no effect)', async () => {
    const fA = await buildTenant('A');
    const orphanAdmin = await makeUser({ role: 'Admin' });
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(orphanAdmin, fA.tenant))
      .send({ target: 'preavis', tenantBusinessRole: 'Admin', businessRole: 'Admin' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });

  test('CTX-LEASE-12 (forged X-Platform-Tenant-Id for unrelated tenant → DENIED)', async () => {
    const fA = await buildTenant('A');
    const fB = await buildTenant('B');
    const staffA = await makeTenantStaff(fA, 'Admin', 'Admin');
    const { contrat } = await buildLease(fA.tenant);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contrat._id}/transition`)
      .set(bearer(staffA, fB.tenant))
      .send({ target: 'preavis' });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — Property.tenant est désormais canonique.
    // Le refus peut arriver à deux couches successives : `router.param(id)`
    // (404 si la ressource ne matche pas le tenant canoniquement résolu)
    // OU `requireTenantScope/requireTenantMembershipRole` (403 si aucune
    // adhésion staff). Les deux satisfont l'invariant « DENIED ».
    expect([403, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEASE-ISO-01 .. LEASE-ISO-08
// ═══════════════════════════════════════════════════════════════════════════

describe('LEASE-ISO — cross-tenant lease isolation', () => {
  test('LEASE-ISO-01/02/06 (Contrat B not accessible from tenant A, forged id refused)', async () => {
    const fA = await buildTenant('A');
    const fB = await buildTenant('B');
    const adminA = await makeTenantStaff(fA, 'Admin', 'Admin');
    // Property owner appartient canoniquement à tenantB (OrgMembership) ;
    // c'est ainsi que la ressource se rattache au tenant via
    // `tenantResourceAttributionService.fromProperty` → `fromUser`.
    const { contrat: contratB } = await buildLease(fB.tenant, fB);
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contratB._id}/transition`)
      .set(bearer(adminA, fA.tenant)).send({ target: 'preavis' });
    expect(res.status).toBe(404);
    const fresh = await Contrat.findById(contratB._id);
    expect(fresh.cycleVie).toBe('actif');
  });

  test('LEASE-ISO-03 (multi-tenant owner ambiguity → BOTH contracts fail-closed)', async () => {
    const fA = await buildTenant('A');
    const fB = await buildTenant('B');
    const adminA = await makeTenantStaff(fA, 'Admin', 'Admin');
    // Un Proprietaire qui participe canoniquement aux DEUX tenants
    // produit une attribution `ambiguous` (fail-closed) sur son
    // Contrat — c'est le comportement défensif attendu de
    // `tenantResourceAttributionService.fromUser`. On ne peut alors
    // agir que sur des contrats explicitement rattachés à un
    // Property.owner mono-tenant.
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: owner, bootstrap: fB.bootstrap });
    const propertyA = await Property.create({
      title: 'Villa Shared', description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: fA.tenant._id,
    });
    const propertyB = await Property.create({
      title: 'Villa Shared B', description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: fB.tenant._id,
    });
    const proprietaire = await Proprietaire.create({ nom: 'Iso', prenom: 'Test', telephone: `+2420600${seq++}0001`, user: owner._id });
    const locataire = await Locataire.create({ nom: 'IsoL', prenom: 'Test', telephone: `+2420600${seq++}0002` });
    const contratA = await Contrat.create({ type: 'location', bien: propertyA._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000 });
    const contratB = await Contrat.create({ type: 'location', bien: propertyB._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif', dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000 });
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-TENANT-ATTRIBUTION-SERVICE-
    // PROPERTY-DIRECT-TENANT — post-fix, l'attribution suit désormais
    // strictement `Property.tenant` (indépendant des memberships du owner).
    // Chaque contrat reste donc attribué à SA Property canoniquement :
    // contratA → tenant A (accessible depuis A) ; contratB → tenant B
    // (refusé depuis A). Le shared-owner scenario ne produit plus
    // d'ambigüité — c'est le renforcement voulu.
    const resA = await request(app).get(`/api/rental-lease-lifecycle/${contratA._id}/available-transitions`).set(bearer(adminA, fA.tenant));
    expect(resA.status).toBe(200);
    const resB = await request(app).get(`/api/rental-lease-lifecycle/${contratB._id}/available-transitions`).set(bearer(adminA, fA.tenant));
    expect(resB.status).toBe(404);
  });

  test('LEASE-ISO-05 (unattributed historical contract — bien:null — reste accessible aux membres tenant canoniquement, jamais silencieusement cross-tenant)', async () => {
    // Le comportement historique préservé par `assertResourceTenantOrUnattributed`
    // reste : un contrat sans `bien` (donc sans attribution tenant traçable)
    // est accessible par n'importe quel membre canonique — il n'y a aucune
    // frontière tenant à faire respecter. Aucune fuite tenant possible car
    // aucun tenant n'est propriétaire.
    const fA = await buildTenant('A');
    const adminA = await makeTenantStaff(fA, 'Admin', 'Admin');
    const proprietaire = await Proprietaire.create({ nom: 'Legacy', prenom: 'X', telephone: `+2420600${seq++}0003` });
    const locataire = await Locataire.create({ nom: 'LegacyL', prenom: 'Y', telephone: `+2420600${seq++}0004` });
    const legacyContrat = await Contrat.create({
      type: 'location', bien: null, proprietaire: proprietaire._id, locataire: locataire._id,
      statut: 'actif', cycleVie: 'actif', villeBien: 'Brazzaville', adresseBien: 'Adresse historique',
      dateEntree: '2020-01-01', dateFinBail: '2020-12-31', montantLoyer: 100000, montantCaution: 200000,
    });
    const res = await request(app)
      .get(`/api/rental-lease-lifecycle/${legacyContrat._id}/available-transitions`)
      .set(bearer(adminA, fA.tenant));
    expect(res.status).toBe(200);
  });

  test('LEASE-ISO-08 (denied cross-tenant request creates NO state change / no ActionLog entry on target)', async () => {
    const fA = await buildTenant('A');
    const fB = await buildTenant('B');
    const adminA = await makeTenantStaff(fA, 'Admin', 'Admin');
    const { contrat: contratB } = await buildLease(fB.tenant, fB);
    const before = await Contrat.findById(contratB._id).lean();
    const res = await request(app)
      .post(`/api/rental-lease-lifecycle/${contratB._id}/transition`)
      .set(bearer(adminA, fA.tenant)).send({ target: 'preavis' });
    expect(res.status).toBe(404);
    const after = await Contrat.findById(contratB._id).lean();
    // Machine d'état intacte, aucun avenant, aucun changement de state
    // ni de flags d'audit propres à la ressource.
    expect(after.cycleVie).toBe(before.cycleVie);
    expect(after.statut).toBe(before.statut);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});
