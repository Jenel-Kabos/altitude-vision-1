// HOTFIX-USERS-COUNT-1 — reproduit et verrouille la cause racine réelle :
// un compte inscrit via le flux public (Client/Proprietaire/User) n'obtient
// JAMAIS d'`OrgMembership` (seul le flux d'invitation organisationnelle en
// crée). Sur le tenant unique réel ("Altitude Vision", résolu par
// `legacy_fallback`), cela rendait ces comptes invisibles à `GET /api/users`
// bien qu'authentifiables et pleinement fonctionnels ailleurs (`/mes-biens`).
// Le correctif (`userController.expandScopeWithUnaffiliatedUsersIfSoleTenant`)
// est vérifié ici avec la même rigueur que la certification cross-tenant
// existante : jamais de fuite dès qu'un second tenant existe. Appliqué
// LOCALEMENT à getAllUsers/getAllOwners (jamais à `resolveTenantScope`, la
// couche partagée par le catalogue public de biens/hôtels et le reporting)
// après qu'une première tentative à ce niveau partagé ait fait fuiter des
// propriétaires non affiliés dans le catalogue public tenant-scopé
// (régressions constatées sur tenantCore.mongo.integration.test.js, revert
// immédiat).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');

const userRoutes = require('../routes/userRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use(errorHandler);

const bearer = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
});

async function createUnaffiliatedUser(overrides = {}) {
  return User.create({
    name: 'Huinlogistics-like',
    email: `unaffiliated-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Proprietaire', isEmailVerified: true,
    ...overrides,
  });
}

beforeAll(async () => { await startFinancialMongo(); });
afterAll(async () => stopFinancialMongo());

describe('HOTFIX-USERS-COUNT-1 — scénario réel : tenant unique, Admin legacy + Proprietaire public signup', () => {
  let fixture; let proprietaire;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'HotfixUsersCount1 Solo' });
    // `fixture.bootstrap` n'a AUCUN OrgMembership — exactement le compte
    // "Altitude Vision" réel, résolu par legacy_fallback (voir
    // tenantContextService.resolveLegacyTenantForUser).
    proprietaire = await createUnaffiliatedUser();
  });

  test('reproduction AVANT correctif (documentée) : le Proprietaire n’a strictement aucun OrgMembership', async () => {
    const OrgMembership = require('../models/OrgMembership');
    const count = await OrgMembership.countDocuments({ user: proprietaire._id });
    expect(count).toBe(0);
  });

  test('GET /api/users (Admin legacy_fallback) inclut désormais le Proprietaire non affilié — plus TOTAL:1', async () => {
    const res = await request(app).get('/api/users').set(bearer(fixture.bootstrap));
    expect(res.status).toBe(200);
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).toContain(String(fixture.bootstrap._id));
    expect(ids).toContain(String(proprietaire._id));
    expect(res.body.results).toBeGreaterThanOrEqual(2);
  });

  test('le Proprietaire apparaît avec son vrai rôle (le filtre "Propriétaires" du frontend est un simple User.role)', async () => {
    const res = await request(app).get('/api/users').set(bearer(fixture.bootstrap));
    const found = res.body.data.users.find((u) => String(u._id) === String(proprietaire._id));
    expect(found.role).toBe('Proprietaire');
  });
});

describe('HOTFIX-USERS-COUNT-1 — sécurité cross-tenant préservée (aucune fuite dès qu’un second tenant existe)', () => {
  let fixtureA; let fixtureB; let unaffiliatedA; let adminB;

  beforeAll(async () => {
    fixtureA = await createTenantFixture({ label: 'HotfixUsersCount1 CrossA' });
    unaffiliatedA = await createUnaffiliatedUser({ name: 'Unaffiliated A' });
    fixtureB = await createTenantFixture({ label: 'HotfixUsersCount1 CrossB' });
    adminB = (await createTenantUser({ tenant: fixtureB.tenant, bootstrap: fixtureB.bootstrap, overrides: { role: 'Admin' } })).user;
  });

  test('dès qu’un second tenant existe, l’extension "tenant unique" se désactive — AdminA ne voit plus que les comptes explicitement rattachés (repli sûr, pas une fuite)', async () => {
    const res = await request(app).get('/api/users').set(bearer(fixtureA.bootstrap));
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).toContain(String(fixtureA.bootstrap._id)); // toujours lui-même (legacy_fallback push explicite)
    expect(ids).not.toContain(String(unaffiliatedA._id)); // non deviné en contexte ambigu — limite documentée, pas une régression
  });

  test('AdminB (tenant distinct, avec staff explicitement rattaché) ne voit JAMAIS les comptes de Tenant A', async () => {
    const res = await request(app).get('/api/users').set(bearer(adminB));
    const ids = res.body.data.users.map((u) => String(u._id));
    expect(ids).not.toContain(String(fixtureA.bootstrap._id));
    expect(ids).not.toContain(String(unaffiliatedA._id));
  });
});

describe('HOTFIX-USERS-COUNT-1 — IAM : rôles non-Admin toujours refusés (non-régression)', () => {
  let fixture; let collaborateur; let proprietaireActor;

  beforeAll(async () => {
    fixture = await createTenantFixture({ label: 'HotfixUsersCount1 IAM' });
    collaborateur = (await createTenantUser({ tenant: fixture.tenant, bootstrap: fixture.bootstrap, overrides: { role: 'Collaborateur' } })).user;
    proprietaireActor = await createUnaffiliatedUser({ name: 'IAM Proprietaire' });
  });

  test.each([
    ['Collaborateur', () => collaborateur],
    ['Proprietaire (non affilié)', () => proprietaireActor],
  ])('%s reçoit 403 sur GET /api/users', async (_label, getUser) => {
    const res = await request(app).get('/api/users').set(bearer(getUser()));
    expect(res.status).toBe(403);
  });
});
