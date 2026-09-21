// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1 · ROLE-SOURCE-01..ROLE-SOURCE-08.
// Certifie que l'autorité tenant vient EXCLUSIVEMENT d'OrgMembership.businessRole,
// jamais de User.role global, et que le fallback legacy (retiré en 2D) reste
// désactivé. Ces tests exercent `resolveTenantMembership` directement — le seul
// consommateur runtime — puis vérifient la sémantique via `requireTenantMembershipRole`.

const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const { resolveTenantMembership } = require('../services/tenantMembershipService');

jest.setTimeout(180000);

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

let tA; let bA; let tB; let bB;

beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
});

describe('ROLE-SOURCE — tenant authority derives from OrgMembership.businessRole only', () => {
  test('ROLE-SOURCE-01: Proprietaire + businessRole=Secretaire → Secretaire tenant authority', async () => {
    const u = await makeUser({ role: 'Proprietaire' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setRole(u._id, tA, 'Secretaire');
    const r = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(r.businessRole).toBe('Secretaire');
    expect(r.source).toBe('membership_business_role');
  });

  test('ROLE-SOURCE-02: Client + businessRole=GestionnaireImmobilier → Gestionnaire tenant authority', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setRole(u._id, tA, 'GestionnaireImmobilier');
    const r = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(r.businessRole).toBe('GestionnaireImmobilier');
  });

  test('ROLE-SOURCE-03: Admin + businessRole=Collaborateur → Collaborateur tenant authority only', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setRole(u._id, tA, 'Collaborateur');
    const r = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(r.businessRole).toBe('Collaborateur');
    // Note: global User.role='Admin' remains a separate platform concern;
    // this API returns only the tenant-scoped role.
  });

  test('ROLE-SOURCE-04: legacy User.role=Secretaire + businessRole=null → no tenant authority', async () => {
    const u = await makeUser({ role: 'Secretaire' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    // Leave businessRole=null.
    const r = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(r.businessRole).toBeNull();
    expect(r.source).toBeNull();
  });

  test('ROLE-SOURCE-05: legacy User.role=GestionnaireImmobilier + businessRole=null → no tenant authority', async () => {
    const u = await makeUser({ role: 'GestionnaireImmobilier' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const r = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(r.businessRole).toBeNull();
  });

  test('ROLE-SOURCE-06: role supplied from body/header is ignored (only membership is authoritative)', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setRole(u._id, tA, 'Communicant');
    // Pass an "attempted forgery" via a fake extra option — the API doesn't
    // read anything beyond (userId, tenantId, options.allowLegacyRoleFallback).
    const forged = await resolveTenantMembership(u._id, tA._id, {
      allowLegacyRoleFallback: false,
      role: 'Admin',
      tenantBusinessRole: 'Admin',
      businessRole: 'Admin',
    });
    expect(forged.businessRole).toBe('Communicant');
  });

  test('ROLE-SOURCE-07: tenant A and tenant B businessRoles are independent', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: tB, user: u, bootstrap: bB });
    await setRole(u._id, tA, 'Admin');
    await setRole(u._id, tB, 'Collaborateur');
    const rA = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    const rB = await resolveTenantMembership(u._id, tB._id, { allowLegacyRoleFallback: false });
    expect(rA.businessRole).toBe('Admin');
    expect(rB.businessRole).toBe('Collaborateur');
  });

  test('ROLE-SOURCE-08: suspended/revoked membership denied', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setRole(u._id, tA, 'Admin');
    await setStatus(u._id, tA, 'suspended');
    const suspended = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(suspended).toBeNull();
    await setStatus(u._id, tA, 'revoked');
    const revoked = await resolveTenantMembership(u._id, tA._id, { allowLegacyRoleFallback: false });
    expect(revoked).toBeNull();
  });
});
