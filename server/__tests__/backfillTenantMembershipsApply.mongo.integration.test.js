// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H.1 — matrice APPLY-01..APPLY-30.
// Certifie que le mécanisme de backfill contrôlé n'écrit QUE sur les
// candidats UPDATE + HIGH, respecte le --limit, refuse toute autre catégorie,
// n'écrase pas un businessRole existant, résiste à un update concurrent
// (CAS), et audite chaque écriture via ActionLog.

const { spawnSync } = require('child_process');
const path = require('path');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');
const OrgUnit = require('../models/OrgUnit');
const TenantApplication = require('../models/TenantApplication');
const ActionLog = require('../models/ActionLog');
const applyMod = require('../scripts/backfillTenantMembershipsApply');
const { runApply, computeDryRunHash, isEligibleCandidate, parseArgs, validateArgs, ACTION_NAME } = applyMod;

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

const commitArgs = (extra = []) => ['--live', '--commit', ...extra];

// ═══════════════════════════════════════════════════════════════════════════

describe('APPLY — happy paths (HIGH candidates)', () => {
  test('APPLY-01: HIGH single-tenant candidate → update businessRole', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const report = await runApply({ argv: commitArgs(['--limit', '10']) });
    const m = await getMembership(u._id, tA);
    expect(m.businessRole).toBe('Collaborateur');
    expect(report.summary.APPLIED).toBe(1);
    expect(report.summary.ACTION_LOGS_CREATED).toBe(1);
  });

  test('APPLY-02: founder HIGH → update Admin', async () => {
    const founder = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: founder, bootstrap: bA });
    const m = await getMembership(founder._id, tA);
    await TenantApplication.collection.insertOne({
      applicant: founder._id, provisionedTenant: tA._id, provisionedMembership: m._id,
      status: 'APPROVED', organizationName: 'Fixture', revision: 1, history: [], createdAt: new Date(), updatedAt: new Date(),
    });
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await getMembership(founder._id, tA);
    expect(after.businessRole).toBe('Admin');
  });
});

describe('APPLY — categorical isolation (never write)', () => {
  test('APPLY-03: MANUAL_REVIEW → untouched', async () => {
    const u = await makeUser({ role: 'Unknown' }).catch(() => makeUser({ role: 'Collaborateur' }));
    // Force MANUAL_REVIEW by giving a legacy role NOT in TENANT_BUSINESS_ROLES.
    // 'User' triggers EXTERNAL_ROLE, so use manual scenario: multi-tenant with no App.
    const fB = await createTenantFixture({ label: 'Tenant B' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: u, bootstrap: fB.bootstrap });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    const mA = await getMembership(u._id, tA);
    const mB = await getMembership(u._id, fB.tenant);
    expect(mA.businessRole).toBeNull();
    expect(mB.businessRole).toBeNull();
  });

  test('APPLY-04: MULTI_TENANT_MANUAL_REVIEW → untouched (already covered by APPLY-03 dataset)', async () => {
    const fB = await createTenantFixture({ label: 'Tenant B' });
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: u, bootstrap: fB.bootstrap });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    expect((await getMembership(u._id, tA)).businessRole).toBeNull();
    expect((await getMembership(u._id, fB.tenant)).businessRole).toBeNull();
  });

  test('APPLY-05: CONFLICT-like row (invalid classification) never eligible', () => {
    expect(isEligibleCandidate({ action: 'CONFLICT', classification: 'CONFLICT', confidence: 'HIGH', currentBusinessRole: null, proposedBusinessRole: 'Admin', membershipId: 'x', userId: 'y', tenantId: 'z' })).toBe(false);
  });

  test('APPLY-06: external role → untouched', async () => {
    const u = await makeUser({ role: 'Client' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    expect((await getMembership(u._id, tA)).businessRole).toBeNull();
  });

  test('APPLY-07: suspended → untouched', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { status: 'suspended' });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    const m = await getMembership(u._id, tA);
    expect(m.businessRole).toBeNull();
    expect(m.status).toBe('suspended');
  });

  test('APPLY-08: revoked → untouched', async () => {
    const u = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { status: 'revoked' });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    const m = await getMembership(u._id, tA);
    expect(m.businessRole).toBeNull();
    expect(m.status).toBe('revoked');
  });

  test('APPLY-09: non-root membership → untouched', async () => {
    const subUnit = await OrgUnit.create({ name: 'Sub', type: 'team', parent: tA.rootOrgUnit });
    const u = await makeUser({ role: 'Collaborateur' });
    await OrgMembership.collection.insertOne({
      user: u._id, orgUnit: subUnit._id, roleInUnit: 'member',
      businessRole: null, status: 'active', grantedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    const m = await OrgMembership.findOne({ user: u._id, orgUnit: subUnit._id }).lean();
    expect(m.businessRole).toBeNull();
  });

  test('APPLY-10: technical User → untouched', async () => {
    const u = await makeUser({ role: 'Admin', isTechnical: true });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await runApply({ argv: commitArgs(['--limit', '10']) });
    expect((await getMembership(u._id, tA)).businessRole).toBeNull();
  });
});

describe('APPLY — bounds & flags', () => {
  test('APPLY-11: --limit respected exactly', async () => {
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser({ role: 'Collaborateur' })));
    for (const u of users) await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const report = await runApply({ argv: commitArgs(['--limit', '2']) });
    expect(report.summary.APPLIED).toBe(2);
    expect(report.summary.SKIPPED_BY_LIMIT).toBe(3);
    const populated = await OrgMembership.countDocuments({ orgUnit: tA.rootOrgUnit, businessRole: { $ne: null } });
    expect(populated).toBe(2);
  });

  test('APPLY-12: tenant filter restricts writes', async () => {
    const fB = await createTenantFixture({ label: 'Tenant B' });
    const uA = await makeUser({ role: 'Collaborateur' });
    const uB = await makeUser({ role: 'Admin' });
    await addTenantMember({ tenant: tA, user: uA, bootstrap: bA });
    await addTenantMember({ tenant: fB.tenant, user: uB, bootstrap: fB.bootstrap });
    // Attach a founder application to B so B is a HIGH candidate too.
    const mB = await getMembership(uB._id, fB.tenant);
    await TenantApplication.collection.insertOne({
      applicant: uB._id, provisionedTenant: fB.tenant._id, provisionedMembership: mB._id,
      status: 'APPROVED', organizationName: 'B', revision: 1, history: [], createdAt: new Date(), updatedAt: new Date(),
    });
    await runApply({ argv: commitArgs(['--limit', '10', '--tenant', String(tA._id)]) });
    expect((await getMembership(uA._id, tA)).businessRole).toBe('Collaborateur');
    expect((await getMembership(uB._id, fB.tenant)).businessRole).toBeNull();
  });

  test('APPLY-13 / APPLY-CONN-10: CAS concurrent /api/members update → no overwrite', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    // Race the CAS: after applyMod computes the dry-run but BEFORE its
    // updateOne runs, another actor sets businessRole='Secretaire'. We stub
    // applyOneCandidate to inject the race.
    const orig = applyMod.applyOneCandidate;
    const spy = jest.spyOn(applyMod, 'applyOneCandidate').mockImplementation(async (input) => {
      await OrgMembership.updateOne(
        { _id: input.candidate.membershipId },
        { $set: { businessRole: 'Secretaire' } },
      );
      return orig(input);
    });
    try {
      const report = await runApply({ argv: commitArgs(['--limit', '5']) });
      expect(report.summary.CAS_SKIPPED).toBe(1);
      expect(report.summary.APPLIED).toBe(0);
    } finally { spy.mockRestore(); }
    const m = await getMembership(u._id, tA);
    expect(m.businessRole).toBe('Secretaire');
  });

  test('APPLY-14: run twice → second run performs zero membership write', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const before = await ActionLog.countDocuments({ action: ACTION_NAME });
    const report2 = await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await ActionLog.countDocuments({ action: ACTION_NAME });
    expect(report2.summary.APPLIED).toBe(0);
    expect(after).toBe(before);
  });

  test('APPLY-15: existing businessRole never overwritten (canonical wins)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await setMembership(u._id, tA, { businessRole: 'Admin' }); // canonical
    await runApply({ argv: commitArgs(['--limit', '5']) });
    expect((await getMembership(u._id, tA)).businessRole).toBe('Admin');
  });

  test('APPLY-16: proposedBusinessRole outside TENANT_BUSINESS_ROLES → refused (isEligibleCandidate false)', () => {
    expect(isEligibleCandidate({ action: 'UPDATE', classification: 'UPDATE_CANDIDATE', confidence: 'HIGH', currentBusinessRole: null, proposedBusinessRole: 'Client', membershipId: 'x', userId: 'y', tenantId: 'z' })).toBe(false);
  });

  test('APPLY-17: --commit without --live → refused', () => {
    expect(() => validateArgs(parseArgs(['--commit']))).toThrow(/MODE_REFUSED/);
  });

  test('APPLY-18: --live without --commit → zero writes (dry-run mode)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const report = await runApply({ argv: ['--live'] });
    expect(report.metadata.mode).toBe('dry-run');
    expect(report.summary.APPLIED).toBe(0);
    expect((await getMembership(u._id, tA)).businessRole).toBeNull();
  });

  test('APPLY-19 / APPLY-CONN-09: no write flags → zero writes and zero ActionLog', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const report = await runApply({ argv: [] });
    expect(report.summary.ATTEMPTED).toBe(0);
    expect(report.summary.APPLIED).toBe(0);
    expect(report.summary.ACTION_LOGS_CREATED).toBe(0);
    expect(await ActionLog.countDocuments({ action: ACTION_NAME })).toBe(0);
    expect((await getMembership(u._id, tA)).businessRole).toBeNull();
  });
});

describe('APPLY — invariants', () => {
  test('APPLY-20: no membership creation (count unchanged aside from targets)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const before = await OrgMembership.countDocuments({});
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await OrgMembership.countDocuments({});
    expect(after).toBe(before);
  });

  test('APPLY-21: ActionLog created for each successful write', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const logs = await ActionLog.find({ action: ACTION_NAME }).lean();
    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.typeAction).toBe('CHANGEMENT_RÔLE');
    expect(log.metadata.regularization.resourceType).toBe('OrgMembership');
    expect(log.metadata.regularization.before).toEqual({ businessRole: null });
    expect(log.metadata.regularization.after).toEqual({ businessRole: 'Collaborateur' });
    expect(log.metadata.regularization.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(log.metadata.regularization.operation).toBe('apply');
  });

  test('APPLY-22: no ActionLog for CAS-skipped rows', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const orig = applyMod.applyOneCandidate;
    const spy = jest.spyOn(applyMod, 'applyOneCandidate').mockImplementation(async (input) => {
      await OrgMembership.updateOne({ _id: input.candidate.membershipId }, { $set: { businessRole: 'Admin' } });
      return orig(input);
    });
    try {
      await runApply({ argv: commitArgs(['--limit', '5']) });
    } finally { spy.mockRestore(); }
    const logs = await ActionLog.countDocuments({ action: ACTION_NAME });
    expect(logs).toBe(0);
  });

  test('APPLY-23: dry-run hash deterministic', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const r1 = await runApply({ argv: [], generatedAt: 'fixed' });
    const r2 = await runApply({ argv: [], generatedAt: 'fixed' });
    expect(r1.metadata.dryRunHash).toBe(r2.metadata.dryRunHash);
  });

  test('APPLY-24: apply uses the 1H engine (candidate set matches dry-run output)', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const { runDryRun } = require('../scripts/backfillTenantMembershipsDryRun');
    const dry = await runDryRun();
    const hashDry = computeDryRunHash(dry);
    const applyReport = await runApply({ argv: [] });
    expect(applyReport.metadata.dryRunHash).toBe(hashDry);
  });

  test('APPLY-25/26: User.role and User.isActive unchanged for target', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const before = await User.findById(u._id).lean();
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await User.findById(u._id).lean();
    expect(after.role).toBe(before.role);
    expect(after.isActive).toBe(before.isActive);
    expect(after.status).toBe(before.status);
    expect((after.historiqueRoles || []).length).toBe((before.historiqueRoles || []).length);
  });

  test('APPLY-27: membership status unchanged for target', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const before = await getMembership(u._id, tA);
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await getMembership(u._id, tA);
    expect(after.status).toBe(before.status);
    expect(String(after.user)).toBe(String(before.user));
    expect(String(after.orgUnit)).toBe(String(before.orgUnit));
    expect(after.roleInUnit).toBe(before.roleInUnit);
  });

  test('APPLY-28: membership count unchanged after run', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const before = await OrgMembership.countDocuments({});
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await OrgMembership.countDocuments({});
    expect(after).toBe(before);
  });

  test('APPLY-29: only businessRole changes on the target membership', async () => {
    const u = await makeUser({ role: 'Collaborateur' });
    await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    const before = await getMembership(u._id, tA);
    await runApply({ argv: commitArgs(['--limit', '5']) });
    const after = await getMembership(u._id, tA);
    const diffFields = Object.keys(after).filter((k) => {
      if (k === 'businessRole') return false;
      if (k === 'updatedAt') return false;
      const a = JSON.stringify(after[k]);
      const b = JSON.stringify(before[k]);
      return a !== b;
    });
    expect(diffFields).toEqual([]);
    expect(after.businessRole).toBe('Collaborateur');
    expect(before.businessRole).toBeNull();
  });

  test('APPLY-30: write count never exceeds --limit even with many eligible', async () => {
    for (let i = 0; i < 8; i += 1) {
      const u = await makeUser({ role: 'Collaborateur' });
      await addTenantMember({ tenant: tA, user: u, bootstrap: bA });
    }
    const report = await runApply({ argv: commitArgs(['--limit', '3']) });
    expect(report.summary.APPLIED).toBeLessThanOrEqual(3);
    const populated = await OrgMembership.countDocuments({ orgUnit: tA.rootOrgUnit, businessRole: { $ne: null } });
    expect(populated).toBe(report.summary.APPLIED);
    expect(populated).toBeLessThanOrEqual(3);
  });
});

describe('APPLY · script-level flag refusals', () => {
  test('CLI: --commit without --live is refused (exit 1)', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/backfillTenantMembershipsApply.js');
    const res = spawnSync(process.execPath, [scriptPath, '--commit'], { env: { ...process.env, MONGO_URI: '' } });
    expect(res.status).not.toBe(0);
    expect(String(res.stderr)).toMatch(/MODE_REFUSED|MONGO_URI/);
  });
});
