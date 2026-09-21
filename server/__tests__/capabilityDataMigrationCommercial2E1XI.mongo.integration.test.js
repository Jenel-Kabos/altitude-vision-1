// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X — CAPABILITY-DATA-MIGRATION —
// CLI targeted grant of `platform.commercial.manage`. Tests unitaires
// contre le primitive `planCommercialManageGrant`/`applyGrant` exposé
// par le script CLI, sans jamais spawn de child_process — les fixtures
// s'exécutent en isolation contre MongoMemoryReplSet.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const Property = require('../models/Property');
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
    name: `CAP-MIG ${seq}`, email: `cap-mig-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true, ...over,
  });
};

async function makeOperator({ userRole = 'Admin', status = 'active', capabilities = ['platform.finance.manage'] } = {}) {
  const user = await makeUser({ role: userRole });
  const granter = await makeUser({ role: 'Admin' });
  await grantOperator({ userId: user._id, actor: granter, reason: 'CAP-MIG fixture', capabilities });
  if (status !== 'active') {
    await PlatformOperator.updateOne({ user: user._id }, { $set: { status } });
  }
  const op = await PlatformOperator.findOne({ user: user._id });
  return { user, granter, op };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

// ═══════════════════════════════════════════════════════════════════════════
// CAP-MIG — CLI safety
// ═══════════════════════════════════════════════════════════════════════════

describe('CAP-MIG — safety and preconditions', () => {
  test('CAP-MIG-03 (unknown capability rejected at planning)', async () => {
    const { op } = await makeOperator();
    await expect(planCommercialManageGrant({ operator: op, expectedCapability: 'platform.nonexistent.manage' }))
      .rejects.toMatchObject({ code: 'UNKNOWN_CAPABILITY' });
  });

  test('CAP-MIG-05/06 (inactive/suspended operator blocked without mutation)', async () => {
    for (const status of ['suspended', 'revoked']) {
      const { op } = await makeOperator({ status });
      const plan = await planCommercialManageGrant({ operator: op });
      expect(plan.wouldChange).toBe(false);
      expect(plan.blockingReason).toMatch(/OPERATOR_STATUS_/);
      expect(plan.before).toEqual(plan.after);
    }
  });

  test('CAP-MIG-07 (non-Admin associated User → no grant, TARGET_GLOBAL_ADMIN_PREREQUISITE_MISSING)', async () => {
    // NB: grantOperator crée l'operator, mais la garde `isTechnical:{$ne:true}` ne
    // regarde pas User.role. On peut donc avoir un PlatformOperator sur un User
    // non-Admin après un downgrade. Le script doit refuser ce cas.
    const { user, op } = await makeOperator();
    await User.updateOne({ _id: user._id }, { $set: { role: 'Proprietaire' } });
    const opFresh = await PlatformOperator.findById(op._id);
    const plan = await planCommercialManageGrant({ operator: opFresh });
    expect(plan.wouldChange).toBe(false);
    expect(plan.blockingReason).toBe('TARGET_GLOBAL_ADMIN_PREREQUISITE_MISSING');
    expect(plan.before).toEqual(plan.after);
  });

  test('CAP-MIG-08 (missing associated User → ASSOCIATED_USER_MISSING)', async () => {
    const { user, op } = await makeOperator();
    await User.deleteOne({ _id: user._id });
    const opFresh = await PlatformOperator.findById(op._id);
    const plan = await planCommercialManageGrant({ operator: opFresh });
    expect(plan.wouldChange).toBe(false);
    expect(plan.blockingReason).toBe('ASSOCIATED_USER_MISSING');
  });

  test('CAP-MIG-09 (unknown capability cannot be injected via applyGrant)', async () => {
    const { op } = await makeOperator();
    await expect(applyGrant({ operator: op, actor: { _id: op.user }, reason: 't', expectedCapability: 'platform.hostile.manage' }))
      .rejects.toBeDefined();
    const fresh = await PlatformOperator.findById(op._id);
    expect(fresh.capabilities).not.toContain('platform.hostile.manage');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAP-MIG — grant + idempotency
// ═══════════════════════════════════════════════════════════════════════════

describe('CAP-MIG — grant behavior', () => {
  test('CAP-MIG-11/12/13 (active Admin operator → apply grants exactly once, preserves prior capabilities)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.finance.read', 'platform.finance.manage'] });
    const plan = await planCommercialManageGrant({ operator: op });
    expect(plan.wouldChange).toBe(true);
    expect(plan.blockingReason).toBeNull();
    expect(plan.before).toEqual(['platform.finance.read', 'platform.finance.manage']);
    expect(plan.after).toEqual(['platform.finance.read', 'platform.finance.manage', TARGET_CAPABILITY]);

    const updated = await applyGrant({ operator: op, actor: { _id: user._id }, reason: 'test grant' });
    expect(updated.capabilities).toContain(TARGET_CAPABILITY);
    expect(updated.capabilities).toContain('platform.finance.read');
    expect(updated.capabilities).toContain('platform.finance.manage');
    // exactly once
    const count = updated.capabilities.filter((c) => c === TARGET_CAPABILITY).length;
    expect(count).toBe(1);
  });

  test('CAP-MIG-14 (second apply is idempotent — $addToSet)', async () => {
    const { user, op } = await makeOperator();
    await applyGrant({ operator: op, actor: { _id: user._id }, reason: 't1' });
    const before = await PlatformOperator.findById(op._id);
    await applyGrant({ operator: before, actor: { _id: user._id }, reason: 't2' });
    const after = await PlatformOperator.findById(op._id);
    const count = after.capabilities.filter((c) => c === TARGET_CAPABILITY).length;
    expect(count).toBe(1);
  });

  test('CAP-MIG-15 (already-granted → dry-run reports NO_CHANGE_ALREADY_GRANTED)', async () => {
    const { op } = await makeOperator({ capabilities: [TARGET_CAPABILITY] });
    const plan = await planCommercialManageGrant({ operator: op });
    expect(plan.wouldChange).toBe(false);
    expect(plan.blockingReason).toBe('NO_CHANGE_ALREADY_GRANTED');
    expect(plan.before).toEqual([TARGET_CAPABILITY]);
    expect(plan.after).toEqual([TARGET_CAPABILITY]);
  });

  test('CAP-MIG-16 (finance.manage is NOT required to receive commercial.manage)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.reporting.read'] });
    const updated = await applyGrant({ operator: op, actor: { _id: user._id }, reason: 't' });
    expect(updated.capabilities).toContain(TARGET_CAPABILITY);
    expect(updated.capabilities).not.toContain('platform.finance.manage');
  });

  test('CAP-MIG-17 (commercial.manage grant does NOT grant finance.manage)', async () => {
    const { user, op } = await makeOperator({ capabilities: ['platform.reporting.read'] });
    const updated = await applyGrant({ operator: op, actor: { _id: user._id }, reason: 't' });
    expect(updated.capabilities).not.toContain('platform.finance.manage');
    expect(updated.capabilities).not.toContain('platform.finance.read');
  });

  test('CAP-MIG-18 (tenant Admin membership does not affect eligibility)', async () => {
    const { user, op } = await makeOperator();
    // Donne au user une membership tenant Admin — doit être IGNORÉ.
    const fixture = await createTenantFixture({ label: `CAP-MIG tenant ${seq++}`, withAdminMembership: true });
    await addTenantMember({ tenant: fixture.tenant, user, bootstrap: fixture.bootstrap, businessRole: 'Admin' });
    const plan = await planCommercialManageGrant({ operator: op });
    expect(plan.wouldChange).toBe(true);
    // La membership tenant n'a AUCUN effet — le plan est identique à un
    // opérateur sans tenant.
    expect(plan.blockingReason).toBeNull();
  });

  test('CAP-MIG-19 (Property ownership does not affect eligibility)', async () => {
    const { user, op } = await makeOperator();
    // Le user possède une Property — doit être IGNORÉ.
    await Property.create({
      title: `CAP-MIG Property ${seq++}`, description: 'Description assez longue pour la validation Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', price: 100000,
      address: { city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90, statusAdmin: 'Validée', isPublished: true,
      availability: 'Disponible', owner: user._id, tenant: null,
    });
    const plan = await planCommercialManageGrant({ operator: op });
    // Property ownership n'a AUCUN effet — le plan reste identique.
    expect(plan.wouldChange).toBe(true);
    expect(plan.blockingReason).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Capability independence regression (CAP-MIG-17 complémentaire)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAP-MIG — capability independence', () => {
  test('grant of platform.commercial.manage does not add platform.finance.manage', async () => {
    const { user, op } = await makeOperator({ capabilities: [] });
    const updated = await applyGrant({ operator: op, actor: { _id: user._id }, reason: 't' });
    expect(updated.capabilities).toEqual([TARGET_CAPABILITY]);
  });

  test('operator with finance.manage cannot silently satisfy commercial.manage via CLI (no fallback path)', async () => {
    // Pure semantic check : l'opérateur avec finance.manage seul, avant
    // grant, ne possède PAS commercial.manage. Le CLI n'introduit aucun
    // fallback implicite ; il exige un $addToSet explicite.
    const { op } = await makeOperator({ capabilities: ['platform.finance.manage'] });
    expect(op.capabilities.includes(TARGET_CAPABILITY)).toBe(false);
    const plan = await planCommercialManageGrant({ operator: op });
    expect(plan.wouldChange).toBe(true); // sans grant explicite, il ne l'a pas.
  });
});
