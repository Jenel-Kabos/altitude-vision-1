// SECURITY-CLOSURE-P1-WAVE-1 (P1-A, finding RA-04) — reproduction rouge->verte
// PERMANENTE : `GET /api/contrats` (contratController.getAll) n'appliquait
// aucune frontière tenant, contrairement à `GET/PUT/DELETE /:id` du même
// fichier (protégés par router.param, TENANT-CERT-2). Correctif : même
// relation canonique que P0-B (Property.owner -> OrgMembership).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/contrats', contratRoutes);
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
async function buildTenantWithContrat(label, montantLoyer) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1a-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1a-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1A-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1A ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: `Prop${label}${seq}`, prenom: 'Test', telephone: `+2420602${seq}0001` });
  const locataire = await Locataire.create({ nom: `Loc${label}${seq}`, prenom: 'Test', telephone: `+2420602${seq}0002` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer,
  });
  return { admin, tenant, contrat };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-A) — GET /api/contrats', () => {
  test('1. Admin A ne voit QUE les contrats du tenant A', async () => {
    const a = await buildTenantWithContrat('A', 111111);
    const _b = await buildTenantWithContrat('B', 222222);
    const res = await request(app).get('/api/contrats').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const montants = res.body.data.contrats.map((c) => c.montantLoyer);
    expect(montants).toContain(111111);
    expect(montants).not.toContain(222222);
  });

  test('2. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantWithContrat('C', 30000);
    const b = await buildTenantWithContrat('D', 40000);
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1a-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/contrats').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });

  test('3. Contrat detail (:id) reste inchangé — non-régression', async () => {
    const a = await buildTenantWithContrat('E', 50000);
    const res = await request(app).get(`/api/contrats/${a.contrat._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
  });
});
