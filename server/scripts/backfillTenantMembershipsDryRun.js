// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H — Dry-run scanner.
//
// STRICT READ-ONLY. This script MUST NEVER issue a MongoDB write. Every
// document read uses `.lean()` so we cannot accidentally .save() a returned
// model. The `runDryRun(...)` export is the pure function tested by
// `__tests__/backfillTenantMembershipsDryRun.mongo.integration.test.js` — it
// takes an already-connected mongoose instance so tests can point at a
// MongoMemoryReplSet without touching env.
//
// If the CLI receives ANY flag suggesting a write (`--commit`, `--apply`,
// `--write`, `--execute`) it refuses immediately with a clear error. Even
// then, the write pathway does NOT EXIST in this file — the guard is
// defensive, not the only safety.
//
// See USER-TENANT-MEMBERSHIP-ARCHITECTURE-1G — FINAL REPORT for the
// classification rules and confidence policy this scanner implements.

/* eslint-disable no-unused-vars */
const crypto = require('crypto');
const mongoose = require('mongoose');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const User = require('../models/User');
const TenantApplication = require('../models/TenantApplication');
const PlatformOperator = require('../models/PlatformOperator');
const { TENANT_BUSINESS_ROLES } = require('../constants/organizationConstants');

const VERSION = 'USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H';
const EXTERNAL_USER_ROLES = new Set(['Client', 'Proprietaire', 'Prestataire', 'User']);
const PREFLIGHT_DATABASE = 'altitudevision';

function describeReadOnlyTarget(uri) {
  if (typeof uri !== 'string' || !uri.trim()) {
    throw new Error('READONLY_URI_REQUIRED');
  }

  let parsed;
  try {
    parsed = new URL(uri.trim());
  } catch (_error) {
    throw new Error('READONLY_URI_INVALID');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('READONLY_URI_INVALID');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName || databaseName !== PREFLIGHT_DATABASE) {
    throw new Error('READONLY_DATABASE_REQUIRED');
  }

  return Object.freeze({
    scheme: parsed.protocol.slice(0, -1),
    databaseName,
    hostFingerprint: crypto.createHash('sha256').update(parsed.hostname.toLowerCase()).digest('hex'),
  });
}

function resolveReadOnlyConnection(env = process.env) {
  const uri = env.MONGO_URI_READONLY;
  const target = describeReadOnlyTarget(uri);
  return { uri: uri.trim(), target };
}

const CLASSIFICATIONS = Object.freeze({
  ALREADY_CANONICAL: 'ALREADY_CANONICAL',
  UPDATE_CANDIDATE: 'UPDATE_CANDIDATE',
  MULTI_TENANT_MANUAL_REVIEW: 'MULTI_TENANT_MANUAL_REVIEW',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  EXTERNAL_ROLE: 'EXTERNAL_ROLE',
  SKIP_SUSPENDED: 'SKIP_SUSPENDED',
  SKIP_REVOKED: 'SKIP_REVOKED',
  SKIP_NON_TENANT_ROOT: 'SKIP_NON_TENANT_ROOT',
  SKIP_TECHNICAL: 'SKIP_TECHNICAL',
  SKIP_INACTIVE_USER: 'SKIP_INACTIVE_USER',
  SKIP_TENANT_UNAVAILABLE: 'SKIP_TENANT_UNAVAILABLE',
  ORPHAN_MEMBERSHIP: 'ORPHAN_MEMBERSHIP',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  CONFLICT: 'CONFLICT',
});

const ACTIONS = Object.freeze({ UPDATE: 'UPDATE', SKIP: 'SKIP', MANUAL_REVIEW: 'MANUAL_REVIEW', CONFLICT: 'CONFLICT' });

const emptySummary = () => ({
  TOTAL_MEMBERSHIPS_SCANNED: 0,
  TENANT_ROOT_MEMBERSHIPS: 0,
  ALREADY_CANONICAL: 0,
  SAFE_UPDATE_CANDIDATES: 0,
  MULTI_TENANT_CANDIDATES: 0,
  MANUAL_REVIEW: 0,
  EXTERNAL_USERS_SKIPPED: 0,
  ORPHAN_MEMBERSHIPS: 0,
  SUSPENDED_SKIPPED: 0,
  REVOKED_SKIPPED: 0,
  NON_TENANT_ROOT_SKIPPED: 0,
  INACTIVE_USERS_SKIPPED: 0,
  TECHNICAL_USERS_SKIPPED: 0,
  TENANT_UNAVAILABLE_SKIPPED: 0,
  TENANT_NOT_FOUND: 0,
  CONFLICTS: 0,
  WOULD_UPDATE: 0,
  WOULD_SKIP: 0,
  WOULD_REQUIRE_MANUAL_REVIEW: 0,
});

const idStr = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

// Pure decision function. Given the fully-loaded context, returns one candidate
// row. Extracted so tests can exercise every branch without a DB round-trip.
function classify({ membership, tenant, user, foundingApplication, isPlatformOperator, userTenantRootMembershipCount }) {
  const base = {
    membershipId: String(membership._id),
    userId: membership.user ? String(membership.user) : null,
    tenantId: tenant ? String(tenant._id) : null,
    currentBusinessRole: membership.businessRole || null,
    proposedBusinessRole: null,
    userRole: user?.role || null,
    source: null,
    confidence: null,
    classification: null,
    action: null,
    reason: '',
    platformOperator: Boolean(isPlatformOperator),
  };

  // Ordering is intentional and documented — never re-order without updating
  // the corresponding BACK-* test.

  if (membership.status === 'suspended') {
    return { ...base, classification: CLASSIFICATIONS.SKIP_SUSPENDED, action: ACTIONS.SKIP, reason: 'Membership status is suspended.' };
  }
  if (membership.status === 'revoked') {
    return { ...base, classification: CLASSIFICATIONS.SKIP_REVOKED, action: ACTIONS.SKIP, reason: 'Membership status is revoked.' };
  }
  if (!tenant) {
    return { ...base, classification: CLASSIFICATIONS.SKIP_NON_TENANT_ROOT, action: ACTIONS.SKIP, reason: 'OrgUnit is not the rootOrgUnit of any PlatformTenant.' };
  }
  if (tenant.status === 'archived' || tenant.status === 'suspended') {
    return { ...base, classification: CLASSIFICATIONS.SKIP_TENANT_UNAVAILABLE, action: ACTIONS.SKIP, reason: `Tenant status=${tenant.status}.` };
  }
  if (!user) {
    return { ...base, classification: CLASSIFICATIONS.ORPHAN_MEMBERSHIP, action: ACTIONS.SKIP, reason: 'Membership references a User that no longer exists.' };
  }
  if (user.isTechnical) {
    return { ...base, classification: CLASSIFICATIONS.SKIP_TECHNICAL, action: ACTIONS.SKIP, reason: 'User.isTechnical=true (GL-ARCH-1.1 auto-provisioned technical account).' };
  }
  if (user.isActive === false) {
    return { ...base, classification: CLASSIFICATIONS.SKIP_INACTIVE_USER, action: ACTIONS.SKIP, reason: 'User.isActive=false.' };
  }

  if (membership.businessRole) {
    // Already canonical — never overwrite. Add a diagnostic if User.role
    // disagrees, but action stays SKIP and proposedBusinessRole stays null.
    const diagnostic = user.role && user.role !== membership.businessRole
      ? ` Diagnostic: User.role='${user.role}' differs from canonical businessRole='${membership.businessRole}'; canonical wins.`
      : '';
    return {
      ...base,
      classification: CLASSIFICATIONS.ALREADY_CANONICAL,
      action: ACTIONS.SKIP,
      reason: `Membership already carries canonical businessRole='${membership.businessRole}'.${diagnostic}`,
    };
  }

  // Founder signal: TenantApplication.applicant + provisionedMembership.
  const founderMatch = foundingApplication
    && String(foundingApplication.provisionedMembership) === String(membership._id)
    && String(foundingApplication.applicant) === String(user._id)
    && String(foundingApplication.provisionedTenant) === String(tenant._id);

  if (founderMatch) {
    return {
      ...base,
      proposedBusinessRole: 'Admin',
      source: 'tenant_application_founder',
      confidence: 'HIGH',
      classification: CLASSIFICATIONS.UPDATE_CANDIDATE,
      action: ACTIONS.UPDATE,
      reason: `Founder membership provisioned by TenantApplication ${foundingApplication._id}.`,
    };
  }

  // External roles must never be silently promoted.
  if (EXTERNAL_USER_ROLES.has(user.role)) {
    return {
      ...base,
      classification: CLASSIFICATIONS.EXTERNAL_ROLE,
      action: ACTIONS.SKIP,
      reason: `User.role='${user.role}' is external (Client/Proprietaire/Prestataire/User); not a tenant businessRole.`,
    };
  }

  // Multi-tenant guard: the user has more than one active tenant-root
  // membership. User.role cannot resolve tenant-specific ambiguity.
  if (userTenantRootMembershipCount > 1) {
    return {
      ...base,
      classification: CLASSIFICATIONS.MULTI_TENANT_MANUAL_REVIEW,
      action: ACTIONS.MANUAL_REVIEW,
      reason: `User has ${userTenantRootMembershipCount} active tenant-root memberships; User.role cannot disambiguate.`,
    };
  }

  // Single-tenant legacy mapping: User.role ∈ TENANT_BUSINESS_ROLES.
  if (TENANT_BUSINESS_ROLES.includes(user.role)) {
    return {
      ...base,
      proposedBusinessRole: user.role,
      source: 'legacy_user_role_single_tenant',
      confidence: 'HIGH',
      classification: CLASSIFICATIONS.UPDATE_CANDIDATE,
      action: ACTIONS.UPDATE,
      reason: `User has a single active tenant-root membership and User.role='${user.role}' maps directly to a canonical businessRole.`,
    };
  }

  // Anything else: needs a human.
  return {
    ...base,
    classification: CLASSIFICATIONS.MANUAL_REVIEW,
    action: ACTIONS.MANUAL_REVIEW,
    reason: `Cannot infer businessRole (User.role='${user.role || 'null'}' not in TENANT_BUSINESS_ROLES and no other high-confidence signal).`,
  };
}

async function runDryRun({ generatedAt } = {}) {
  const summary = emptySummary();
  const candidates = [];

  // Deterministic order.
  const memberships = await OrgMembership.find({}).sort({ _id: 1 }).lean();
  summary.TOTAL_MEMBERSHIPS_SCANNED = memberships.length;

  if (memberships.length === 0) {
    return finalize({ summary, candidates, generatedAt });
  }

  // Bulk-load tenants keyed by rootOrgUnit and by _id, users, operators,
  // applications — one query each, no N+1.
  const orgUnitIds = [...new Set(memberships.map((m) => String(m.orgUnit)))];
  const userIds = [...new Set(memberships.map((m) => String(m.user)).filter(Boolean))];

  const tenants = await PlatformTenant.find({ rootOrgUnit: { $in: orgUnitIds } }).lean();
  const tenantByRoot = new Map(tenants.map((t) => [String(t.rootOrgUnit), t]));

  const users = await User.find({ _id: { $in: userIds } }).select('_id name email role isActive isTechnical').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const operators = await PlatformOperator.find({ user: { $in: userIds }, status: 'active' }).select('_id user').lean();
  const platformOperatorUserIds = new Set(operators.map((op) => String(op.user)));

  const memMembershipIds = memberships.map((m) => m._id);
  const applications = await TenantApplication.find({ provisionedMembership: { $in: memMembershipIds } })
    .select('_id applicant provisionedTenant provisionedMembership').lean();
  const applicationByMembership = new Map(applications.map((a) => [String(a.provisionedMembership), a]));

  // Count active tenant-root memberships per user (to detect multi-tenant).
  const activeRootCountByUser = new Map();
  memberships.forEach((m) => {
    if (m.status !== 'active') return;
    if (!tenantByRoot.has(String(m.orgUnit))) return;
    const key = String(m.user);
    activeRootCountByUser.set(key, (activeRootCountByUser.get(key) || 0) + 1);
  });

  // Classify.
  for (const membership of memberships) {
    const tenant = tenantByRoot.get(String(membership.orgUnit)) || null;
    if (tenant) summary.TENANT_ROOT_MEMBERSHIPS += 1;
    const user = userById.get(String(membership.user)) || null;
    const foundingApplication = applicationByMembership.get(String(membership._id)) || null;
    const isPlatformOperator = user ? platformOperatorUserIds.has(String(user._id)) : false;
    const userTenantRootMembershipCount = user ? (activeRootCountByUser.get(String(user._id)) || 0) : 0;

    const candidate = classify({ membership, tenant, user, foundingApplication, isPlatformOperator, userTenantRootMembershipCount });
    candidates.push(candidate);

    switch (candidate.classification) {
      case CLASSIFICATIONS.ALREADY_CANONICAL: summary.ALREADY_CANONICAL += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.UPDATE_CANDIDATE: summary.SAFE_UPDATE_CANDIDATES += 1; summary.WOULD_UPDATE += 1; break;
      case CLASSIFICATIONS.MULTI_TENANT_MANUAL_REVIEW:
        summary.MULTI_TENANT_CANDIDATES += 1; summary.WOULD_REQUIRE_MANUAL_REVIEW += 1; break;
      case CLASSIFICATIONS.MANUAL_REVIEW: summary.MANUAL_REVIEW += 1; summary.WOULD_REQUIRE_MANUAL_REVIEW += 1; break;
      case CLASSIFICATIONS.EXTERNAL_ROLE: summary.EXTERNAL_USERS_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_SUSPENDED: summary.SUSPENDED_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_REVOKED: summary.REVOKED_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_NON_TENANT_ROOT: summary.NON_TENANT_ROOT_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_TECHNICAL: summary.TECHNICAL_USERS_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_INACTIVE_USER: summary.INACTIVE_USERS_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.SKIP_TENANT_UNAVAILABLE: summary.TENANT_UNAVAILABLE_SKIPPED += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.ORPHAN_MEMBERSHIP: summary.ORPHAN_MEMBERSHIPS += 1; summary.WOULD_SKIP += 1; break;
      case CLASSIFICATIONS.CONFLICT: summary.CONFLICTS += 1; break;
      default: break;
    }
  }

  return finalize({ summary, candidates, generatedAt });
}

function finalize({ summary, candidates, generatedAt }) {
  candidates.sort((a, b) => (a.membershipId < b.membershipId ? -1 : a.membershipId > b.membershipId ? 1 : 0));
  return {
    metadata: {
      mode: 'dry-run',
      writeEnabled: false,
      generatedAt: generatedAt || new Date().toISOString(),
      version: VERSION,
    },
    summary,
    candidates,
  };
}

// ─── CLI entry point ───────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const forbidden = args.find((a) => /^--(commit|apply|write|execute)\b/.test(a));
  if (forbidden) {
    console.error('WRITE MODE IS NOT AVAILABLE IN PHASE 1H — dry-run only.');
    process.exit(2);
  }
  const { uri, target } = resolveReadOnlyConnection();
  console.log(`[1H dry-run] connection variable: MONGO_URI_READONLY`);
  console.log(`[1H dry-run] target: scheme=${target.scheme} database=${target.databaseName} hostFingerprint=${target.hostFingerprint}`);
  await mongoose.connect(uri);
  try {
    const report = await runDryRun();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = {
  runDryRun,
  classify,
  describeReadOnlyTarget,
  resolveReadOnlyConnection,
  CLASSIFICATIONS,
  ACTIONS,
  VERSION,
  EXTERNAL_USER_ROLES,
  PREFLIGHT_DATABASE,
};

if (require.main === module) {
  main().catch((err) => {
    const safeValidationCodes = new Set([
      'READONLY_URI_REQUIRED',
      'READONLY_URI_INVALID',
      'READONLY_DATABASE_REQUIRED',
    ]);
    console.error(safeValidationCodes.has(err?.message) ? err.message : 'PREFLIGHT_CONNECTION_FAILED');
    process.exit(1);
  });
}
