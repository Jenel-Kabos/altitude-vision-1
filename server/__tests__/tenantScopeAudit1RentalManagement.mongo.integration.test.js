// TENANT-SCOPE-AUDIT-1 — rentalManagementController.list / .stats
// Acteur : staff (Admin/GestionnaireImmobilier) de son propre tenant.
// Ressource : `RentalManagement.owner` (copié depuis `Property.owner` à
// l'activation, voir `ensureRentalManagementActive`), comparé au scope brut
// `req.tenantScopeUserIds` (OrgMembership-only). Même défaut structurel que
// Property Portfolio et HOTFIX-USERS-COUNT-1 : un dossier locatif activé
// pour un Proprietaire créé par inscription publique, sans OrgMembership,
// sur tenant unique, restait invisible du module Gestion Locative pour le
// staff légitime de ce même tenant — malgré le garde `router.param('id', …)`
// de ce même routeur qui documente explicitement que ce cas ne doit
// "jamais [être] bloqué par l'absence de contexte tenant" (rentalManagementRoutes.js).
// Correctif local dans `rentalManagementController.js` uniquement.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const { ensureRentalManagementActive } = require('../services/rentalManagementLeaseSyncService');

const rentalManagementRoutes = require('../routes/rentalManagementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-management', rentalManagementRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createActivatedRentalForUnaffiliatedOwner(actorId) {
  seq += 1;
  const owner = await User.create({
    name: 'Unaffiliated Rental Owner', email: `rental-owner-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });
  const property = await Property.create({
    title: `Villa GL ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', statusAdmin: 'Validée', isPublished: true,
    price: 250000, address: { street: 'Rue GL', city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, availability: 'Disponible', owner: owner._id,
  });
  const rental = await ensureRentalManagementActive({ property, actor: actorId, monthlyRent: 250000 });
  return { owner, property, rental };
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-AUDIT-1 — Gestion Locative : propriétaire public-signup, tenant unique', () => {
  let fixture; let rental;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'ScopeAuditGL Solo' });
    ({ rental } = await createActivatedRentalForUnaffiliatedOwner(fixture.bootstrap._id));
  });

  test('GET /api/rental-management (liste, staff, tenant unique) inclut le dossier d’un propriétaire non affilié', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    const ids = res.body.data.rentals.map((r) => String(r._id));
    expect(ids).toContain(String(rental._id));
  });

  test('GET /api/rental-management/stats compte ce dossier dans les totaux', async () => {
    const res = await request(app).get('/api/rental-management/stats').set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total).toBeGreaterThanOrEqual(1);
  });
});

describe('TENANT-SCOPE-AUDIT-1 — Gestion Locative : cross-tenant préservé', () => {
  let fixtureA; let fixtureB; let rentalA; let adminB;

  beforeAll(async () => {
    fixtureA = await createTenantFixture({ label: 'ScopeAuditGL CrossA' });
    ({ rental: rentalA } = await createActivatedRentalForUnaffiliatedOwner(fixtureA.bootstrap._id));
    fixtureB = await createTenantFixture({ label: 'ScopeAuditGL CrossB' });
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  });

  test('dès qu’un second tenant existe, le dossier non affilié au Tenant A n’est plus automatiquement inclus (repli sûr, pas une fuite)', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(fixtureA.bootstrap));
    const ids = res.body.data.rentals.map((r) => String(r._id));
    expect(ids).not.toContain(String(rentalA._id));
  });

  test('AdminB (tenant distinct) ne voit jamais le dossier GL du Tenant A', async () => {
    const res = await request(app).get('/api/rental-management').set(bearer(adminB));
    const ids = res.body.data.rentals.map((r) => String(r._id));
    expect(ids).not.toContain(String(rentalA._id));
  });
});

describe('TENANT-SCOPE-AUDIT-1 — Gestion Locative : non-régression staff avec OrgMembership normal', () => {
  test('un dossier dont le propriétaire a un OrgMembership réel continue de fonctionner sans changement', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAuditGL IAM' });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    seq += 1;
    const property = await Property.create({
      title: `Villa GL Affiliée ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', statusAdmin: 'Validée', isPublished: true,
      price: 250000, address: { street: 'Rue GL', city: 'Brazzaville', arrondissement: 'Centre' },
      latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
      surface: 90, availability: 'Disponible', owner: owner._id,
    });
    const rental = await ensureRentalManagementActive({ property, actor: fixture.bootstrap._id, monthlyRent: 250000 });
    const res = await request(app).get('/api/rental-management').set(bearer(fixture.bootstrap));
    const ids = res.body.data.rentals.map((r) => String(r._id));
    expect(ids).toContain(String(rental._id));
  });
});
