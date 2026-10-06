// PLATFORM-ADMIN-04B1 — Dashboard Home : transitions PLATFORM ↔ TENANT.
// Reproduit l'observation manuelle « PLATFORM → Tenant (sans adhésion de
// l'opérateur) → /dashboard = Erreur de chargement » avec des fixtures
// génériques (aucun nom de tenant réel) et fixe le contrat :
//   PLATFORM   → /api/admin/stats (global, tenant:null inclus)
//   TENANT X   → /api/dashboard/stats strictement borné à X (vide ⇒ zéros)
//   UNRESOLVED → aucune donnée.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_VIEW_REQUIRED_CAPABILITIES } = require('../constants/platformOperatorConstants');
const User = require('../models/User');
const Property = require('../models/Property');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(240000);

const app = express();
app.use(express.json());
app.use('/api/dashboard', require('../routes/dashboardRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));
app.use(errorHandler);

const bearer = (user, tenant) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
const makeUser = (role, label) => {
  seq += 1;
  return User.create({ name: `PA04B1 ${label} ${seq}`, email: `pa04b1-${label}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
};
const makeProperty = (owner, tenant, title) => Property.create({
  tenant: tenant?._id || null, title, description: 'Description suffisamment longue pour la validation Property.',
  pole: 'Altimmo', type: 'Villa', status: 'vente', price: 100000,
  address: { arrondissement: 'Centre', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.28,
  images: ['https://example.test/pa04b1.jpg'], surface: 80, statusAdmin: 'Validée', isPublished: true,
  availability: 'Disponible', owner: owner._id,
});

const S = {};
beforeAll(async () => {
  await startFinancialMongo();
  const fixtureA = await createTenantFixture({ label: 'PA04B1 Tenant A', withAdminMembership: true });
  const fixtureB = await createTenantFixture({ label: 'PA04B1 Tenant B', withAdminMembership: true });
  const fixtureC = await createTenantFixture({ label: 'PA04B1 Tenant C vide', withAdminMembership: true });
  S.tenantA = fixtureA.tenant; S.tenantB = fixtureB.tenant; S.tenantC = fixtureC.tenant;
  S.adminA = fixtureA.bootstrap; S.adminB = fixtureB.bootstrap; S.adminC = fixtureC.bootstrap;

  // Administrateur plateforme réel : éligible ET membre Admin du seul Tenant A.
  S.platformAdmin = await makeUser('Admin', 'platform-admin');
  await grantOperator({ userId: S.platformAdmin._id, actor: S.adminA, reason: 'PA04B1 full operator', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  await addTenantMember({ tenant: S.tenantA, user: S.platformAdmin, bootstrap: S.adminA, businessRole: 'Admin' });
  // Opérateur éligible sans aucune adhésion tenant.
  S.platformAdminNoMembership = await makeUser('Admin', 'platform-admin-no-membership');
  await grantOperator({ userId: S.platformAdminNoMembership._id, actor: S.adminA, reason: 'PA04B1 full operator no membership', capabilities: [...PLATFORM_VIEW_REQUIRED_CAPABILITIES] });
  // Opérateurs partiels : avec et sans la capability de lecture du pilotage.
  S.partialReporting = await makeUser('Admin', 'partial-reporting');
  await grantOperator({ userId: S.partialReporting._id, actor: S.adminA, reason: 'PA04B1 partial reporting', capabilities: ['platform.reporting.read'] });
  S.partialSupport = await makeUser('Admin', 'partial-support');
  await grantOperator({ userId: S.partialSupport._id, actor: S.adminA, reason: 'PA04B1 partial support', capabilities: ['platform.support.read'] });

  await makeProperty(S.adminA, S.tenantA, 'PA04B1 bien A');
  await makeProperty(S.adminA, S.tenantA, 'PA04B1 bien A2');
  await makeProperty(S.adminB, S.tenantB, 'PA04B1 bien B');
  S.independentOwner = await makeUser('Proprietaire', 'independent-owner');
  await makeProperty(S.independentOwner, null, 'PA04B1 bien sans organisation');
});
afterAll(stopFinancialMongo);

const tenantStats = (res) => res.body?.data?.stats;

describe('PA-04B1 — PLATFORM', () => {
  test('opérateur éligible sans tenant : stats globales (A + B + tenant:null)', async () => {
    const res = await request(app).get('/api/admin/stats').set(bearer(S.platformAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.totalProperties).toBeGreaterThanOrEqual(4);
  });
});

describe('PA-04B1 — TENANT (opérateur éligible avec tenant sélectionné)', () => {
  test('Tenant A (adhésion Admin) : stats du seul Tenant A', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdmin, S.tenantA));
    expect(res.status).toBe(200);
    expect(tenantStats(res).Altimmo).toBe(2);
  });

  test('Tenant B (aucune adhésion) : stats du seul Tenant B, jamais une erreur', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdmin, S.tenantB));
    expect(res.status).toBe(200);
    expect(tenantStats(res).Altimmo).toBe(1);
  });

  test('opérateur éligible sans aucune adhésion : Tenant A puis Tenant B, chacun borné', async () => {
    const a = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdminNoMembership, S.tenantA));
    const b = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdminNoMembership, S.tenantB));
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(tenantStats(a).Altimmo).toBe(2);
    expect(tenantStats(b).Altimmo).toBe(1);
  });

  test('contrôle : Tenant C vide avec un vrai membre Admin → zéros (l’absence de données n’est pas la cause)', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.adminC, S.tenantC));
    expect(res.status).toBe(200);
    expect(tenantStats(res).Altimmo).toBe(0);
  });

  test('Tenant C vide : zéros déterministes, aucun fallback global', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdmin, S.tenantC));
    expect(res.status).toBe(200);
    expect(tenantStats(res).Altimmo).toBe(0);
  });
});

describe('PA-04B1 — transitions séquentielles (même opérateur)', () => {
  test('PLATFORM → A → PLATFORM → B → A : chaque contexte reçoit ses seules données', async () => {
    const sequence = [
      ['platform', null], ['tenant', S.tenantA], ['platform', null], ['tenant', S.tenantB], ['tenant', S.tenantA],
    ];
    const expected = { [String(S.tenantA._id)]: 2, [String(S.tenantB._id)]: 1 };
    for (const [mode, tenant] of sequence) {
      if (mode === 'platform') {
        const res = await request(app).get('/api/admin/stats').set(bearer(S.platformAdmin));
        expect(res.status).toBe(200);
      } else {
        const res = await request(app).get('/api/dashboard/stats').set(bearer(S.platformAdmin, tenant));
        expect(res.status).toBe(200);
        expect(tenantStats(res).Altimmo).toBe(expected[String(tenant._id)]);
      }
    }
  });
});

describe('PA-04B1 — membres tenant (inchangé)', () => {
  test('Admin du Tenant A : stats A ; Admin du Tenant B refusé sur A', async () => {
    const own = await request(app).get('/api/dashboard/stats').set(bearer(S.adminA, S.tenantA));
    const foreign = await request(app).get('/api/dashboard/stats').set(bearer(S.adminB, S.tenantA));
    expect(own.status).toBe(200);
    expect(tenantStats(own).Altimmo).toBe(2);
    expect(foreign.status).toBe(403);
  });
});

describe('PA-04B1 — opérateurs partiels et UNRESOLVED', () => {
  test('opérateur partiel avec platform.reporting.read + Tenant B : lecture tenant bornée à B', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.partialReporting, S.tenantB));
    expect(res.status).toBe(200);
    expect(tenantStats(res).Altimmo).toBe(1);
  });

  test('opérateur partiel sans capability de pilotage + Tenant B : refusé', async () => {
    const res = await request(app).get('/api/dashboard/stats').set(bearer(S.partialSupport, S.tenantB));
    expect(res.status).toBe(403);
  });

  test('UNRESOLVED (opérateur partiel sans tenant) : aucune donnée, ni tenant ni globale', async () => {
    const tenant = await request(app).get('/api/dashboard/stats').set(bearer(S.partialReporting));
    const platform = await request(app).get('/api/admin/stats').set(bearer(S.partialReporting));
    expect(tenant.status).toBe(403);
    expect(platform.status).toBe(403);
    expect(tenant.body.data).toBeUndefined();
    expect(platform.body.data).toBeUndefined();
  });

  test('Admin historique sans opérateur ni adhésion : refusé', async () => {
    const legacy = await makeUser('Admin', 'legacy-admin');
    expect((await request(app).get('/api/dashboard/stats').set(bearer(legacy, S.tenantB))).status).toBe(403);
  });
});
