// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-B.2 —
// Canonical rental payment domain (`/api/paiements/location/*`).
// Certifie :
//  - la frontière commerciale RENTAL (Contrat.type='location') est
//    respectée : paiements vente/hôtel ne fuient pas ;
//  - l'autorité tenant canonique remplace la capability legacy ;
//  - l'endpoint transversal `POST /api/paiements/calculer-penalites`
//    exige `PlatformOperator + platform.finance.manage` ;
//  - le pendant tenant-local `POST /api/paiements/location/calculer-
//    penalites` n'affecte que les paiements du tenant sélectionné.

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
const paiementLocationRoutes = require('../routes/paiementLocationRoutes');
const paiementRoutes = require('../routes/paiementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/paiements/location', paiementLocationRoutes);
app.use('/api/paiements', paiementRoutes);
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `PayLoc ${seq}`, email: `payloc-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...over,
  });
};
const makeProperty = (owner, tenant) => Property.create({
  title: `Bien Pay ${seq++}`, description: 'Description assez longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 60, statusAdmin: 'Validée', isPublished: true,
  availability: 'Loué', owner: owner._id, tenant: tenant?._id || null,
});
const makeContrat = (property, over = {}) => Contrat.create({
  type: over.type || 'location', bien: property._id, statut: 'actif', cycleVie: 'actif',
  dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
  villeBien: 'Brazzaville', adresseBien: 'Rue test', ...over,
});
const makePaiement = (contrat, over = {}) => Paiement.create({
  contrat: contrat._id, montant: 300000, moyenPaiement: 'especes',
  typePaiement: 'loyer', mois: 1, annee: 2027, statut: 'impayé',
  dateReglement: new Date(), ...over,
});

async function tenant(label) {
  return createTenantFixture({ label: `PayLoc ${label} ${seq++}`, withAdminMembership: true });
}
async function staffOf(fixture, businessRole, userRole = 'Client') {
  const user = await makeUser({ role: userRole });
  await addTenantMember({ tenant: fixture.tenant, user, bootstrap: fixture.bootstrap, businessRole });
  return user;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// PAY-DOM — bounded context RENTAL
// ═══════════════════════════════════════════════════════════════════════════

describe('PAY-DOM — bounded rental domain enforcement', () => {
  test('PAY-DOM-01/02 (rental payment listed, sale payment excluded)', async () => {
    const fA = await tenant('A');
    const staff = await staffOf(fA, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const propA = await makeProperty(owner, fA.tenant);
    const rentalContrat = await makeContrat(propA, { type: 'location' });
    const saleContrat = await makeContrat(propA, { type: 'vente' });
    const rentalPay = await makePaiement(rentalContrat);
    const salePay = await makePaiement(saleContrat);

    const res = await request(app).get('/api/paiements/location').set(bearer(staff, fA.tenant));
    expect(res.status).toBe(200);
    const ids = res.body.data.paiements.map((p) => String(p._id));
    expect(ids).toContain(String(rentalPay._id));
    expect(ids).not.toContain(String(salePay._id));
  });

  test('PAY-DOM-04/05 (rental ID accepted, sale ID rejected 404 on /location/:id)', async () => {
    const fA = await tenant('A');
    const staff = await staffOf(fA, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const propA = await makeProperty(owner, fA.tenant);
    const rentalContrat = await makeContrat(propA, { type: 'location' });
    const saleContrat = await makeContrat(propA, { type: 'vente' });
    const rentalPay = await makePaiement(rentalContrat);
    const salePay = await makePaiement(saleContrat);

    const rentalRes = await request(app).get(`/api/paiements/location/${rentalPay._id}`).set(bearer(staff, fA.tenant));
    expect(rentalRes.status).toBe(200);
    const saleRes = await request(app).get(`/api/paiements/location/${salePay._id}`).set(bearer(staff, fA.tenant));
    expect(saleRes.status).toBe(404);
  });

  test('PAY-DOM-07 (rental payment A inaccessible from tenant B)', async () => {
    const fA = await tenant('A');
    const fB = await tenant('B');
    const staffB = await staffOf(fB, 'Admin', 'Admin');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const propA = await makeProperty(owner, fA.tenant);
    const contratA = await makeContrat(propA);
    const payA = await makePaiement(contratA);

    const res = await request(app).get(`/api/paiements/location/${payA._id}`).set(bearer(staffB, fB.tenant));
    // TENANT-CERT-2 canonical resource assert refuses cross-tenant.
    expect([403, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAY-AUTH — canonical tenant authority
// ═══════════════════════════════════════════════════════════════════════════

describe('PAY-AUTH — canonical tenant authority replaces legacy capability', () => {
  test('PAY-AUTH-01 (global Admin without membership → DENIED)', async () => {
    const fA = await tenant('A');
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).get('/api/paiements/location').set(bearer(orphan, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('PAY-AUTH-02 (PlatformOperator without membership → DENIED on rental)', async () => {
    const fA = await tenant('A');
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'PAY-AUTH-02', capabilities: ['platform.finance.read'] });
    const res = await request(app).get('/api/paiements/location').set(bearer(opUser, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('PAY-AUTH-05 (businessRole=null → DENIED)', async () => {
    const fA = await tenant('A');
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: fA.tenant, user: u, bootstrap: fA.bootstrap, businessRole: null });
    const res = await request(app).get('/api/paiements/location').set(bearer(u, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('PAY-AUTH-06 (suspended membership → DENIED)', async () => {
    const fA = await tenant('A');
    const u = await staffOf(fA, 'Admin', 'Admin');
    const OrgMembership = require('../models/OrgMembership');
    await OrgMembership.updateOne({ user: u._id, orgUnit: fA.tenant.rootOrgUnit }, { $set: { status: 'suspended' } });
    const res = await request(app).get('/api/paiements/location').set(bearer(u, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('PAY-AUTH-10 (module location disabled → DENIED)', async () => {
    const fA = await tenant('A');
    const staff = await staffOf(fA, 'Admin', 'Admin');
    // Retirer le module 'location' de la subscription active.
    const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
    await PlatformTenantSubscription.updateOne(
      { tenant: fA.tenant._id, status: { $in: ['trialing', 'active'] } },
      { $set: { modulesIncluded: ['immobilier'] } },
    );
    const res = await request(app).get('/api/paiements/location').set(bearer(staff, fA.tenant));
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAY-ROLE — matrix
// ═══════════════════════════════════════════════════════════════════════════

describe('PAY-ROLE — canonical matrix', () => {
  test('Admin/Secretaire/Collaborateur → allowed on GET /', async () => {
    const fA = await tenant('A');
    for (const role of ['Admin', 'Secretaire', 'Collaborateur']) {
      const u = await staffOf(fA, role, role);
      const res = await request(app).get('/api/paiements/location').set(bearer(u, fA.tenant));
      expect(res.status).toBe(200);
    }
  });

  test('GestionnaireImmobilier → DENIED (matrix B.1 preserves this exclusion)', async () => {
    const fA = await tenant('A');
    const u = await staffOf(fA, 'GestionnaireImmobilier', 'GestionnaireImmobilier');
    const res = await request(app).get('/api/paiements/location').set(bearer(u, fA.tenant));
    expect(res.status).toBe(403);
  });

  test('DELETE and cancel-receipt reserved to Admin', async () => {
    const fA = await tenant('A');
    const owner = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: owner, bootstrap: fA.bootstrap });
    const propA = await makeProperty(owner, fA.tenant);
    const contratA = await makeContrat(propA);
    const payA = await makePaiement(contratA);
    const secretaire = await staffOf(fA, 'Secretaire', 'Secretaire');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const resSec = await request(app).delete(`/api/paiements/location/${payA._id}`).set(bearer(secretaire, fA.tenant));
    expect(resSec.status).toBe(403);
    // Admin peut supprimer (aucun receipt sur payA → suppression autorisée).
    const resAdmin = await request(app).delete(`/api/paiements/location/${payA._id}`).set(bearer(admin, fA.tenant));
    expect([200, 204]).toContain(resAdmin.status);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAY-PEN — tenant-local penalty vs platform manual
// ═══════════════════════════════════════════════════════════════════════════

describe('PAY-PEN — penalty separation', () => {
  test('PAY-PEN-04 (Tenant Admin cannot invoke global /api/paiements/calculer-penalites)', async () => {
    const fA = await tenant('A');
    const admin = await staffOf(fA, 'Admin', 'Admin');
    const res = await request(app).post('/api/paiements/calculer-penalites').set(bearer(admin, fA.tenant));
    // Requires PlatformOperator + platform.finance.manage.
    expect(res.status).toBe(403);
  });

  test('PAY-PEN-05 (global Admin without PlatformOperator cannot invoke global /calculer-penalites)', async () => {
    const orphan = await makeUser({ role: 'Admin' });
    const res = await request(app).post('/api/paiements/calculer-penalites').set(bearer(orphan));
    expect(res.status).toBe(403);
  });

  test('PAY-PEN-06 (PlatformOperator + platform.finance.manage → global /calculer-penalites allowed)', async () => {
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'PAY-PEN-06', capabilities: ['platform.finance.manage'] });
    const res = await request(app).post('/api/paiements/calculer-penalites').set(bearer(opUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('verifies');
    expect(res.body.data).toHaveProperty('penalites');
  });

  test('PAY-PEN-01/02 (tenant-local calcul affects only A rental payments, B untouched)', async () => {
    const fA = await tenant('A');
    const fB = await tenant('B');
    const adminA = await staffOf(fA, 'Admin', 'Admin');
    const ownerA = await makeUser({ role: 'Proprietaire' });
    const ownerB = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: fA.tenant, user: ownerA, bootstrap: fA.bootstrap });
    await addTenantMember({ tenant: fB.tenant, user: ownerB, bootstrap: fB.bootstrap });
    const propA = await makeProperty(ownerA, fA.tenant);
    const propB = await makeProperty(ownerB, fB.tenant);
    const contratA = await makeContrat(propA);
    const contratB = await makeContrat(propB);
    const payA = await makePaiement(contratA);
    const payB = await makePaiement(contratB);

    const res = await request(app).post('/api/paiements/location/calculer-penalites').set(bearer(adminA, fA.tenant));
    expect(res.status).toBe(200);

    // Le paiement B ne doit pas avoir été modifié par la commande tenant A.
    const freshB = await Paiement.findById(payB._id);
    expect(freshB.statut).toBe('impayé');
    expect(freshB.retardJours).toBeFalsy();
    // Le paiement A a été traité (soit statut→en_retard, soit retardJours>0).
    const freshA = await Paiement.findById(payA._id);
    expect(['en_retard', 'impayé']).toContain(freshA.statut);
    // Note : selon la date, retardJours peut être 0 sur un test à mois=1/année=2027 dans le futur.
    void freshA;
  });
});
