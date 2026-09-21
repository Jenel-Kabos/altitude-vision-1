// TENANT-SCOPE-AUDIT-2A — 3 consommateurs STRICT de
// `tenantResourceAttributionService` corrigés (Option D : réutilisation de
// `assertResourceTenantOrUnattributed`, déjà certifiée ailleurs — jamais une
// modification de `fromUser` lui-même). Voir TENANT_SCOPE_AUDIT2A_REPORT.md
// pour la caractérisation complète des 28 consommateurs inventoriés.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');

const userRoutes = require('../routes/userRoutes');
const propertyRoutes = require('../routes/propertyRoutes');
const rentalMaintenanceRoutes = require('../routes/rentalMaintenanceRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rental-maintenance', rentalMaintenanceRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createUnaffiliatedOwner(overrides = {}) {
  seq += 1;
  return User.create({
    name: 'Unaffiliated Owner 2A', email: `owner2a-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
    ...overrides,
  });
}
async function createPropertyFor(owner, overrides = {}) {
  seq += 1;
  return Property.create({
    title: `Villa 2A ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', statusAdmin: 'En attente', isPublished: false,
    price: 250000, address: { street: 'Rue 2A', city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, availability: 'Disponible', owner: owner._id,
    ...overrides,
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TEST-CONVERGENCE.1 —
    // callers now pass the owning tenant explicitly (Lot G tightened the
    // moderation contract to TENANT-strict: Property.tenant must match the
    // moderator's tenant). Absence is a legitimate scenario (unaffiliated
    // Proprietaire = Property.tenant=null) and gets refused by moderation
    // canonically; every test spelling out its tenant intent avoids the
    // silent null we used to rely on before the Lot G tightening.
    // Normalise the tenant reference (accept ObjectId or a populated doc).
    tenant: overrides.tenant?._id || overrides.tenant || null,
  });
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-AUDIT-2A — userController.downloadContractDocument : correction confirmée', () => {
  test('Admin (tenant unique) reçoit désormais autre chose qu’un échec masqué pour un Proprietaire non affilié — la vérification tenant ne bloque plus', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aUser Solo' });
    const owner = await createUnaffiliatedOwner();
    const res = await request(app).get(`/api/users/${owner._id}/contract-document`).set(bearer(fixture.bootstrap));
    // Avant correctif : 502 générique (l'erreur 404 de assertResourceTenant
    // était avalée par le catch du contrôleur). Après correctif : la
    // vérification tenant passe, et le seul obstacle restant est l'absence
    // de PDF stocké (409 LEGACY_ASSET_MIGRATION_REQUIRED) — jamais 502.
    expect(res.status).not.toBe(502);
    expect(res.body.code).toBe('LEGACY_ASSET_MIGRATION_REQUIRED');
  });

  test('cross-tenant reste refusé : Admin A ne peut pas télécharger le contrat d’un compte affilié au Tenant B', async () => {
    const fixtureA = await createTenantFixture({ label: 'ScopeAudit2aUser CrossA' });
    const fixtureB = await createTenantFixture({ label: 'ScopeAudit2aUser CrossB' });
    const ownerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const res = await request(app).get(`/api/users/${ownerB._id}/contract-document`).set(bearer(fixtureA.bootstrap));
    // Bloqué en amont par router.param('id', …) (scope étendu local au
    // tenant A uniquement) avant même d'atteindre assertResourceTenant.
    expect(res.status).toBe(404);
  });
});

describe('TENANT-SCOPE-AUDIT-2A — propertyController moderation (TENANT-strict, Lot G contract)', () => {
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TEST-CONVERGENCE.1 — the
  // "correction 2A" (allow tenant Admin to moderate `Property.tenant=null`)
  // was intentionally reversed by Lot G, which made property moderation
  // TENANT-strict: `Property.tenant === req.platformTenant._id` is now
  // required (see server/controllers/propertyController.js:1037-1046).
  // Unaffiliated properties are therefore no longer moderable via this
  // tenant route — they belong to a distinct platform-moderation surface,
  // not silently absorbed by the first tenant to claim them.
  test('bien non affilié (Property.tenant=null) — moderation TENANT refuse 403 (contrat Lot G)', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aProperty Solo', withAdminMembership: true });
    const owner = await createUnaffiliatedOwner();
    const property = await createPropertyFor(owner);

    const res = await request(app)
      .patch(`/api/properties/admin/${property._id}/validate`)
      .set(bearer(fixture.bootstrap));

    expect(res.status).toBe(403);
    const unchanged = await Property.findById(property._id);
    expect(unchanged.statusAdmin).toBe('En attente');
    expect(unchanged.isPublished).toBe(false);
  });

  test('cross-tenant reste refusé : AdminA ne peut pas modérer un bien affilié au Tenant B', async () => {
    const fixtureA = await createTenantFixture({ label: 'ScopeAudit2aProperty CrossA', withAdminMembership: true });
    const fixtureB = await createTenantFixture({ label: 'ScopeAudit2aProperty CrossB', withAdminMembership: true });
    const ownerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const propertyB = await createPropertyFor(ownerB, { tenant: fixtureB.tenant._id });

    const res = await request(app)
      .patch(`/api/properties/admin/${propertyB._id}/validate`)
      .set(bearer(fixtureA.bootstrap));

    // Lot G contract: la file de modération est TENANT-strict — la ressource
    // d'un autre tenant est refusée en 403, jamais moderée. La forme du
    // refus (403 vs 404) importe moins que l'invariant : mutation cross-
    // tenant impossible.
    expect([403, 404]).toContain(res.status);
    const updated = await Property.findById(propertyB._id);
    expect(updated.statusAdmin).not.toBe('Validée');
  });

  test('non-régression : un bien d’un Proprietaire affilié (Property.tenant renseigné) continue de fonctionner', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aProperty IAM', withAdminMembership: true });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const property = await createPropertyFor(owner, { tenant: fixture.tenant._id });

    const res = await request(app)
      .patch(`/api/properties/admin/${property._id}/validate`)
      .set(bearer(fixture.bootstrap));

    expect(res.status).toBe(200);
  });
});

describe('TENANT-SCOPE-AUDIT-2A — rentalMaintenanceController (assertPropertyAccess) : correction confirmée', () => {
  test('staff GL (tenant unique) peut désormais créer un ticket de maintenance pour un bien d’un Proprietaire non affilié', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aMaint Solo' });
    const owner = await createUnaffiliatedOwner();
    const property = await createPropertyFor(owner);

    const res = await request(app)
      .post('/api/rental-maintenance')
      .set(bearer(fixture.bootstrap))
      .send({ propertyId: String(property._id), category: 'plomberie', description: 'Fuite sous évier cuisine' });

    expect(res.status).toBe(201);
    expect(res.body.data.ticket.category).toBe('plomberie');
  });

  test('cross-tenant reste refusé : staff GL du Tenant A ne peut pas créer de ticket sur un bien du Tenant B', async () => {
    const fixtureA = await createTenantFixture({ label: 'ScopeAudit2aMaint CrossA' });
    const fixtureB = await createTenantFixture({ label: 'ScopeAudit2aMaint CrossB' });
    const ownerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const propertyB = await createPropertyFor(ownerB);

    const res = await request(app)
      .post('/api/rental-maintenance')
      .set(bearer(fixtureA.bootstrap))
      .send({ propertyId: String(propertyB._id), category: 'plomberie', description: 'Tentative illégitime cross-tenant' });

    expect(res.status).toBe(403);
  });

  test('non-régression : un bien d’un Proprietaire affilié (OrgMembership réel) continue de fonctionner', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aMaint IAM' });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const property = await createPropertyFor(owner);

    const res = await request(app)
      .post('/api/rental-maintenance')
      .set(bearer(fixture.bootstrap))
      .send({ propertyId: String(property._id), category: 'electricite', description: 'Panne électrique salon' });

    expect(res.status).toBe(201);
  });
});
