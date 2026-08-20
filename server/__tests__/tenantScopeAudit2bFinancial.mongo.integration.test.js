// TENANT-SCOPE-AUDIT-2B (preuve initiale) → TENANT-SCOPE-HOTFIX-3 (correction).
// Ce fichier prouvait à l'origine (AUDIT-2B) que `GET /api/financial/hotel/:hotelId/documents`
// échouait en 403 pour un exploitant public-signup légitime sans
// OrgMembership — bloqué par `requireTenantScope`, monté globalement sur
// `routes/financialRoutes.js`, AVANT même d'atteindre
// `financialAuthorizationService.assertFinancialScope` (dont la logique de
// contournement ownership était donc du code mort).
//
// TENANT-SCOPE-HOTFIX-3 a remplacé `requireTenantScope` par
// `attachTenantScopeIfResolvable` (middleware/tenantContext.js) : même
// résolution/enrichissement de `req.user` quand un tenant EXISTE (aucun
// changement pour le staff finance), mais ne bloque plus quand aucun tenant
// ne se résout — laisse `financialAuthorizationService.js` (non modifié)
// appliquer la vraie vérification d'ownership/capacité.
//
// Ce test devient donc VERT grâce à une correction réelle du ROUTAGE,
// jamais en affaiblissant l'assertion ni en modifiant
// `financialAuthorizationService.js` ni la matrice de capacités.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Hotel = require('../models/Hotel');

const financialRoutes = require('../routes/financialRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/financial', financialRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createUnaffiliatedExploitant(overrides = {}) {
  seq += 1;
  return User.create({
    name: 'Exploitant Financial Public Signup', email: `exploitant-fin-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
    ...overrides,
  });
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-HOTFIX-3 — Phase B (Financial) — correction confirmée', () => {
  test('un exploitant public-signup (Hotel.manager légitime, sans OrgMembership) accède désormais à GET /api/financial/hotel/:hotelId/documents', async () => {
    await createTenantFixture({ label: 'Hotfix3Financial Solo' });
    const owner = await createUnaffiliatedExploitant();
    const hotel = await Hotel.create({ name: 'Hotel Financial Self-Service', manager: owner._id, createdBy: owner._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/financial/hotel/${hotel._id}/documents`).set(bearer(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('documents');
  });

  test('cross-owner refusé : owner A ne peut pas lire les documents financiers de l’hôtel d’un owner B', async () => {
    const ownerA = await createUnaffiliatedExploitant();
    const ownerB = await createUnaffiliatedExploitant();
    const hotelB = await Hotel.create({ name: 'Hotel Financial B', manager: ownerB._id, createdBy: ownerB._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/financial/hotel/${hotelB._id}/documents`).set(bearer(ownerA));
    expect(res.status).toBe(403);
  });

  test('owner reste read-only : impossible de créer un paiement manuel (capacité réservée au staff)', async () => {
    const owner = await createUnaffiliatedExploitant();
    const hotel = await Hotel.create({ name: 'Hotel Financial Owner RO', manager: owner._id, createdBy: owner._id, publicationStatus: 'publie' });

    const res = await request(app)
      .post('/api/financial/payments/manual')
      .set(bearer(owner))
      .send({ establishmentId: hotel._id, amountMinor: 10000, currency: 'XAF', method: 'especes' });
    expect(res.status).toBe(403);
  });

  test('owner reste read-only : confirmer un paiement inexistant/inaccessible échoue toujours (jamais 200)', async () => {
    const owner = await createUnaffiliatedExploitant();
    const res = await request(app)
      .post('/api/financial/payments/000000000000000000000000/confirm')
      .set(bearer(owner))
      .send({});
    // Le contrôleur vérifie l'existence du paiement AVANT la capacité
    // (404 pour un ID inexistant) — le point important est qu'aucun owner
    // n'obtienne jamais 200 sur cette action réservée au staff.
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(200);
  });

  test('forgery : owner authentifié ne peut pas obtenir un accès en fournissant un ownerId/hotelId arbitraire dans le body', async () => {
    const owner = await createUnaffiliatedExploitant();
    const otherOwner = await createUnaffiliatedExploitant();
    const otherHotel = await Hotel.create({ name: 'Hotel Forged Target', manager: otherOwner._id, createdBy: otherOwner._id, publicationStatus: 'publie' });

    const res = await request(app)
      .get(`/api/financial/hotel/${otherHotel._id}/documents`)
      .set(bearer(owner))
      .query({ ownerId: String(owner._id) }); // tentative de forger l'autorisation via un paramètre non lu par le contrôleur
    expect(res.status).toBe(403);
  });

  test('staff finance (tenant unique) continue de fonctionner sans changement', async () => {
    const fixture = await createTenantFixture({ label: 'Hotfix3Financial Staff' });
    const manager = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const hotel = await Hotel.create({ name: 'Hotel Financial Staff', manager: manager._id, createdBy: manager._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/financial/hotel/${hotel._id}/documents`).set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
  });

  test('cross-tenant reste refusé : Staff A (Tenant A) ne peut pas lire les documents financiers d’un hôtel du Tenant B', async () => {
    const fixtureA = await createTenantFixture({ label: 'Hotfix3Financial CrossA' });
    const fixtureB = await createTenantFixture({ label: 'Hotfix3Financial CrossB' });
    const managerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const hotelB = await Hotel.create({ name: 'Hotel Financial Tenant B', manager: managerB._id, createdBy: managerB._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/financial/hotel/${hotelB._id}/documents`).set(bearer(fixtureA.bootstrap));
    // `assertFinancialScope` renvoie 404 ("Etablissement inaccessible.") pour
    // une ressource résolue vers un AUTRE tenant — jamais 200.
    expect(res.status).toBe(404);
  });

  test('Client ne gagne aucune capacité financière (rôle absent de FINANCIAL_CAPABILITIES)', async () => {
    const fixture = await createTenantFixture({ label: 'Hotfix3Financial Client' });
    const client = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Client' } })).user;
    const manager = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const hotel = await Hotel.create({ name: 'Hotel Financial Client Test', manager: manager._id, createdBy: manager._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/financial/hotel/${hotel._id}/documents`).set(bearer(client));
    expect(res.status).toBe(403);
  });
});
