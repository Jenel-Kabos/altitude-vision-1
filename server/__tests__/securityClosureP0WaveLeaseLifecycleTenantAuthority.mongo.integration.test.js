// SECURITY-CLOSURE-P0-WAVE-1 (P0-D, finding RA-05, source
// TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md) — reproduction
// rouge->verte PERMANENTE : `rentalLeaseLifecycleController.*` (transition,
// renouvellement, avenants, opérations de caution) opère sur le même modèle
// `Contrat` que `contratRoutes.js`/`paiementRoutes.js`, mais n'avait jamais
// reçu le `router.param('id', …)` tenant (TENANT-CERT-2) qui protège déjà
// ces deux fichiers. Correctif : réutilisation verbatim du même garde
// canonique dans `rentalLeaseLifecycleRoutes.js`.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const rentalLeaseLifecycleRoutes = require('../routes/rentalLeaseLifecycleRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-lease-lifecycle', rentalLeaseLifecycleRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildLeaseFixture(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p0d-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p0d-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P0D-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P0D ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: `Prop${label}${seq}`, prenom: 'Test', telephone: `+2420601${seq}0001` });
  const locataire = await Locataire.create({ nom: `Loc${label}${seq}`, prenom: 'Test', telephone: `+2420601${seq}0002` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 300000,
  });
  return { admin, tenant, contrat };
}

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-D) — POST /:id/transition, /:id/caution/encaisser', () => {
  test('1. Tenant A → Contrat A : transition historique préservée', async () => {
    const a = await buildLeaseFixture('A');
    const res = await request(app).post(`/api/rental-lease-lifecycle/${a.contrat._id}/transition`).set(bearer(a.admin, a.tenant._id)).send({ target: 'preavis' });
    expect(res.status).toBe(200);
    expect(res.body.data.contrat.cycleVie).toBe('preavis');
  });

  test('2. Tenant A → Contrat B : transition refusée', async () => {
    const a = await buildLeaseFixture('B');
    const b = await buildLeaseFixture('C');
    const res = await request(app).post(`/api/rental-lease-lifecycle/${b.contrat._id}/transition`).set(bearer(a.admin, a.tenant._id)).send({ target: 'preavis' });
    expect(res.status).not.toBe(200);
    const fresh = await Contrat.findById(b.contrat._id);
    expect(fresh.cycleVie).toBe('actif');
  });

  test('3. Tenant A → Contrat B : encaissement de caution refusé, aucun effet de bord', async () => {
    const a = await buildLeaseFixture('D');
    const b = await buildLeaseFixture('E');
    const res = await request(app).post(`/api/rental-lease-lifecycle/${b.contrat._id}/caution/encaisser`).set(bearer(a.admin, a.tenant._id)).send({ montant: 300000 });
    expect(res.status).not.toBe(200);
    const fresh = await Contrat.findById(b.contrat._id);
    expect(fresh.cautionVersee).not.toBe(true);
    expect(fresh.caution?.statut).not.toBe('versee');
  });

  test('4. Tenant A → Contrat A : encaissement de caution autorisé (comportement historique préservé)', async () => {
    const a = await buildLeaseFixture('F');
    const res = await request(app).post(`/api/rental-lease-lifecycle/${a.contrat._id}/caution/encaisser`).set(bearer(a.admin, a.tenant._id)).send({ montant: 300000 });
    expect(res.status).toBe(200);
    const fresh = await Contrat.findById(a.contrat._id);
    expect(fresh.cautionVersee).toBe(true);
  });

  test('5. Staff sans tenant résolu (aucun en-tête, multi-appartenance) → fail-closed', async () => {
    const a = await buildLeaseFixture('G');
    const b = await buildLeaseFixture('H');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p0d-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).post(`/api/rental-lease-lifecycle/${a.contrat._id}/transition`).set(bearer(staffMulti)).send({ target: 'preavis' });
    expect(res.status).not.toBe(200);
  });

  test('6. available-transitions (GET) reste accessible pour le bon tenant', async () => {
    const a = await buildLeaseFixture('I');
    const res = await request(app).get(`/api/rental-lease-lifecycle/${a.contrat._id}/available-transitions`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
  });
});
