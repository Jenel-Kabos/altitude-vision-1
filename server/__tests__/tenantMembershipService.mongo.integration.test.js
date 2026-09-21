// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1B — foundation multi-tenant :
// une même identité User porte un `businessRole` DIFFÉRENT par tenant via
// `OrgMembership.businessRole`. Aucun rôle externe (Client/Proprietaire/
// Prestataire) ne devient implicitement membre. `User.role` reste global,
// jamais muté par la résolution.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformOperator = require('../models/PlatformOperator');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const { resolveTenantMembership } = require('../services/tenantMembershipService');

jest.setTimeout(120000);

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User', email: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true,
  ...overrides,
});

const setBusinessRole = async (userId, tenant, businessRole) => {
  await OrgMembership.updateOne(
    { user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole } },
  );
};

let tenantA; let tenantB; let tenantC; let bootstrapA; let bootstrapB; let bootstrapC;

beforeAll(async () => {
  await startFinancialMongo();
  // Force la construction des indexes partiels avant les tests de concurrence.
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  const fC = await createTenantFixture({ label: 'Tenant C' });
  tenantA = fA.tenant; bootstrapA = fA.bootstrap;
  tenantB = fB.tenant; bootstrapB = fB.bootstrap;
  tenantC = fC.tenant; bootstrapC = fC.bootstrap;
});

describe('MEM — resolveTenantMembership', () => {
  test('MEM-01 · MEM-12: une identité User unique porte 3 memberships avec 3 rôles différents; User.role inchangé', async () => {
    const joseph = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: joseph, bootstrap: bootstrapA });
    await addTenantMember({ tenant: tenantB, user: joseph, bootstrap: bootstrapB });
    await addTenantMember({ tenant: tenantC, user: joseph, bootstrap: bootstrapC });
    await setBusinessRole(joseph._id, tenantA, 'Admin');
    await setBusinessRole(joseph._id, tenantB, 'Collaborateur');
    await setBusinessRole(joseph._id, tenantC, 'GestionnaireImmobilier');

    const rA = await resolveTenantMembership(joseph._id, tenantA._id);
    const rB = await resolveTenantMembership(joseph._id, tenantB._id);
    const rC = await resolveTenantMembership(joseph._id, tenantC._id);
    expect(rA.businessRole).toBe('Admin');
    expect(rB.businessRole).toBe('Collaborateur');
    expect(rC.businessRole).toBe('GestionnaireImmobilier');
    expect(rA.source).toBe('membership_business_role');

    // User.role global n'a pas bougé.
    const fresh = await User.findById(joseph._id).select('role').lean();
    expect(fresh.role).toBe('Collaborateur');
    // Un seul document User existe pour cette identité.
    expect(await User.countDocuments({ email: joseph.email })).toBe(1);
  });

  test('MEM-02 · MEM-03: rôles distincts par tenant via le service (isolation stricte)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    await addTenantMember({ tenant: tenantB, user: u, bootstrap: bootstrapB });
    await setBusinessRole(u._id, tenantA, 'Admin');
    await setBusinessRole(u._id, tenantB, 'CommunityManager');
    expect((await resolveTenantMembership(u._id, tenantA._id)).businessRole).toBe('Admin');
    expect((await resolveTenantMembership(u._id, tenantB._id)).businessRole).toBe('CommunityManager');
  });

  test('MEM-04: membership suspended n\'accorde aucune autorité', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    await setBusinessRole(u._id, tenantA, 'Admin');
    await OrgMembership.updateOne({ user: u._id, orgUnit: tenantA.rootOrgUnit }, { $set: { status: 'suspended' } });
    expect(await resolveTenantMembership(u._id, tenantA._id)).toBeNull();
  });

  test('MEM-05: membership revoked n\'accorde aucune autorité', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    await setBusinessRole(u._id, tenantA, 'Admin');
    await OrgMembership.updateOne({ user: u._id, orgUnit: tenantA.rootOrgUnit }, { $set: { status: 'revoked' } });
    expect(await resolveTenantMembership(u._id, tenantA._id)).toBeNull();
  });

  test('MEM-06: tenant forgé (ObjectId sans membership) est rejeté', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    await setBusinessRole(u._id, tenantA, 'Admin');
    // Tenant B : aucune membership.
    expect(await resolveTenantMembership(u._id, tenantB._id)).toBeNull();
    // Faux ObjectId inconnu.
    expect(await resolveTenantMembership(u._id, new mongoose.Types.ObjectId())).toBeNull();
  });

  test('MEM-07: Client externe (aucun OrgMembership) n\'est pas member', async () => {
    const c = await makeUser({ role: 'Client' });
    expect(await resolveTenantMembership(c._id, tenantA._id)).toBeNull();
  });

  test('MEM-08: Proprietaire externe (aucun OrgMembership) n\'est pas member', async () => {
    const p = await makeUser({ role: 'Proprietaire' });
    expect(await resolveTenantMembership(p._id, tenantA._id)).toBeNull();
  });

  test('MEM-09: Prestataire externe (aucun OrgMembership) n\'est pas member', async () => {
    const p = await makeUser({ role: 'Prestataire' });
    expect(await resolveTenantMembership(p._id, tenantA._id)).toBeNull();
  });

  test('MEM-10: PlatformOperator seul ne devient pas implicitement member tenant', async () => {
    const op = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: op._id, actor: bootstrapA, reason: 'op fixture', capabilities: ['platform.support.read'] });
    expect(await resolveTenantMembership(op._id, tenantA._id)).toBeNull();
  });

  test('MEM-11: contrainte partial-unique existante empêche double membership active identique', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    // Deuxième insert direct avec les MÊMES (user, orgUnit, roleInUnit, status:'active') → refusé par l'index partiel.
    await expect(OrgMembership.create({
      user: u._id, orgUnit: tenantA.rootOrgUnit, roleInUnit: 'member', status: 'active',
    })).rejects.toBeTruthy();
    expect(await OrgMembership.countDocuments({ user: u._id, orgUnit: tenantA.rootOrgUnit, status: 'active' })).toBe(1);
  });

  test.each(['Admin', 'GestionnaireImmobilier', 'Secretaire'])(
    'FALLBACK-01..03: User.role=%s + membership businessRole=null ne produit aucune autorité tenant',
    async (role) => {
      const u = await makeUser({ role });
      await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
      const res = await resolveTenantMembership(u._id, tenantA._id);
      expect(res.businessRole).toBeNull();
      expect(res.source).toBeNull();
    },
  );

  test('un ancien opt-in allowLegacyRoleFallback=true reste sans effet après retrait', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    const res = await resolveTenantMembership(u._id, tenantA._id, { allowLegacyRoleFallback: true });
    expect(res.businessRole).toBeNull();
    expect(res.source).toBeNull();
  });

  test.each([
    ['Proprietaire', 'Admin', 'FALLBACK-04'],
    ['Client', 'GestionnaireImmobilier', 'FALLBACK-05'],
    ['Admin', 'Collaborateur', 'FALLBACK-06'],
  ])('%s + businessRole=%s suit exclusivement la membership (%s)', async (globalRole, businessRole) => {
    const u = await makeUser({ role: globalRole });
    await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
    await setBusinessRole(u._id, tenantA, businessRole);
    const res = await resolveTenantMembership(u._id, tenantA._id);
    expect(res.businessRole).toBe(businessRole);
    expect(res.source).toBe('membership_business_role');
    expect((await User.findById(u._id).select('role').lean()).role).toBe(globalRole);
  });

  test('User.role = Client / Proprietaire / Prestataire : legacy fallback ne synthétise PAS un businessRole tenant', async () => {
    for (const role of ['Client', 'Proprietaire', 'Prestataire']) {
      const u = await makeUser({ role });
      await addTenantMember({ tenant: tenantA, user: u, bootstrap: bootstrapA });
      const res = await resolveTenantMembership(u._id, tenantA._id);
      expect(res.businessRole).toBeNull();
      expect(res.source).toBeNull();
    }
  });
});
