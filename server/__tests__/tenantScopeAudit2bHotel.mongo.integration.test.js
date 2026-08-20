// TENANT-SCOPE-AUDIT-2B (preuve initiale) → TENANT-SCOPE-HOTFIX-3 (correction).
// Ce fichier prouvait à l'origine (AUDIT-2B) que `GET /api/hotels/mine`
// échouait en 403 pour un exploitant public-signup légitime sans
// OrgMembership — bloqué par `requireTenantScope`, monté globalement sur
// `routes/hotelRoutes.js`, AVANT même d'atteindre `hotelAccessScopeService.js`
// (dont la logique de contournement ownership était donc du code mort).
//
// TENANT-SCOPE-HOTFIX-3 a remplacé `requireTenantScope` par le nouveau
// middleware `attachTenantScopeIfResolvable` (middleware/tenantContext.js) :
// même résolution/enrichissement de `req.user` quand un tenant EXISTE
// (aucun changement pour le staff), mais ne bloque plus quand aucun tenant
// ne se résout — laisse `hotelAccessScopeService.js` (non modifié)
// appliquer la vraie vérification d'ownership.
//
// Ce test devient donc VERT grâce à une correction réelle du ROUTAGE,
// jamais en affaiblissant l'assertion ni en modifiant
// `hotelAccessScopeService.js`.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Hotel = require('../models/Hotel');

const hotelRoutes = require('../routes/hotelRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/hotels', hotelRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createUnaffiliatedExploitant(overrides = {}) {
  seq += 1;
  return User.create({
    name: 'Exploitant Public Signup', email: `exploitant-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
    ...overrides,
  });
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-HOTFIX-3 — Phase A (Hotel) — correction confirmée', () => {
  test('un exploitant public-signup (Hotel.manager légitime, sans OrgMembership) accède désormais à GET /api/hotels/mine', async () => {
    await createTenantFixture({ label: 'Hotfix3Hotel Solo' });
    const exploitant = await createUnaffiliatedExploitant();
    const hotel = await Hotel.create({ name: 'Hotel Self-Service', manager: exploitant._id, createdBy: exploitant._id, publicationStatus: 'publie' });

    const res = await request(app).get('/api/hotels/mine').set(bearer(exploitant));

    expect(res.status).toBe(200);
    const ids = res.body.data.hotels.map((h) => String(h._id));
    expect(ids).toContain(String(hotel._id));
  });

  test('cross-owner : l’exploitant A n’obtient JAMAIS l’hôtel d’un exploitant B via /mine (filtre owner intact)', async () => {
    const exploitantA = await createUnaffiliatedExploitant();
    const exploitantB = await createUnaffiliatedExploitant();
    const hotelB = await Hotel.create({ name: 'Hotel B', manager: exploitantB._id, createdBy: exploitantB._id, publicationStatus: 'publie' });

    const res = await request(app).get('/api/hotels/mine').set(bearer(exploitantA));
    expect(res.status).toBe(200);
    const ids = res.body.data.hotels.map((h) => String(h._id));
    expect(ids).not.toContain(String(hotelB._id));
  });

  test('cross-owner explicite : l’exploitant A ne peut pas gérer (submit) l’hôtel d’un exploitant B en devinant son ID', async () => {
    const exploitantA = await createUnaffiliatedExploitant();
    const exploitantB = await createUnaffiliatedExploitant();
    const hotelB = await Hotel.create({ name: 'Hotel B Submit', manager: exploitantB._id, createdBy: exploitantB._id, publicationStatus: 'brouillon' });

    const res = await request(app).post(`/api/hotels/${hotelB._id}/submit`).set(bearer(exploitantA));
    expect(res.status).toBe(403);
  });

  test('staff (tenant unique) continue de fonctionner sans changement : Admin consulte son hôtel via GET /:id', async () => {
    const fixture = await createTenantFixture({ label: 'Hotfix3Hotel Staff' });
    const manager = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const hotel = await Hotel.create({ name: 'Hotel Staff GetOne', manager: manager._id, createdBy: manager._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/hotels/${hotel._id}`).set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    expect(String(res.body.data.hotel._id)).toBe(String(hotel._id));
  });

  test('cross-tenant reste refusé : staff non-Admin (Tenant A) ne peut pas accéder à un hôtel du Tenant B via /admin/list (scope déjà appliqué pour les rôles non-Admin)', async () => {
    const fixtureA = await createTenantFixture({ label: 'Hotfix3Hotel CrossA' });
    const staffA = (await createTenantUser({ tenant: fixtureA.tenant, bootstrap: fixtureA.bootstrap, overrides: { role: 'GestionnaireImmobilier' } })).user;
    const fixtureB = await createTenantFixture({ label: 'Hotfix3Hotel CrossB' });
    const managerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const hotelB = await Hotel.create({ name: 'Hotel Tenant B', manager: managerB._id, createdBy: managerB._id, publicationStatus: 'publie' });

    const res = await request(app).get(`/api/hotels/admin/list`).set(bearer(staffA));
    expect(res.status).toBe(200);
    const ids = (res.body.data?.hotels || []).map((h) => String(h._id));
    expect(ids).not.toContain(String(hotelB._id));
  });

  test('staff-only reste refusé pour un Proprietaire : /admin (création staff) toujours 403', async () => {
    const exploitant = await createUnaffiliatedExploitant();
    const res = await request(app).post('/api/hotels/admin').set(bearer(exploitant)).send({});
    expect(res.status).toBe(403);
  });
});
