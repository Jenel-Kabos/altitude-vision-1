// SECURITY-CLOSURE-P1-WAVE-1 (P1-J, finding RA-15) — reproduction rouge->verte
// PERMANENTE : `GET /api/locataires`, `GET /api/locataires/dossiers`,
// `GET /api/locataires/:id/dossier`, `GET /api/proprietaires` n'appliquaient
// aucune frontière tenant, contrairement aux routes `:id` protégées par
// `assertLocataireInScope`/`assertProprietaireInScope`. Ces modèles n'ont
// aucun champ tenant direct : la frontière canonique est dérivée via
// Contrat.bien(Property).owner -> OrgMembership (Locataire, Proprietaire via
// contrat) ou via Proprietaire.user -> OrgMembership (Proprietaire lié à un
// compte).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const locataireRoutes = require('../routes/locataireRoutes');
const proprietaireRoutes = require('../routes/proprietaireRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/locataires', locataireRoutes);
app.use('/api/proprietaires', proprietaireRoutes);
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
async function buildTenantFixture(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1j-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1j-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1J-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1J ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: `Prop${label}${seq}`, prenom: 'Test', telephone: `+2420603${seq}0001`, user: owner._id });
  const locataire = await Locataire.create({ nom: `Loc${label}${seq}`, prenom: 'Test', telephone: `+2420603${seq}0002` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 100000,
  });
  return { admin, tenant, proprietaire, locataire, contrat };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-J) — Locataire', () => {
  test('1. GET /api/locataires : Admin A ne voit QUE les locataires du tenant A', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).get('/api/locataires').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.locataires.map((l) => l._id);
    expect(ids).toContain(String(a.locataire._id));
    expect(ids).not.toContain(String(b.locataire._id));
  });

  test('2. GET /api/locataires/dossiers : scopé par tenant', async () => {
    const a = await buildTenantFixture('C');
    const b = await buildTenantFixture('D');
    const res = await request(app).get('/api/locataires/dossiers').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.locataires.map((l) => l._id);
    expect(ids).toContain(String(a.locataire._id));
    expect(ids).not.toContain(String(b.locataire._id));
  });

  test('3. GET /api/locataires/:id/dossier : Admin A refusé sur le locataire du tenant B', async () => {
    const a = await buildTenantFixture('E');
    const b = await buildTenantFixture('F');
    const res = await request(app).get(`/api/locataires/${b.locataire._id}/dossier`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('4. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantFixture('G');
    const b = await buildTenantFixture('H');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1j-multi-loc-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/locataires').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-J) — Proprietaire', () => {
  test('5. GET /api/proprietaires : Admin A ne voit QUE les proprietaires du tenant A', async () => {
    const a = await buildTenantFixture('I');
    const b = await buildTenantFixture('J');
    const res = await request(app).get('/api/proprietaires').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.proprietaires.map((p) => p._id);
    expect(ids).toContain(String(a.proprietaire._id));
    expect(ids).not.toContain(String(b.proprietaire._id));
  });

  test('6. Staff multi-tenant sans en-tête → fail-closed (Proprietaire)', async () => {
    const a = await buildTenantFixture('K');
    const b = await buildTenantFixture('L');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1j-multi-prop-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/proprietaires').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});
