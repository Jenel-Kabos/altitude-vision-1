// SECURITY-CLOSURE-P1-WAVE-1 (P1-E, finding RA-10) — reproduction rouge->verte
// PERMANENTE : `accommodationController.updateFull` (PUT
// /api/accommodations/admin/:propertyId) n'appliquait jamais
// `assertAccommodationAccessible`, contrairement à
// update/submit/reviewDecision/deactivate/reactivate/duplicate/remove du
// même fichier. Correctif : même garde canonique, appliqué avant toute
// mutation de `property`.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const accommodationRoutes = require('../routes/accommodationRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/accommodations', accommodationRoutes);
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
  const admin = await User.create({ name: `Admin ${label}`, email: `p1e-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1e-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1E-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P1E ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Studio', status: 'hebergement', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  const accommodation = await Accommodation.create({
    property: property._id, accommodationType: 'studio_meuble', occupancyMode: 'unit_based',
    createdBy: owner._id, tenant: tenant._id,
  });
  return { admin, owner, tenant, property, accommodation };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-E) — PUT /api/accommodations/admin/:propertyId', () => {
  test('1. Admin A ne peut PAS modifier un hébergement du tenant B', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).put(`/api/accommodations/admin/${b.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'HACKED' });
    expect(res.status).not.toBe(200);
    const fresh = await Property.findById(b.property._id);
    expect(fresh.title).not.toBe('HACKED');
  });

  test('2. Admin A PEUT modifier son propre hébergement (comportement historique préservé)', async () => {
    const a = await buildTenantFixture('C');
    const res = await request(app).put(`/api/accommodations/admin/${a.property._id}`).set(bearer(a.admin, a.tenant._id)).send({ title: 'Titre mis a jour' });
    expect(res.status).toBe(200);
    const fresh = await Property.findById(a.property._id);
    expect(fresh.title).toBe('Titre mis a jour');
  });
});
