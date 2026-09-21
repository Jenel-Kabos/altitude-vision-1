// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X
// CAPABILITY-DATA-MIGRATION-AUDIT-TRAIL-REMEDIATION — targeted historical
// ActionLog backfill. Certifie que le script écrit UN ActionLog canonique
// et NE modifie JAMAIS le PlatformOperator/User/OrgMembership.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const {
  planRemediation, applyRemediation, TARGET_CAPABILITY, AUDIT_MODULE,
  AUDIT_SCOPE_MODE, AUDIT_ACTION, AUDIT_TYPE_ACTION, REMEDIATION_MARKER,
} = require('../scripts/backfillActionLogCommercialCapabilityGrant');

jest.setTimeout(180000);

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `REMED ${seq}`, email: `remed-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true, ...over,
  });
};

async function makeOperator({ userRole = 'Admin', status = 'active', capabilities = [TARGET_CAPABILITY] } = {}) {
  const user = await makeUser({ role: userRole });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: user._id, actor: granter, reason: 'REMED fixture', capabilities });
  if (status !== 'active') {
    await PlatformOperator.updateOne({ user: user._id }, { $set: { status } });
  }
  const op = await PlatformOperator.findOne({ user: user._id });
  await ActionLog.deleteMany({});
  return { user, op };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// REMED — historical remediation
// ═══════════════════════════════════════════════════════════════════════════

describe('REMED — historical ActionLog remediation (insert-only, no operator mutation)', () => {
  test('REMED-01 (dry-run = zero writes, planned doc returned)', async () => {
    const { user, op } = await makeOperator();
    const plan = await planRemediation({ operatorId: op._id, userId: user._id, grantedBy: 'admin@example.test', reason: 't', historicalDate: '2026-09-17' });
    expect(plan.wouldInsert).toBe(true);
    expect(plan.blockingReason).toBeNull();
    // Aucun write pendant plan.
    expect(await ActionLog.countDocuments({})).toBe(0);
    const opFresh = await PlatformOperator.findById(op._id);
    expect(opFresh.capabilities).toEqual(op.capabilities);
  });

  test('REMED-02/13 (plan verifies capability already present and records it)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.manage', TARGET_CAPABILITY] });
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    expect(plan.wouldInsert).toBe(true);
    expect(plan.plannedDoc.metadata.nouvelleValeur).toContain(TARGET_CAPABILITY);
    expect(plan.plannedDoc.metadata.nouvelleValeur).toContain('platform.finance.manage');
    expect(plan.plannedDoc.metadata.ancienneValeur).toContain('platform.finance.manage');
    // Le "before" simulé ne doit PAS contenir TARGET_CAPABILITY (état pré-grant historique).
    expect(plan.plannedDoc.metadata.ancienneValeur).not.toContain(TARGET_CAPABILITY);
  });

  test('REMED-03 (capability absent → fail closed, no ActionLog)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.manage'] });
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    expect(plan.wouldInsert).toBe(false);
    expect(plan.blockingReason).toBe('CAPABILITY_NOT_PRESENT_REMEDIATION_FORBIDDEN');
  });

  test('REMED-04 (unknown operator → fail closed)', async () => {
    const other = await makeUser();
    const plan = await planRemediation({ operatorId: other._id, userId: other._id });
    expect(plan.wouldInsert).toBe(false);
    expect(plan.blockingReason).toBe('TARGET_OPERATOR_NOT_FOUND');
  });

  test('REMED-05 (User mismatch → fail closed)', async () => {
    const { op } = await makeOperator();
    const stranger = await makeUser();
    const plan = await planRemediation({ operatorId: op._id, userId: stranger._id });
    expect(plan.wouldInsert).toBe(false);
    expect(plan.blockingReason).toBe('TARGET_USER_MISMATCH');
  });

  test('REMED-06 (inactive/suspended/revoked → fail closed)', async () => {
    for (const status of ['suspended', 'revoked']) {
      const { user, op } = await makeOperator({ status });
      const plan = await planRemediation({ operatorId: op._id, userId: user._id });
      expect(plan.wouldInsert).toBe(false);
      expect(plan.blockingReason).toMatch(/TARGET_OPERATOR_STATUS_/);
    }
  });

  test('REMED-07 (non-Admin User → fail closed)', async () => {
    const { user, op } = await makeOperator();
    await User.updateOne({ _id: user._id }, { $set: { role: 'Proprietaire' } });
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    expect(plan.wouldInsert).toBe(false);
    expect(plan.blockingReason).toBe('TARGET_GLOBAL_ADMIN_PREREQUISITE_MISSING');
  });

  test('REMED-08/09/10/11/12/14 (APPLY inserts exactly one canonical ActionLog with historical marker)', async () => {
    const { user, op } = await makeOperator();
    const plan = await planRemediation({ operatorId: op._id, userId: user._id, grantedBy: 'altitudevis3n@example.test', reason: 'Historical remediation', historicalDate: '2026-09-17' });
    const res = await applyRemediation(plan);
    expect(res.inserted).toBe(true);
    const logs = await ActionLog.find({ 'cible.id': String(op._id) }).lean();
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log.module).toBe(AUDIT_MODULE); // PlatformAdmin
    expect(log.scopeMode).toBe(AUDIT_SCOPE_MODE); // platform
    expect(log.action).toBe(AUDIT_ACTION);
    expect(log.typeAction).toBe(AUDIT_TYPE_ACTION);
    expect(log.cible.type).toBe('PlatformOperator');
    expect(String(log.cible.id)).toBe(String(op._id));
    expect(log.description).toContain(REMEDIATION_MARKER);
    expect(log.description).toContain('NO NEW CAPABILITY GRANT');
    expect(log.metadata.reason).toContain(REMEDIATION_MARKER);
    expect(log.metadata.reason).toContain('historical=2026-09-17');
  });

  test('REMED-15 (log does not falsely represent a second capability mutation)', async () => {
    const { user, op } = await makeOperator();
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    await applyRemediation(plan);
    const log = await ActionLog.findOne({ 'cible.id': String(op._id) }).lean();
    // The description explicitly says "NO NEW CAPABILITY GRANT".
    expect(log.description).toMatch(/NO NEW CAPABILITY GRANT/i);
    // No capabilities were touched.
    const opFresh = await PlatformOperator.findById(op._id).lean();
    expect(opFresh.capabilities).toEqual(op.capabilities);
  });

  test('REMED-16/17 (idempotency: second APPLY finds equivalent log and inserts nothing new)', async () => {
    const { user, op } = await makeOperator();
    const plan1 = await planRemediation({ operatorId: op._id, userId: user._id });
    await applyRemediation(plan1);
    const plan2 = await planRemediation({ operatorId: op._id, userId: user._id });
    expect(plan2.wouldInsert).toBe(false);
    expect(plan2.blockingReason).toBe('NO_CHANGE_AUDIT_ALREADY_PRESENT');
    const res2 = await applyRemediation(plan2);
    expect(res2.inserted).toBe(false);
    expect(await ActionLog.countDocuments({ 'cible.id': String(op._id) })).toBe(1);
  });

  test('REMED-18 (PlatformOperator capabilities are byte-identical before/after remediation)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.read', 'platform.finance.manage', TARGET_CAPABILITY] });
    const before = op.capabilities.slice().sort();
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    await applyRemediation(plan);
    const opFresh = await PlatformOperator.findById(op._id).lean();
    expect(opFresh.capabilities.slice().sort()).toEqual(before);
  });

  test('REMED-19 (User document remains unchanged)', async () => {
    const { user, op } = await makeOperator();
    const beforeUser = await User.findById(user._id).lean();
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    await applyRemediation(plan);
    const afterUser = await User.findById(user._id).lean();
    expect(afterUser).toEqual(beforeUser);
  });

  test('REMED-21 (finance.manage neither required nor modified)', async () => {
    const { user, op } = await makeOperator({ capabilities: [TARGET_CAPABILITY] }); // pas de finance.manage
    const plan = await planRemediation({ operatorId: op._id, userId: user._id });
    expect(plan.wouldInsert).toBe(true);
    await applyRemediation(plan);
    const opFresh = await PlatformOperator.findById(op._id).lean();
    expect(opFresh.capabilities).toEqual([TARGET_CAPABILITY]);
  });
});
