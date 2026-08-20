// TENANT-SCOPE-AUDIT-1 (preuve initiale) → TENANT-SCOPE-AUDIT-2A (correction).
// Ce fichier prouvait à l'origine (AUDIT-1) que `getDocument` échouait en
// 404 pour un document legacy lié à un Proprietaire public-signup sans
// OrgMembership — un bug CONFIRMÉ mais délibérément NON corrigé à l'époque
// (cause commune `tenantResourceAttributionService.fromUser`, service
// partagé par ~15 types de ressources, hors blast radius acceptable pour un
// sprint d'audit seul).
//
// TENANT-SCOPE-AUDIT-2A a caractérisé exhaustivement les 28 consommateurs
// de ce service (voir TENANT_SCOPE_AUDIT2A_CONSUMER_MATRIX.md) et démontré
// que 13 d'entre eux utilisaient déjà `assertResourceTenantOrUnattributed`
// (variante fail-open : une attribution `unresolved` — "aucune frontière
// tenant traçable" — est laissée passer, alors qu'une attribution
// `resolved` vers un AUTRE tenant, ou `ambiguous`, reste refusée). Seuls 5
// consommateurs (dont `documentController.js`) utilisaient encore la
// variante STRICTE (`assertResourceTenant`), qui traite `unresolved` comme
// un échec — sans justification métier démontrée. `documentController.js`
// a donc été corrigé pour réutiliser la même primitive déjà certifiée,
// SANS modifier `fromUser` lui-même (qui reste strict pour les
// consommateurs qui en dépendent réellement, ex. `hotelAccessScopeService.js`,
// hors périmètre — voir TENANT_SCOPE_AUDIT2A_REPORT.md).
//
// Ce test devient donc VERT grâce à une correction réelle
// (documentController.js), jamais en affaiblissant l'assertion.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Document = require('../models/Document');

const documentRoutes = require('../routes/documentRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/documents', documentRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-AUDIT-2A — documentController : correction confirmée (getDocument)', () => {
  test('GET /api/documents/:id (Admin, tenant unique) réussit désormais pour un document legacy lié à un Proprietaire public-signup sans OrgMembership', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAudit2aDoc Solo' });
    const owner = await User.create({
      name: 'Unaffiliated Document Owner', email: `doc-owner-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
    });
    const document = await Document.create({
      tenant: null, type: 'Facture', status: 'Brouillon', client: owner._id, createdBy: owner._id,
      description: 'Facture legacy sans attribution tenant directe',
    });

    const res = await request(app).get(`/api/documents/${document._id}`).set(bearer(fixture.bootstrap));

    expect(res.status).toBe(200);
    expect(String(res.body.data.document._id)).toBe(String(document._id));
  });

  test('cross-tenant reste refusé : un document résolu vers un AUTRE tenant reste 404 (non-régression de la frontière stricte)', async () => {
    const fixtureA = await createTenantFixture({ label: 'ScopeAudit2aDoc CrossA' });
    const fixtureB = await createTenantFixture({ label: 'ScopeAudit2aDoc CrossB' });
    const ownerB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    const documentB = await Document.create({
      tenant: null, type: 'Facture', status: 'Brouillon', client: ownerB._id, createdBy: ownerB._id,
      description: 'Facture appartenant au Tenant B (résolue via OrgMembership)',
    });

    const res = await request(app).get(`/api/documents/${documentB._id}`).set(bearer(fixtureA.bootstrap));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TENANT_RESOURCE_NOT_FOUND');
  });
});
