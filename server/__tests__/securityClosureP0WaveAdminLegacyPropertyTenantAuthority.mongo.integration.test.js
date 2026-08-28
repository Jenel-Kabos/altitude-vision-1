// SECURITY-CLOSURE-P0-WAVE-1 (P0-E, finding RA-09, source
// TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md) — reproduction
// rouge->verte PERMANENTE : `adminController.js` (`/api/admin/properties*`)
// duplique un flux de modération Property legacy jamais aligné sur
// TENANT-CERT-2 (propertyController.js) — aucune frontière tenant sur
// list/pending/approve/reject/DELETE (hard-delete inclus). Correctif :
// réutilisation du garde canonique `requireTenantScopeForStaffAllowPlatformWide`
// (déjà utilisé par GET /api/properties/status/pending, HZ-07) + une
// vérification tenant équivalente à `assertPropertyTenantAccess`
// (propertyController.js) avant toute mutation/suppression.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const adminRoutes = require('../routes/adminRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
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
async function buildTenantWithProperty(label) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p0e-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p0e-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P0E-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P0E ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    // `tenant` reflète le champ réellement peuplé par les flux de création
    // staff (voir services/accommodationService.js) — c'est la même
    // primitive de filtrage de liste que propertyController.getAllProperties
    // (HZ-07), pas la résolution par appartenance du propriétaire (utilisée,
    // elle, pour l'autorité sur une ressource précise via
    // tenantResourceAttributionService).
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: tenant._id,
  });
  return { admin, owner, tenant, property };
}

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-E) — GET /api/admin/properties, /status/pending', () => {
  test('1. Liste : un Admin du tenant A ne voit QUE les propriétés du tenant A', async () => {
    const a = await buildTenantWithProperty('A');
    const b = await buildTenantWithProperty('B');
    const res = await request(app).get('/api/admin/properties').set(bearer(a.admin, a.tenant._id));
    expect(res.status).toBe(200);
    const ids = res.body.data.properties.map((p) => String(p._id));
    expect(ids).toContain(String(a.property._id));
    expect(ids).not.toContain(String(b.property._id));
  });

  test('2. Pending : route protégée par le même garde tenant (fail-closed pour un staff ambigu)', async () => {
    const a = await buildTenantWithProperty('C');
    const staffMulti = await User.create({ name: 'Staff Multi Pending', email: `p0e-pending-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    const b = await buildTenantWithProperty('D');
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const scoped = await request(app).get('/api/admin/properties/status/pending').set(bearer(a.admin, a.tenant._id));
    expect(scoped.status).toBe(200);
    const ambiguous = await request(app).get('/api/admin/properties/status/pending').set(bearer(staffMulti));
    expect(ambiguous.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-E) — PATCH approve/reject, DELETE', () => {
  test('3. Admin A ne peut PAS approuver une propriété du tenant B', async () => {
    const a = await buildTenantWithProperty('E');
    const b = await buildTenantWithProperty('F');
    const res = await request(app).patch(`/api/admin/properties/${b.property._id}/approve`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('4. Admin A ne peut PAS rejeter une propriété du tenant B', async () => {
    const a = await buildTenantWithProperty('G');
    const b = await buildTenantWithProperty('H');
    const res = await request(app).patch(`/api/admin/properties/${b.property._id}/reject`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(200);
  });

  test('5. Admin A ne peut PAS supprimer (hard-delete) une propriété du tenant B — Property B préservée', async () => {
    const a = await buildTenantWithProperty('I');
    const b = await buildTenantWithProperty('J');
    const res = await request(app).delete(`/api/admin/properties/${b.property._id}`).set(bearer(a.admin, a.tenant._id));
    expect(res.status).not.toBe(204);
    const fresh = await Property.findById(b.property._id);
    expect(fresh).not.toBeNull();
  });

  test('6. Admin A PEUT approuver/supprimer une propriété de son propre tenant (comportement historique préservé)', async () => {
    const a = await buildTenantWithProperty('K');
    const approve = await request(app).patch(`/api/admin/properties/${a.property._id}/approve`).set(bearer(a.admin, a.tenant._id));
    expect(approve.status).toBe(200);
    const del = await request(app).delete(`/api/admin/properties/${a.property._id}`).set(bearer(a.admin, a.tenant._id));
    expect(del.status).toBe(204);
    expect(await Property.findById(a.property._id)).toBeNull();
  });

  test('7. Staff multi-tenant sans en-tête → fail-closed', async () => {
    const a = await buildTenantWithProperty('L');
    const b = await buildTenantWithProperty('M');
    const staffMulti = await User.create({ name: 'Staff Multi', email: `p0e-multi-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: a.tenant.rootOrgUnit, actor: a.admin });
    await organizationService.grantMembership({ userId: staffMulti._id, orgUnitId: b.tenant.rootOrgUnit, actor: b.admin });
    const res = await request(app).get('/api/admin/properties').set(bearer(staffMulti));
    expect(res.status).toBe(403);
  });
});
