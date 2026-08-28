// SECURITY-CLOSURE-P1-WAVE-1 (P1-G, finding RA-12) — reproduction rouge->verte
// PERMANENTE : `propertyAssetController.transition` (POST
// /api/property-asset/:id/transition) n'appliquait AUCUNE vérification
// d'accès. La route exige déjà `requireCapability('properties.update')` =
// STAFF_IMMO, donc répliquer `assertReadAccess` (ROLES_DOCS) aurait été un
// no-op de sécurité (RBAC déjà garanti par la route) tout en risquant de
// bloquer à tort un GestionnaireImmobilier (absent de ROLES_DOCS). Le vrai
// manque est la dimension tenant : un staff de N'IMPORTE QUEL tenant
// pouvait transitionner N'IMPORTE QUEL bien. Correctif : même primitive
// canonique que P1-F (`assertResourceTenantOrUnattributed`).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const propertyAssetRoutes = require('../routes/propertyAssetRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/property-asset', propertyAssetRoutes);
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
  const gestionnaire = await User.create({ name: `Gest ${label}`, email: `p1g-gest-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'GestionnaireImmobilier', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p1g-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P1G-${label}-${seq}-${Date.now()}`, actor: gestionnaire });
  await Promise.all([
    organizationService.grantMembership({ userId: gestionnaire._id, orgUnitId: tenant.rootOrgUnit, actor: gestionnaire }),
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: gestionnaire }),
  ]);
  const property = await Property.create({
    title: `Villa P1G ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
  });
  return { gestionnaire, owner, tenant, property };
}

describe('SECURITY-CLOSURE-P1-WAVE-1 (P1-G) — POST /:id/transition', () => {
  test('1. Un GestionnaireImmobilier (STAFF_IMMO) du tenant A ne peut PAS transitionner un bien du tenant B', async () => {
    const a = await buildTenantFixture('A');
    const b = await buildTenantFixture('B');
    const res = await request(app).post(`/api/property-asset/${b.property._id}/transition`).set(bearer(a.gestionnaire, a.tenant._id)).send({ target: 'travaux' });
    expect(res.status).not.toBe(200);
    const fresh = await Property.findById(b.property._id);
    expect(fresh.assetCycle).not.toBe('travaux');
  });

  test('2. Le GestionnaireImmobilier PEUT transitionner un bien de son propre tenant (comportement historique préservé)', async () => {
    const a = await buildTenantFixture('C');
    const res = await request(app).post(`/api/property-asset/${a.property._id}/transition`).set(bearer(a.gestionnaire, a.tenant._id)).send({ target: 'travaux' });
    expect(res.status).toBe(200);
  });

  test('3. Le propriétaire du bien reste autorisé (bypass ownership préservé, indépendant du tenant)', async () => {
    const a = await buildTenantFixture('D');
    const res = await request(app).post(`/api/property-asset/${a.property._id}/transition`).set(bearer(a.owner)).send({ target: 'travaux' });
    // La route (`requireCapability('properties.update')`) reste réservée à STAFF_IMMO :
    // un Proprietaire n'atteint jamais ce contrôleur, refusé au niveau RBAC de la route,
    // inchangé par ce correctif (uniquement une frontière tenant supplémentaire pour le staff).
    expect(res.status).toBe(403);
  });
});
