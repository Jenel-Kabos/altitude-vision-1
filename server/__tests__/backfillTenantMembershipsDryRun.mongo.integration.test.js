// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H — matrice BACK-01..BACK-20.
// Prouve que le dry-run produit les classifications attendues sur des
// scénarios réels ET qu'il n'écrit RIEN dans la base.

const { spawnSync } = require('child_process');
const path = require('path');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const OrgUnit = require('../models/OrgUnit');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformOperator = require('../models/PlatformOperator');
const TenantApplication = require('../models/TenantApplication');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const {
  runDryRun,
  describeReadOnlyTarget,
  resolveReadOnlyConnection,
  CLASSIFICATIONS,
  ACTIONS,
} = require('../scripts/backfillTenantMembershipsDryRun');

jest.setTimeout(180000);

const makeUser = async (overrides = {}) => User.create({
  name: 'Test User', email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
  password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', isEmailVerified: true,
  ...overrides,
});

const setMembership = (userId, tenant, patch) => OrgMembership.updateOne(
  { user: userId, orgUnit: tenant.rootOrgUnit }, { $set: patch },
);
const getMembership = (userId, tenant) => OrgMembership.findOne({ user: userId, orgUnit: tenant.rootOrgUnit }).lean();

let tA; let bA;
beforeAll(async () => { await startFinancialMongo(); await OrgMembership.syncIndexes(); });
afterAll(stopFinancialMongo);
beforeEach(async () => {
  await clearFinancialMongo();
  const fA = await createTenantFixture({ label: 'Tenant A' });
  tA = fA.tenant; bA = fA.bootstrap;
});

// ── Write-detection guard ───────────────────────────────────────────────────
// Wraps every mongoose write API and every collection write API. If the
// dry-run touches any of them the wrapping method throws, and the test that
// invoked runDryRun fails immediately with a specific message. Restored in
// afterEach so unrelated fixture setup keeps working.
const FORBIDDEN_MODEL_METHODS = ['updateOne', 'updateMany', 'create', 'insertMany', 'save',
  'findOneAndUpdate', 'findByIdAndUpdate', 'findOneAndDelete', 'findByIdAndDelete',
  'deleteOne', 'deleteMany', 'bulkWrite', 'replaceOne'];
const FORBIDDEN_COLLECTION_METHODS = ['insertOne', 'insertMany', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndDelete', 'bulkWrite'];

function installWriteGuards() {
  const restorers = [];
  const models = [User, OrgMembership, OrgUnit, PlatformTenant, PlatformOperator, TenantApplication];
  for (const Model of models) {
    for (const m of FORBIDDEN_MODEL_METHODS) {
      const original = Model[m];
      if (typeof original !== 'function') continue;
      Model[m] = function guarded(...guardArgs) { throw new Error(`WRITE_ATTEMPTED_1H: ${Model.modelName}.${m}(${JSON.stringify(guardArgs[0] || {}).slice(0, 60)})`); };
      restorers.push(() => { Model[m] = original; });
    }
    const coll = Model.collection;
    for (const m of FORBIDDEN_COLLECTION_METHODS) {
      const original = coll[m];
      if (typeof original !== 'function') continue;
      coll[m] = function guarded() { throw new Error(`WRITE_ATTEMPTED_1H: ${Model.modelName}.collection.${m}`); };
      restorers.push(() => { coll[m] = original; });
    }
  }
  return () => restorers.forEach((r) => r());
}

// ═══════════════════════════════════════════════════════════════════════════

describe('BACK — dry-run classification matrix', () => {
  test('READONLY-01/02/03/04: URI dédiée obligatoire sans fallback implicite', () => {
    const applicationUri = 'mongodb://app:application-secret@example.test/altitudevision';
    const financialUri = 'mongodb://finance:financial-secret@example.test/altitudevision';
    for (const env of [
      {},
      { MONGO_URI: applicationUri },
      { MONGODB_FINANCIAL_INTEGRATION_URI: financialUri },
      { MONGO_URI_READONLY: '   ', MONGO_URI: applicationUri, MONGODB_FINANCIAL_INTEGRATION_URI: financialUri },
    ]) {
      expect(() => resolveReadOnlyConnection(env)).toThrow('READONLY_URI_REQUIRED');
    }
  });

  test('READONLY-01/02: le CLI refuse avant connexion lorsque seule MONGO_URI existe', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsDryRun.js');
    const secret = 'application-secret-must-not-leak';
    const res = spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        MONGO_URI: `mongodb://app:${secret}@application.example.test/altitudevision`,
        MONGO_URI_READONLY: '',
      },
    });
    const output = `${String(res.stdout)}${String(res.stderr)}`;
    expect(res.status).not.toBe(0);
    expect(output).toMatch(/READONLY_URI_REQUIRED/);
    expect(output).not.toContain(secret);
    expect(output).not.toContain('application.example.test');
    expect(output).not.toMatch(/PREFLIGHT_CONNECTION_FAILED/);
  });

  test('READONLY-05/06: seule la base altitudevision est acceptée', () => {
    expect(() => describeReadOnlyTarget('mongodb://readonly:secret@example.test/other'))
      .toThrow('READONLY_DATABASE_REQUIRED');
    expect(describeReadOnlyTarget('mongodb+srv://readonly:secret@cluster.example.test/altitudevision'))
      .toMatchObject({ scheme: 'mongodb+srv', databaseName: 'altitudevision' });
  });

  test('READONLY-07/08/09/10: métadonnées secret-safe et fingerprint déterministe', () => {
    const uri = 'mongodb+srv://readonly-user:never-print-this-password@cluster.example.test/altitudevision?retryWrites=true';
    const first = describeReadOnlyTarget(uri);
    const second = describeReadOnlyTarget(uri);
    const serialized = JSON.stringify(first);
    expect(first.hostFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toEqual(second);
    expect(serialized).not.toContain(uri);
    expect(serialized).not.toContain('readonly-user');
    expect(serialized).not.toContain('never-print-this-password');
    expect(serialized).not.toContain('cluster.example.test');
  });

  test('READONLY-07/08/09: refus CLI ne divulgue aucune URI ni credential', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsDryRun.js');
    const applicationSecret = 'application-password-must-not-leak';
    const readOnlySecret = 'readonly-password-must-not-leak';
    const res = spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        MONGO_URI: `mongodb://app:${applicationSecret}@application.example.test/altitudevision`,
        MONGO_URI_READONLY: `mongodb://readonly:${readOnlySecret}@readonly.example.test/wrong-database`,
      },
    });
    const output = `${String(res.stdout)}${String(res.stderr)}`;
    expect(res.status).not.toBe(0);
    expect(output).toMatch(/READONLY_DATABASE_REQUIRED/);
    expect(output).not.toContain(applicationSecret);
    expect(output).not.toContain(readOnlySecret);
    expect(output).not.toContain('application.example.test');
    expect(output).not.toContain('readonly.example.test');
  });

  test('BACK-01: businessRole déjà présent → ALREADY_CANONICAL / SKIP', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { businessRole: 'Admin' });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.ALREADY_CANONICAL);
    expect(row.action).toBe(ACTIONS.SKIP);
    expect(row.proposedBusinessRole).toBeNull();
  });

  test('BACK-02: founder confirmé (TenantApplication) → UPDATE Admin / HIGH', async () => {
    const founder = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: founder, bootstrap: bA });
    const m = await getMembership(founder._id, tA);
    // Simulate approveApplication: link a completed application to this
    // membership. Two active tenant-root memberships would make it look
    // multi-tenant, so we test founder cleanly.
    await TenantApplication.collection.insertOne({
      applicant: founder._id, provisionedTenant: tA._id, provisionedMembership: m._id,
      status: 'APPROVED', organizationName: 'Fixture Org', revision: 1, history: [], createdAt: new Date(), updatedAt: new Date(),
    });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.membershipId === String(m._id));
    expect(row.classification).toBe(CLASSIFICATIONS.UPDATE_CANDIDATE);
    expect(row.action).toBe(ACTIONS.UPDATE);
    expect(row.proposedBusinessRole).toBe('Admin');
    expect(row.source).toBe('tenant_application_founder');
    expect(row.confidence).toBe('HIGH');
  });

  test('BACK-03: single active User.role=Collaborateur → UPDATE Collaborateur / HIGH', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.UPDATE_CANDIDATE);
    expect(row.action).toBe(ACTIONS.UPDATE);
    expect(row.proposedBusinessRole).toBe('Collaborateur');
    expect(row.source).toBe('legacy_user_role_single_tenant');
  });

  test('BACK-04: User.role=Client (external) → EXTERNAL_ROLE / SKIP', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.EXTERNAL_ROLE);
    expect(row.action).toBe(ACTIONS.SKIP);
    expect(row.proposedBusinessRole).toBeNull();
  });

  test('BACK-05: multi-tenant sans signal spécifique → MULTI_TENANT_MANUAL_REVIEW', async () => {
    const fB = await createTenantFixture({ label: 'Tenant B' });
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: u, bootstrap: fB.bootstrap });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const rows = report.candidates.filter((c) => c.userId === String(u._id));
    expect(rows).toHaveLength(2);
    rows.forEach((r) => {
      expect(r.classification).toBe(CLASSIFICATIONS.MULTI_TENANT_MANUAL_REVIEW);
      expect(r.action).toBe(ACTIONS.MANUAL_REVIEW);
      expect(r.proposedBusinessRole).toBeNull();
    });
  });

  test('BACK-06: suspended → SKIP_SUSPENDED', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { status: 'suspended' });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.SKIP_SUSPENDED);
  });

  test('BACK-07: revoked → SKIP_REVOKED', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { status: 'revoked' });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.SKIP_REVOKED);
  });

  test('BACK-08: technical User → SKIP_TECHNICAL', async () => {
    const u = await makeUser({ role: 'Proprietaire', isTechnical: true });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.SKIP_TECHNICAL);
  });

  test('BACK-09: orphan membership (User deleted) → ORPHAN_MEMBERSHIP', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    // Delete User out-of-band, then run dry-run.
    await User.collection.deleteOne({ _id: u._id });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const rows = report.candidates.filter((c) => c.userId === String(u._id));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].classification).toBe(CLASSIFICATIONS.ORPHAN_MEMBERSHIP);
  });

  test('BACK-10: PlatformOperator sans OrgMembership → aucun membership synthétisé', async () => {
    const op = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: op._id, actor: bA, reason: 'fx', capabilities: ['platform.users.manage'] });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const rows = report.candidates.filter((c) => c.userId === String(op._id));
    // No membership existed → no row for this user. Report should not
    // fabricate one.
    expect(rows).toHaveLength(0);
    expect(report.summary.TOTAL_MEMBERSHIPS_SCANNED).toBe(0);
  });

  test('BACK-11: tenant archived → SKIP_TENANT_UNAVAILABLE', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await PlatformTenant.collection.updateOne({ _id: tA._id }, { $set: { status: 'archived' } });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.SKIP_TENANT_UNAVAILABLE);
  });

  test('BACK-12: idempotence — deux runs consécutifs produisent le même contenu métier', async () => {
    const u1 = await makeUser({ role: 'Admin' });
    const u2 = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u1, bootstrap: bA });
    await addTenantMember({ tenant: tA, user: u2, bootstrap: bA });

    const uninstall = installWriteGuards();
    const a = await runDryRun({ generatedAt: 'fixed' });
    const b = await runDryRun({ generatedAt: 'fixed' });
    uninstall();

    expect(a).toEqual(b);
  });

  test('BACK-13/14/15/16: dry-run ne mute ni businessRole, ni User.role, ni User.isActive, ni le count OrgMembership', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const beforeUser = await User.findById(u._id).lean();
    const beforeM = await getMembership(u._id, tA);
    const beforeCount = await OrgMembership.countDocuments({});

    const uninstall = installWriteGuards();
    await runDryRun();
    uninstall();

    const afterUser = await User.findById(u._id).lean();
    const afterM = await getMembership(u._id, tA);
    const afterCount = await OrgMembership.countDocuments({});
    expect(afterM.businessRole).toBe(beforeM.businessRole); // still null
    expect(afterM.status).toBe(beforeM.status);
    expect(afterUser.role).toBe(beforeUser.role);
    expect(afterUser.isActive).toBe(beforeUser.isActive);
    expect(afterCount).toBe(beforeCount);
  });

  test('BACK-17: le script refuse toute option write/commit', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsDryRun.js');
    for (const flag of ['--commit', '--apply', '--write', '--execute']) {
      const res = spawnSync(process.execPath, [scriptPath, flag], { env: { ...process.env, MONGO_URI: '' } });
      expect(res.status).toBe(2);
      expect(String(res.stderr)).toMatch(/WRITE MODE IS NOT AVAILABLE IN PHASE 1H/);
    }
  });

  test('BACK-18: non-root OrgMembership → SKIP_NON_TENANT_ROOT', async () => {
    // Add a membership on a sub-unit (not a tenant root).
    const subUnit = await OrgUnit.create({ name: 'Sub team', type: 'team', parent: tA.rootOrgUnit });
    const u = await makeUser({ role: 'Collaborateur' });
    await OrgMembership.collection.insertOne({
      user: u._id, orgUnit: subUnit._id, roleInUnit: 'member',
      businessRole: null, status: 'active', grantedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.SKIP_NON_TENANT_ROOT);
  });

  test('BACK-19: businessRole canonique différent de User.role → ALREADY_CANONICAL (no overwrite)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { businessRole: 'Admin' });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const row = report.candidates.find((c) => c.userId === String(u._id));
    expect(row.classification).toBe(CLASSIFICATIONS.ALREADY_CANONICAL);
    expect(row.action).toBe(ACTIONS.SKIP);
    expect(row.proposedBusinessRole).toBeNull();
    expect(row.reason).toMatch(/differs from canonical/);
  });

  test('BACK-20: multi-tenant + TenantApplication précise pour un tenant → founder UPDATE ; autre MANUAL_REVIEW', async () => {
    const fB = await createTenantFixture({ label: 'Tenant B' });
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: u, bootstrap: fB.bootstrap });
    const mA = await getMembership(u._id, tA);
    await TenantApplication.collection.insertOne({
      applicant: u._id, provisionedTenant: tA._id, provisionedMembership: mA._id,
      status: 'APPROVED', organizationName: 'Fixture A', revision: 1, history: [], createdAt: new Date(), updatedAt: new Date(),
    });

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    const rowA = report.candidates.find((c) => c.membershipId === String(mA._id));
    const rowB = report.candidates.find((c) => c.userId === String(u._id) && c.tenantId === String(fB.tenant._id));
    expect(rowA.classification).toBe(CLASSIFICATIONS.UPDATE_CANDIDATE);
    expect(rowA.source).toBe('tenant_application_founder');
    expect(rowB.classification).toBe(CLASSIFICATIONS.MULTI_TENANT_MANUAL_REVIEW);
  });
});

// ── Zero-write proof — global snapshot ───────────────────────────────────────
describe('BACK · ZERO-WRITE PROOF', () => {
  test('write-detection guards trip a synthetic write (sanity check the guard itself)', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const uninstall = installWriteGuards();
    try {
      // The guard throws synchronously — never returns a rejected Promise.
      expect(() => User.updateOne({ _id: u._id }, { $set: { name: 'X' } })).toThrow(/WRITE_ATTEMPTED_1H/);
    } finally { uninstall(); }
  });

  test('End-to-end snapshot: no counts, no fields change across a mixed dataset', async () => {
    const fB = await createTenantFixture({ label: 'Tenant B' });
    const admin = await makeUser({ role: 'Admin' });
    const collab = await makeUser({ role: 'Collaborateur' });
    const client = await makeUser({ role: 'Client' });
    const tech = await makeUser({ role: 'Proprietaire', isTechnical: true });
    const multi = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: admin, bootstrap: bA });
    await addTenantMember({ tenant: tA, user: collab, bootstrap: bA });
    await addTenantMember({ tenant: tA, user: client, bootstrap: bA });
    await addTenantMember({ tenant: tA, user: tech, bootstrap: bA });
    await addTenantMember({ tenant: tA, user: multi, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: multi, bootstrap: fB.bootstrap });

    const beforeUsers = await User.countDocuments({});
    const beforeMembers = await OrgMembership.countDocuments({});
    const beforeBusinessRoles = (await OrgMembership.find({}).sort({ _id: 1 }).select('_id businessRole status').lean())
      .map((m) => `${m._id}:${m.businessRole || 'null'}:${m.status}`);
    const beforeUserRoles = (await User.find({}).sort({ _id: 1 }).select('_id role isActive').lean())
      .map((u) => `${u._id}:${u.role}:${u.isActive}`);

    const uninstall = installWriteGuards();
    const report = await runDryRun();
    uninstall();

    // Sanity: report has one row per membership.
    expect(report.summary.TOTAL_MEMBERSHIPS_SCANNED).toBe(beforeMembers);

    const afterUsers = await User.countDocuments({});
    const afterMembers = await OrgMembership.countDocuments({});
    const afterBusinessRoles = (await OrgMembership.find({}).sort({ _id: 1 }).select('_id businessRole status').lean())
      .map((m) => `${m._id}:${m.businessRole || 'null'}:${m.status}`);
    const afterUserRoles = (await User.find({}).sort({ _id: 1 }).select('_id role isActive').lean())
      .map((u) => `${u._id}:${u.role}:${u.isActive}`);

    expect(afterUsers).toBe(beforeUsers);
    expect(afterMembers).toBe(beforeMembers);
    expect(afterBusinessRoles).toEqual(beforeBusinessRoles);
    expect(afterUserRoles).toEqual(beforeUserRoles);
  });
});
