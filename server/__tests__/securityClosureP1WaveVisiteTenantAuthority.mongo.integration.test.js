// SECURITY-CLOSURE-P1-WAVE-1 (P1-B, finding RA-06) — reproduction rouge->verte
// PERMANENTE : `visiteController.getAllVisites/getAllPayments/updateVisite/
// updatePaiementVisite/getUnreadCount` n'appliquaient aucune frontière
// tenant (`Visite.tenant` existe dans le schéma mais n'est jamais peuplé).
// Correctif : dérivation via `Visite.property`(Property).owner ->
// OrgMembership.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Visite = require('../models/Visite');
const visiteRoutes = require('../routes/visiteRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/visites', visiteRoutes);
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
async function buildTenantWithVisite(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1b-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1b-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const client = await User.create({ name: `Client ${label}`, email: `p1b-client-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1B-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1B ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  const visite = await Visite.create({ property: property._id, client: client._id, owner: owner._id, paiementStatus: 'en_attente' });
  return { admin, tenant, property, visite };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-B) — GET /api/visites, /all-payments, /unread-count', () => {
  test('1. Admin A ne voit QUE les visites du tenant A', async () => {
    const a = await buildTenantWithVisite('A');
    const b = await buildTenantWithVisite('B');
    const res = await request(app).get('/api/visites').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.visites.map((v) => v._id);
    expect(ids).toContain(String(a.visite._id));
    expect(ids).not.toContain(String(b.visite._id));
  });

  test('2. all-payments scopé par tenant', async () => {
    const a = await buildTenantWithVisite('C');
    const b = await buildTenantWithVisite('D');
    const res = await request(app).get('/api/visites/all-payments').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.visites.map((v) => String(v._id));
    expect(ids).toContain(String(a.visite._id));
    expect(ids).not.toContain(String(b.visite._id));
  });

  test('3. unread-count scopé par tenant', async () => {
    const a = await buildTenantWithVisite('E');
    const _b = await buildTenantWithVisite('F');
    const res = await request(app).get('/api/visites/unread-count').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(1);
  });

  test('4. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantWithVisite('G');
    const b = await buildTenantWithVisite('H');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p1b-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/visites').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-B) — PATCH /:id, /:id/paiement', () => {
  test('5. Admin A ne peut PAS modifier une visite du tenant B', async () => {
    const a = await buildTenantWithVisite('I');
    const b = await buildTenantWithVisite('J');
    const res = await request(app).patch(`/api/visites/${b.visite._id}`).set(bearer(a.admin, a.tenant._id)).send({ notes: 'hack' });
    expect(res.status).not.toBe(200);
    const fresh = await Visite.findById(b.visite._id);
    expect(fresh.notes).not.toBe('hack');
  });

  test('6. Admin A ne peut PAS modifier le paiement d\'une visite du tenant B', async () => {
    const a = await buildTenantWithVisite('K');
    const b = await buildTenantWithVisite('L');
    const res = await request(app).patch(`/api/visites/${b.visite._id}/paiement`).set(bearer(a.admin, a.tenant._id)).send({ paiementStatus: 'payé' });
    expect(res.status).not.toBe(200);
    const fresh = await Visite.findById(b.visite._id);
    expect(fresh.paiementStatus).not.toBe('payé');
  });

  test('7. Admin A PEUT modifier une visite de son propre tenant (comportement historique préservé)', async () => {
    const a = await buildTenantWithVisite('M');
    const res = await request(app).patch(`/api/visites/${a.visite._id}`).set(bearer(a.admin, a.tenant._id)).send({ notes: 'ok' });
    expect(res.status).toBe(200);
  });
});
