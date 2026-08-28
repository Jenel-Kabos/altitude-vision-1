// SECURITY-CLOSURE-P1-WAVE-1 (P1-F, finding RA-11) — reproduction rouge->verte
// PERMANENTE : `salePropertyController.updateFull`/`rentalPropertyController.
// updateFull` (PUT /api/admin/properties/{sales,rentals}/:propertyId)
// vérifiaient déjà l'ownership pour un Proprietaire (UX-OWNER-2), mais
// jamais de frontière tenant pour le staff — contrairement à
// `propertyController.updateProperty` sur le même modèle `Property`
// (TENANT-CERT-2). Correctif : même primitive canonique
// (`assertResourceTenantOrUnattributed`), réutilisée directement.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const salePropertyRoutes = require('../routes/salePropertyRoutes');
const rentalPropertyRoutes = require('../routes/rentalPropertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/admin/properties/sales', salePropertyRoutes);
app.use('/api/admin/properties/rentals', rentalPropertyRoutes);
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
async function buildTenantFixture(label, status) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p1f-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1f-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1F-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1F ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status, price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  return { admin, owner, tenant, property };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-F) — sales/updateFull', () => {
  test('1. Admin A ne peut PAS modifier une annonce vente du tenant B', async () => {
    const a = await buildTenantFixture('A', 'vente');
    const b = await buildTenantFixture('B', 'vente');
    const res = await request(app).put(`/api/admin/properties/sales/${b.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'HACKED' });
    expect(res.status).not.toBe(200);
    const fresh = await Property.findById(b.property._id);
    expect(fresh.title).not.toBe('HACKED');
  });

  test('2. Admin A PEUT modifier sa propre annonce vente', async () => {
    const a = await buildTenantFixture('C', 'vente');
    const res = await request(app).put(`/api/admin/properties/sales/${a.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'Titre vente maj' });
    expect(res.status).toBe(200);
  });
});

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-F) — rentals/updateFull', () => {
  test('3. Admin A ne peut PAS modifier une annonce location du tenant B', async () => {
    const a = await buildTenantFixture('D', 'location');
    const b = await buildTenantFixture('E', 'location');
    const res = await request(app).put(`/api/admin/properties/rentals/${b.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'HACKED' });
    expect(res.status).not.toBe(200);
    const fresh = await Property.findById(b.property._id);
    expect(fresh.title).not.toBe('HACKED');
  });

  test('4. Admin A PEUT modifier sa propre annonce location', async () => {
    const a = await buildTenantFixture('F', 'location');
    const res = await request(app).put(`/api/admin/properties/rentals/${a.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'Titre location maj' });
    expect(res.status).toBe(200);
  });

  test('5. Proprietaire B toujours refusé sur le bien du Proprietaire A (comportement historique préservé)', async () => {
    const a = await buildTenantFixture('G', 'location');
    const b = await buildTenantFixture('H', 'location');
    const res = await request(app).put(`/api/admin/properties/rentals/${a.property._id}`).set(bearer(b.owner)).send({ title: 'HACKED' });
    expect(res.status).not.toBe(200);
  });
});
