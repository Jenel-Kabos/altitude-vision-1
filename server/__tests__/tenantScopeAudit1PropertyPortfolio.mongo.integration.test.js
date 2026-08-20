// TENANT-SCOPE-AUDIT-1 — propertyPortfolioController.list
// Acteur : staff (STAFF_IMMO) de son propre tenant, jamais un autre tenant.
// Ressource : Property publiée (vente/location, Validée, isPublished).
// Champ comparé : `Property.owner` contre `req.tenantScopeUserIds` (brut,
// OrgMembership-only). Un Proprietaire créé par inscription publique, sans
// OrgMembership, propriétaire d'un bien publié sur un tenant UNIQUE, restait
// invisible du portefeuille backoffice de son propre staff — même défaut
// structurel que HOTFIX-USERS-COUNT-1, appliqué ici à `Property.owner` au
// lieu de `User._id`. Correctif local dans `propertyPortfolioController.js`
// uniquement — jamais dans `resolveTenantScope` ni dans le catalogue PUBLIC
// (publicPropertyService.js), qui doit rester strictement inchangé (cause
// du revert de HOTFIX-USERS-COUNT-1).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');

const propertyRoutes = require('../routes/propertyRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

let seq = 0;
async function createPublishedPropertyForUnaffiliatedOwner(overrides = {}) {
  seq += 1;
  const owner = await User.create({
    name: 'Unaffiliated Portfolio Owner', email: `portfolio-owner-${Date.now()}-${seq}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });
  const property = await Property.create({
    title: `Villa Portfolio ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', statusAdmin: 'Validée', isPublished: true,
    price: 300000, address: { street: 'Rue Test', city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
    surface: 90, availability: 'Disponible', owner: owner._id,
    ...overrides,
  });
  return { owner, property };
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('TENANT-SCOPE-AUDIT-1 — Property Portfolio : propriétaire public-signup, tenant unique', () => {
  let fixture; let property;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'ScopeAuditPortfolio Solo' });
    ({ property } = await createPublishedPropertyForUnaffiliatedOwner());
  });

  test('GET /api/properties/portfolio (staff, tenant unique) inclut le bien d’un propriétaire non affilié', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((i) => String(i._id));
    expect(ids).toContain(String(property._id));
  });
});

describe('TENANT-SCOPE-AUDIT-1 — Property Portfolio : cross-tenant préservé', () => {
  let fixtureA; let fixtureB; let propertyA; let adminB;

  beforeAll(async () => {
    fixtureA = await createTenantFixture({ label: 'ScopeAuditPortfolio CrossA' });
    ({ property: propertyA } = await createPublishedPropertyForUnaffiliatedOwner());
    fixtureB = await createTenantFixture({ label: 'ScopeAuditPortfolio CrossB' });
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  });

  test('dès qu’un second tenant existe, le bien non affilié au Tenant A n’est plus automatiquement inclus (repli sûr, pas une fuite)', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(fixtureA.bootstrap));
    const ids = res.body.data.items.map((i) => String(i._id));
    expect(ids).not.toContain(String(propertyA._id));
  });

  test('AdminB (tenant distinct) ne voit jamais le portefeuille du Tenant A', async () => {
    const res = await request(app).get('/api/properties/portfolio').set(bearer(adminB));
    const ids = res.body.data.items.map((i) => String(i._id));
    expect(ids).not.toContain(String(propertyA._id));
  });
});

describe('TENANT-SCOPE-AUDIT-1 — Property Portfolio : non-régression staff avec OrgMembership normal', () => {
  test('un bien dont le propriétaire a un OrgMembership réel continue de fonctionner sans changement', async () => {
    const fixture = await createTenantFixture({ label: 'ScopeAuditPortfolio IAM' });
    const owner = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Proprietaire' } })).user;
    seq += 1;
    const property = await Property.create({
      title: `Villa Affiliée ${seq}`, description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', statusAdmin: 'Validée', isPublished: true,
      price: 300000, address: { street: 'Rue Test', city: 'Brazzaville', arrondissement: 'Centre' },
      latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png?text=Test'],
      surface: 90, availability: 'Disponible', owner: owner._id,
    });
    const res = await request(app).get('/api/properties/portfolio').set(bearer(fixture.bootstrap));
    const ids = res.body.data.items.map((i) => String(i._id));
    expect(ids).toContain(String(property._id));
  });
});
