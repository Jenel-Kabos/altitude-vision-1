// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1D.1 — distributed last-admin
// invariant. Le mutex in-memory de la phase 1D a été retiré ; la sûreté
// est désormais assurée par un write-lock Mongo sur le document
// PlatformTenant, combiné aux retries automatiques de session.withTransaction
// sur TransientTransactionError (WriteConflict). Ces tests bypasse tout
// verrou intra-process et invoque le service directement en parallèle.

const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const service = require('../services/tenantMemberService');

jest.setTimeout(180000);

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
  ...overrides,
});

const addAdmin = async (tenant, bootstrap) => {
  const u = await makeUser();
  await addTenantMember({ tenant, user: u, bootstrap });
  await OrgMembership.updateOne(
    { user: u._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    { $set: { businessRole: 'Admin' } },
  );
  const m = await OrgMembership.findOne({ user: u._id, orgUnit: tenant.rootOrgUnit, status: 'active' }).lean();
  return { user: u, membership: m };
};

const countActiveAdmins = (tenant) => OrgMembership.countDocuments({
  orgUnit: tenant.rootOrgUnit, status: 'active', businessRole: 'Admin',
});

const settlePair = async (p1, p2) => Promise.allSettled([p1, p2]);
const codes = (results) => results.map((r) => (r.status === 'fulfilled' ? 'ok' : (r.reason?.code || r.reason?.name || 'err'))).sort();

let tA; let tB; let bA; let bB; let actor;

beforeAll(async () => {
  await startFinancialMongo();
  await OrgMembership.syncIndexes();
});
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  const fB = await createTenantFixture({ label: 'Tenant B' });
  tA = fA.tenant; bA = fA.bootstrap;
  tB = fB.tenant; bB = fB.bootstrap;
  actor = fA.bootstrap;
});

describe('DIST-ADMIN — invariant last-admin sous concurrence Mongo', () => {
  test('DIST-ADMIN-01: revoke A + revoke B concurrent → 1 seul succès, ≥ 1 Admin restant', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    const results = await settlePair(
      service.revokeMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.revokeMember({ tenantId: tA._id, membershipId: B.membership._id, actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    expect(codes(results).sort()).toEqual(['LAST_TENANT_ADMIN', 'ok']);
  });

  test('DIST-ADMIN-02: suspend A + suspend B concurrent → ≥ 1 Admin', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    const results = await settlePair(
      service.suspendMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.suspendMember({ tenantId: tA._id, membershipId: B.membership._id, actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    expect(codes(results)).toEqual(['LAST_TENANT_ADMIN', 'ok']);
  });

  test('DIST-ADMIN-03: demote A + demote B concurrent → ≥ 1 Admin', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    const results = await settlePair(
      service.changeRole({ tenantId: tA._id, membershipId: A.membership._id, businessRole: 'Collaborateur', actor }),
      service.changeRole({ tenantId: tA._id, membershipId: B.membership._id, businessRole: 'Collaborateur', actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    expect(codes(results)).toEqual(['LAST_TENANT_ADMIN', 'ok']);
  });

  test('DIST-ADMIN-04: revoke A + demote B concurrent → ≥ 1 Admin', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    const results = await settlePair(
      service.revokeMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.changeRole({ tenantId: tA._id, membershipId: B.membership._id, businessRole: 'Secretaire', actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    expect(codes(results)).toEqual(['LAST_TENANT_ADMIN', 'ok']);
  });

  test('DIST-ADMIN-05: suspend A + revoke B concurrent → ≥ 1 Admin', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    const results = await settlePair(
      service.suspendMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.revokeMember({ tenantId: tA._id, membershipId: B.membership._id, actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    expect(codes(results)).toEqual(['LAST_TENANT_ADMIN', 'ok']);
  });

  test('DIST-ADMIN-06: trois Admins, deux revoke concurrents → 2 succès, ≥ 1 Admin', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    await addAdmin(tA, bA); // C reste protégé
    const results = await settlePair(
      service.revokeMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.revokeMember({ tenantId: tA._id, membershipId: B.membership._id, actor }),
    );
    expect(await countActiveAdmins(tA)).toBeGreaterThanOrEqual(1);
    // Les deux revokes réussissent (l'invariant ≥ 1 reste satisfait grâce à C).
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  });

  test('DIST-ADMIN-08: mutations sur tenants distincts NE se bloquent pas', async () => {
    const A1 = await addAdmin(tA, bA);
    const A2 = await addAdmin(tA, bA);
    const B1 = await addAdmin(tB, bB);
    const B2 = await addAdmin(tB, bB);
    // Un revoke sur tenant A + un revoke sur tenant B — chacun doit réussir
    // (les invariants sont locaux à chaque tenant).
    const results = await Promise.allSettled([
      service.revokeMember({ tenantId: tA._id, membershipId: A1.membership._id, actor: bA }),
      service.revokeMember({ tenantId: tB._id, membershipId: B1.membership._id, actor: bB }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(await countActiveAdmins(tA)).toBe(1); // A2 subsiste
    expect(await countActiveAdmins(tB)).toBe(1); // B2 subsiste
    // Sanity: pas de bloccage croisé — les deux mutations sont indépendantes.
  });

  test('DIST-ADMIN-07: retry après TransientTransactionError — pas de double effet observé', async () => {
    const A = await addAdmin(tA, bA);
    const B = await addAdmin(tA, bA);
    // Deux revokes ciblant la même membership (A) : le second doit trouver
    // "MEMBERSHIP_ALREADY_REVOKED" (409), pas re-exécuter.
    const results = await settlePair(
      service.revokeMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
      service.revokeMember({ tenantId: tA._id, membershipId: A.membership._id, actor }),
    );
    const kinds = codes(results);
    // Le winner résout à 'ok' ; le loser voit soit MEMBERSHIP_ALREADY_REVOKED
    // (état déjà commité), soit LAST_TENANT_ADMIN si le retry lui montre
    // que le tenant n'aurait plus d'Admin.
    expect(kinds).toContain('ok');
    expect(kinds.some((k) => k === 'MEMBERSHIP_ALREADY_REVOKED' || k === 'LAST_TENANT_ADMIN')).toBe(true);
    // Aucun doublon : une seule revocation persiste.
    const revokedCount = await OrgMembership.countDocuments({ _id: A.membership._id, status: 'revoked' });
    expect(revokedCount).toBe(1);
    // B subsiste comme Admin actif.
    const bStillActive = await OrgMembership.findOne({ _id: B.membership._id, status: 'active' });
    expect(bStillActive).not.toBeNull();
  });
});
