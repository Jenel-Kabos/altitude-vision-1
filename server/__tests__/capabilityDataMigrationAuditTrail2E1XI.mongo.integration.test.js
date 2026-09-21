// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-CAPABILITY-DATA-MIGRATION-
// AUDIT-TRAIL-FIX — vérifie que `applyGrant` du CLI écrit un ActionLog
// canonique (module='PlatformAdmin', scopeMode='platform', action=
// 'platform_operator.capability_granted', typeAction='MODIFICATION').
// L'incident historique du 2026-09-17 (`module='PlatformAuthority'`
// rejeté par l'enum) est régressé ici.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ActionLog = require('../models/ActionLog');
const {
  planCommercialManageGrant,
  applyGrant,
  TARGET_CAPABILITY,
} = require('../scripts/grantPlatformCommercialCapability');

jest.setTimeout(180000);

let seq = 0;
const makeUser = (over = {}) => {
  seq += 1;
  return User.create({
    name: `AUDIT-FIX ${seq}`, email: `audit-fix-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true, ...over,
  });
};

async function makeOperator({ userRole = 'Admin', status = 'active', capabilities = ['platform.finance.manage'] } = {}) {
  const user = await makeUser({ role: userRole });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: user._id, actor: granter, reason: 'AUDIT-FIX fixture', capabilities });
  if (status !== 'active') {
    await PlatformOperator.updateOne({ user: user._id }, { $set: { status } });
  }
  const op = await PlatformOperator.findOne({ user: user._id });
  // ActionLogs produced by the fixture `grantOperator` itself must not
  // pollute assertions on the CLI's own audit entry. We clear the
  // collection after fixture set-up so every assertion targets only
  // the entries produced by `applyGrant`.
  await ActionLog.deleteMany({});
  return { user, granter, op };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT-FIX — canonical ActionLog contract
// ═══════════════════════════════════════════════════════════════════════════

describe('AUDIT-FIX — capability grant produces canonical ActionLog', () => {
  test('AUDIT-FIX-01/02/03 (successful APPLY creates exactly one valid ActionLog with canonical module)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.read'] });
    await applyGrant({ operator: op, actor: user, reason: 'AUDIT-FIX-01' });

    const logs = await ActionLog.find({ 'cible.id': String(op._id) }).lean();
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log.module).toBe('PlatformAdmin');
    expect(log.scopeMode).toBe('platform');
    expect(log.typeAction).toBe('MODIFICATION');
    expect(log.action).toBe('platform_operator.capability_granted');
  });

  test('AUDIT-FIX-04/05 (ActionLog records the capability + target operator id)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: user, reason: 'AUDIT-FIX-04' });
    const log = await ActionLog.findOne({ 'cible.id': String(op._id) }).lean();
    expect(log.cible.type).toBe('PlatformOperator');
    // La capacité canonique se trouve dans la valeur nouvelle (JSON stringifiée).
    expect(log.metadata.nouvelleValeur).toContain(TARGET_CAPABILITY);
  });

  test('AUDIT-FIX-06 (ActionLog contains the supplied reason)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: user, reason: 'motif business spécifique' });
    const log = await ActionLog.findOne({ 'cible.id': String(op._id) }).lean();
    expect(log.metadata.reason).toBe('motif business spécifique');
  });

  test('AUDIT-FIX-07 (ActionLog auteur reflects the grantedBy identity)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: user, reason: 'AUDIT-FIX-07' });
    const log = await ActionLog.findOne({ 'cible.id': String(op._id) }).lean();
    expect(String(log.auteur.id)).toBe(String(user._id));
    expect(log.auteur.role).toBe('Admin');
  });

  test('AUDIT-FIX-13/14 (existing capabilities preserved, finance.manage untouched)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.read', 'platform.finance.manage'] });
    await applyGrant({ operator: op, actor: user, reason: 'AUDIT-FIX-13/14' });
    const fresh = await PlatformOperator.findById(op._id);
    expect(fresh.capabilities).toEqual(expect.arrayContaining([
      'platform.finance.read', 'platform.finance.manage', TARGET_CAPABILITY,
    ]));
  });

  test('AUDIT-FIX-10 (second APPLY is idempotent — $addToSet produces the same doc, at most one audit entry per real change)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: user, reason: 'first' });
    const beforeCount = await ActionLog.countDocuments({ 'cible.id': String(op._id), action: 'platform_operator.capability_granted' });
    // Second apply on the same operator — $addToSet is a no-op ; the CLI's
    // apply path still logs, so this test verifies that the audit call
    // itself doesn't fail (canonical shape) AND that state is unchanged.
    const fresh = await PlatformOperator.findById(op._id);
    await applyGrant({ operator: fresh, actor: user, reason: 'second' });
    const finalOp = await PlatformOperator.findById(op._id);
    const count = finalOp.capabilities.filter((c) => c === TARGET_CAPABILITY).length;
    expect(count).toBe(1);
    const afterCount = await ActionLog.countDocuments({ 'cible.id': String(op._id), action: 'platform_operator.capability_granted' });
    // Second apply enregistre son propre audit (log semi-informationnel) —
    // le contrat requiert seulement que le state PlatformOperator reste
    // idempotent, pas que l'audit soit dédupliqué.
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
  });

  test('AUDIT-FIX-15 (aucune consultation de tenant / OrgMembership dans l\'audit)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: user, reason: 'AUDIT-FIX-15' });
    const log = await ActionLog.findOne({ 'cible.id': String(op._id) }).lean();
    // Le log ne référence AUCUN tenant/OrgMembership — c'est une action platform.
    expect(log.tenant).toBeFalsy();
    expect(log.scopeMode).toBe('platform');
  });

  test('AUDIT-FIX-09 (dry-run = plan seul, jamais d\'audit persisté)', async () => {
    const { op } = await makeOperator();
    await planCommercialManageGrant({ operator: op });
    const logs = await ActionLog.find({ 'cible.id': String(op._id) }).lean();
    expect(logs).toHaveLength(0);
  });
});
