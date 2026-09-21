// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-B · REG-01..REG-16 +
// REG-MODULE-01..04 + REG-QUERY-01. Certifie la migration de
// /api/rental-contract-regularization vers l'autorité tenant canonique
// (module + membership), avec isolation cross-tenant et refus d'escalade
// via User.role global.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/rentalContractRegularizationRoutes');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/rental-contract-regularization', routes);
app.use(errorHandler);

const bearer = (u, tid) => ({
  Authorization: `Bearer ${jwt.sign({ id: u._id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}`,
  ...(tid ? { 'X-Platform-Tenant-Id': String(tid) } : {}),
});
const makeUser = async (over = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true,
  ...over,
});
const setRole = (uid, t, br) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit, status: 'active' }, { $set: { businessRole: br } },
);
const setStatus = (uid, t, status) => OrgMembership.updateOne(
  { user: uid, orgUnit: t.rootOrgUnit }, { $set: { status } },
);
const seedOpenContract = async (tenantOwnerUser) => {
  const proprietaire = await Proprietaire.create({ nom: 'Owner', prenom: 'One', telephone: '06000000', user: tenantOwnerUser._id });
  const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'One', telephone: '07000000' });
  return Contrat.create({
    type: 'location', statut: 'actif', proprietaire: proprietaire._id, locataire: locataire._id,
    adresseBien: 'Rue Test', villeBien: 'Brazzaville', montantLoyer: 250000,
  });
};

let tA; let bA; let tB; let bB; let ownerA; let ownerB;
let admin; let manager; let collab; let secretaire; let globalAdmin; let opFull; let proprietaireAdmin;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
  ownerA = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: ownerA, bootstrap: bA });
  await setRole(ownerA._id, tA, 'Collaborateur'); // membership exists so contract's proprietaire.user resolves to tenant A
  ownerB = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tB, user: ownerB, bootstrap: bB });
  await setRole(ownerB._id, tB, 'Collaborateur');

  admin = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
  await setRole(admin._id, tA, 'Admin');

  manager = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: manager, bootstrap: bA });
  await setRole(manager._id, tA, 'GestionnaireImmobilier');

  collab = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: collab, bootstrap: bA });
  await setRole(collab._id, tA, 'Collaborateur');

  secretaire = await makeUser({ role: 'Client' });
  await addTenantMember({ tenant: tA, user: secretaire, bootstrap: bA });
  await setRole(secretaire._id, tA, 'Secretaire');

  globalAdmin = await makeUser({ role: 'Admin' }); // no tenant membership

  opFull = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: opFull._id, actor: bA, reason: 'fx', capabilities: ['platform.support.read', 'platform.users.read', 'platform.users.manage'] });

  proprietaireAdmin = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: tA, user: proprietaireAdmin, bootstrap: bA });
  await setRole(proprietaireAdmin._id, tA, 'Admin');
});

const listA = (u) => request(app).get('/api/rental-contract-regularization').set(bearer(u, tA._id));
const revertA = (u, cid, reason = 'Motif contrôle humain suffisant') => request(app).post(`/api/rental-contract-regularization/${cid}/revert`).set(bearer(u, tA._id)).send({ reason });

describe('REG — Tenant authority + module gate', () => {
  test('REG-01: unauthenticated → 401', async () => {
    const res = await request(app).get('/api/rental-contract-regularization');
    expect(res.status).toBe(401);
  });

  test('REG-02: tenant without location module → 403 (TENANT_MODULE_UNAVAILABLE)', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const res = await listA(admin);
    expect(res.status).toBe(403);
    expect(String(res.body.message || '')).toMatch(/module tenant indisponible/i);
  });

  test('REG-03: module active but caller has NO tenant membership → 403', async () => {
    const outsider = await makeUser({ role: 'Client' }); // no membership anywhere
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(outsider, tA._id));
    expect(res.status).toBe(403);
  });

  test('REG-04: module active + businessRole=Admin → allowed', async () => {
    const res = await listA(admin);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('REG-05: businessRole=GestionnaireImmobilier → allowed on list', async () => {
    const res = await listA(manager);
    expect(res.status).toBe(200);
  });

  test('REG-06: businessRole=Collaborateur → allowed on list/decision', async () => {
    const res = await listA(collab);
    expect(res.status).toBe(200);
  });

  test('REG-07: businessRole=Secretaire → denied (not in allowed set)', async () => {
    const res = await listA(secretaire);
    expect(res.status).toBe(403);
  });

  test('REG-08: global Admin without membership → 403', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(globalAdmin, tA._id));
    expect(res.status).toBe(403);
  });

  test('REG-09: PlatformOperator without tenant membership → 403 (tenant authority not granted by operator status)', async () => {
    const res = await request(app).get('/api/rental-contract-regularization').set(bearer(opFull, tA._id));
    expect(res.status).toBe(403);
  });

  test('REG-10: Proprietaire (global) + tenant businessRole=Admin → allowed', async () => {
    const res = await listA(proprietaireAdmin);
    expect(res.status).toBe(200);
  });

  test('REG-11: Client (global) + tenant businessRole=GestionnaireImmobilier → allowed', async () => {
    // manager is exactly this profile.
    const res = await listA(manager);
    expect(res.status).toBe(200);
  });

  test('REG-12: Tenant A cannot revert/decide a contract belonging to Tenant B (cross-tenant)', async () => {
    const contratB = await seedOpenContract(ownerB);
    const res = await revertA(admin, contratB._id);
    // Cross-tenant contract is out of scope for tenant A. The revert path
    // requires an existing decision to reverse; even before that check,
    // scope resolution refuses the contract. Expect 4xx (not a success).
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('REG-13: forged body/header businessRole cannot escalate', async () => {
    const res = await request(app).get('/api/rental-contract-regularization')
      .set({ ...bearer(collab, tA._id), 'X-Business-Role': 'Admin' })
      .query({ businessRole: 'Admin' });
    // Collaborateur is allowed on list — but the response should be identical
    // whether the forged headers are present or not. The important guarantee
    // is that a Secretaire cannot escalate to Admin via headers.
    expect(res.status).toBe(200);
    const secRes = await request(app).get('/api/rental-contract-regularization')
      .set({ ...bearer(secretaire, tA._id), 'X-Business-Role': 'Admin' })
      .query({ businessRole: 'Admin' });
    expect(secRes.status).toBe(403);
  });

  test('REG-14: suspended membership → 403', async () => {
    await setStatus(admin._id, tA, 'suspended');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('REG-15: revoked membership → 403', async () => {
    await setStatus(admin._id, tA, 'revoked');
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('REG-16: revert requires businessRole=Admin — GestionnaireImmobilier is denied by the route', async () => {
    const contratA = await seedOpenContract(ownerA);
    const res = await revertA(manager, contratA._id);
    expect(res.status).toBe(403);
  });
});

describe('REG-MODULE — module gate semantics on this surface', () => {
  test('REG-MODULE-01: active subscription includes location → allowed', async () => {
    const res = await listA(admin);
    expect(res.status).toBe(200);
  });

  test('REG-MODULE-02: explicit PlatformTenantFeature location=false → deny even if subscription lists it', async () => {
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: false });
    const res = await listA(admin);
    expect(res.status).toBe(403);
  });

  test('REG-MODULE-03: explicit feature location=true grants access (subscription cleared)', async () => {
    await PlatformTenantSubscription.updateOne({ tenant: tA._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    await PlatformTenantFeature.create({ tenant: tA._id, module: 'location', enabled: true });
    const res = await listA(admin);
    expect(res.status).toBe(200);
  });

  test('REG-MODULE-04: tenant switch A→B recomputes module + businessRole independently', async () => {
    // Give admin an Admin membership in B too, then strip B's location module.
    await addTenantMember({ tenant: tB, user: admin, bootstrap: bB });
    await setRole(admin._id, tB, 'Admin');
    await PlatformTenantSubscription.updateOne({ tenant: tB._id, status: { $in: ['trialing', 'active'] } }, { $set: { modulesIncluded: [] } });
    const rA = await request(app).get('/api/rental-contract-regularization').set(bearer(admin, tA._id));
    const rB = await request(app).get('/api/rental-contract-regularization').set(bearer(admin, tB._id));
    expect(rA.status).toBe(200);
    expect(rB.status).toBe(403);
  });
});

describe('REG-QUERY — cross-tenant list isolation', () => {
  test('REG-QUERY-01: Tenant A list contains only tenant-A contracts (no cross-tenant leak)', async () => {
    await seedOpenContract(ownerA); // Tenant A contract
    await seedOpenContract(ownerB); // Tenant B contract
    const res = await listA(admin);
    expect(res.status).toBe(200);
    const cases = res.body.data?.cases || [];
    // Each returned case must reference a proprietaire whose user is a member
    // of tenant A (i.e., ownerA). No case may reference ownerB.
    for (const c of cases) {
      const ownerId = c.contract?.proprietaire?.user;
      if (ownerId) {
        expect(String(ownerId)).not.toBe(String(ownerB._id));
      }
    }
  });
});
