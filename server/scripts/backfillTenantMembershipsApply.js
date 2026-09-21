// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H.1 — Controlled apply.
//
// Consumes the 1H dry-run engine as its single source of truth for
// classification. Applies UPDATES only for candidates that survive the strict
// eligibility filter (action=UPDATE, classification=UPDATE_CANDIDATE,
// confidence=HIGH, currentBusinessRole=null, proposedBusinessRole ∈
// TENANT_BUSINESS_ROLES, membership.status=active).
//
// Every write is a CAS updateOne guarded on (_id, businessRole:null,
// status:'active'). No `bulkWrite`, no `updateMany`, no `create` on
// OrgMembership, no User mutation, no route surface. Every successful write
// emits one ActionLog entry inside the same session.withTransaction (best-
// effort atomicity — Mongoose replica-set only). --live AND --commit are
// both required to write; either alone (or neither) yields zero writes.
//
// This module exports pure functions so the test harness in
// `__tests__/backfillTenantMembershipsApply.mongo.integration.test.js` can
// exercise every branch without spawning a subprocess.

/* eslint-disable no-unused-vars */
const crypto = require('crypto');
const mongoose = require('mongoose');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');
const { TENANT_BUSINESS_ROLES } = require('../constants/organizationConstants');
const {
  runDryRun,
  resolveReadOnlyConnection,
  CLASSIFICATIONS,
  ACTIONS,
  VERSION: DRY_RUN_VERSION,
} = require('./backfillTenantMembershipsDryRun');

const VERSION = 'USER-TENANT-MEMBERSHIP-ARCHITECTURE-1H.1';
const DEFAULT_LIMIT = 5;
const MODULE = 'Utilisateurs';
const ACTION_NAME = 'tenant_membership_backfill_1h1';

// ── Argument parsing ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { live: false, commit: false, limit: DEFAULT_LIMIT, tenant: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--live') args.live = true;
    else if (a === '--commit') args.commit = true;
    else if (a === '--limit') { args.limit = Number.parseInt(argv[++i], 10); }
    else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.split('=')[1], 10);
    else if (a === '--tenant') { args.tenant = argv[++i]; }
    else if (a.startsWith('--tenant=')) args.tenant = a.split('=')[1];
  }
  return args;
}

function validateArgs(args) {
  if (!Number.isInteger(args.limit) || args.limit < 0) {
    throw new Error(`INVALID_LIMIT: --limit must be a non-negative integer (got ${args.limit}).`);
  }
  if (args.commit && !args.live) {
    throw new Error('MODE_REFUSED: --commit requires --live.');
  }
  if (args.tenant && !mongoose.isValidObjectId(args.tenant)) {
    throw new Error(`INVALID_TENANT: ${args.tenant} is not a valid ObjectId.`);
  }
  return args;
}

function resolveApplyConnection(args, env = process.env) {
  const writeEnabled = Boolean(args.live && args.commit);
  if (!writeEnabled) {
    const { uri, target } = resolveReadOnlyConnection(env);
    return { uri, target, variable: 'MONGO_URI_READONLY', writeEnabled: false };
  }

  if (typeof env.MONGO_URI !== 'string' || !env.MONGO_URI.trim()) {
    throw new Error('MONGO_URI_REQUIRED');
  }
  return { uri: env.MONGO_URI.trim(), target: null, variable: 'MONGO_URI', writeEnabled: true };
}

// ── Dry-run hash (candidate manifest, deterministic, timestamp-free) ────────
function computeDryRunHash(report) {
  // Deterministic canonicalisation of the candidate set — excludes generatedAt
  // and any other volatile metadata.
  const canonical = (report.candidates || [])
    .map((c) => ({
      membershipId: c.membershipId,
      userId: c.userId,
      tenantId: c.tenantId,
      currentBusinessRole: c.currentBusinessRole,
      proposedBusinessRole: c.proposedBusinessRole,
      userRole: c.userRole,
      source: c.source,
      confidence: c.confidence,
      classification: c.classification,
      action: c.action,
    }))
    .sort((a, b) => (a.membershipId < b.membershipId ? -1 : a.membershipId > b.membershipId ? 1 : 0));
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

// ── Eligibility (absolute filter) ───────────────────────────────────────────
function isEligibleCandidate(candidate) {
  return Boolean(
    candidate
    && candidate.action === ACTIONS.UPDATE
    && candidate.classification === CLASSIFICATIONS.UPDATE_CANDIDATE
    && candidate.confidence === 'HIGH'
    && candidate.currentBusinessRole === null
    && typeof candidate.proposedBusinessRole === 'string'
    && TENANT_BUSINESS_ROLES.includes(candidate.proposedBusinessRole)
    && candidate.membershipId
    && candidate.userId
    && candidate.tenantId,
  );
}

// ── Single-candidate CAS apply (module-level for test spies) ────────────────
async function applyOneCandidate({ candidate, dryRunHash, batchId, actor, session }) {
  const filter = { _id: candidate.membershipId, businessRole: null, status: 'active' };
  const update = { $set: { businessRole: candidate.proposedBusinessRole } };
  const cas = await OrgMembership.updateOne(filter, update, session ? { session } : undefined);
  if (!cas || cas.matchedCount !== 1) {
    return { membershipId: candidate.membershipId, applied: false, reason: 'CAS_CONCURRENT_UPDATE_SKIPPED' };
  }
  // Audit — same session so a rollback wipes both. If the session isn't a
  // replica-set-enabled session, ActionLog still persists (non-transactional
  // fallback documented in the report).
  const logDoc = {
    tenant: candidate.tenantId,
    action: ACTION_NAME,
    description: `Backfill businessRole=null → ${candidate.proposedBusinessRole} (source=${candidate.source})`,
    module: MODULE,
    scopeMode: 'tenant',
    auteur: {
      id: actor?._id || actor?.id || null,
      nom: actor?.name || 'backfill_1h1',
      role: actor?.role || 'system',
      email: actor?.email || null,
    },
    cible: { id: candidate.membershipId, type: 'OrgMembership', nom: null },
    typeAction: 'CHANGEMENT_RÔLE',
    metadata: {
      reason: candidate.reason || null,
      regularization: {
        batchId,
        resourceType: 'OrgMembership',
        resourceId: candidate.membershipId,
        classification: null,
        proofs: [candidate.source, candidate.confidence].filter(Boolean),
        before: { businessRole: null },
        after: { businessRole: candidate.proposedBusinessRole },
        manifestHash: dryRunHash,
        reason: candidate.reason || null,
        operation: 'apply',
      },
    },
    date: new Date(),
  };
  const created = session
    ? (await ActionLog.create([logDoc], { session }))[0]
    : await ActionLog.create(logDoc);
  return { membershipId: candidate.membershipId, applied: true, actionLogId: String(created._id) };
}

// ── Main apply entry point (used by CLI and tests) ──────────────────────────
async function runApply({ argv = [], actor = null, generatedAt } = {}) {
  const args = validateArgs(parseArgs(argv));
  const commit = args.live && args.commit;
  const batchId = crypto.randomBytes(16).toString('hex');

  // Reuse the 1H engine EXACTLY. No re-inference. Fixed generatedAt lets the
  // test harness compute the same hash as an assertion.
  const dryRun = await runDryRun({ generatedAt });
  const dryRunHash = computeDryRunHash(dryRun);

  // Optional tenant filter — validated before use. Fail closed if not found.
  let tenantOid = null;
  if (args.tenant) {
    const tenant = await PlatformTenant.findById(args.tenant).lean();
    if (!tenant) {
      throw new Error(`TENANT_NOT_FOUND: ${args.tenant}`);
    }
    tenantOid = String(tenant._id);
  }

  const highCandidates = dryRun.candidates.filter(isEligibleCandidate);
  const tenantScoped = tenantOid
    ? highCandidates.filter((c) => c.tenantId === tenantOid)
    : highCandidates;

  const summary = {
    TOTAL_DRY_RUN_CANDIDATES: dryRun.candidates.length,
    HIGH_UPDATE_CANDIDATES: highCandidates.length,
    ELIGIBLE_AFTER_FILTER: tenantScoped.length,
    ATTEMPTED: 0,
    APPLIED: 0,
    CAS_SKIPPED: 0,
    SKIPPED_BY_LIMIT: 0,
    MANUAL_REVIEW_SKIPPED: dryRun.candidates.filter((c) => c.action === ACTIONS.MANUAL_REVIEW).length,
    CONFLICT_SKIPPED: dryRun.candidates.filter((c) => c.action === ACTIONS.CONFLICT).length,
    EXTERNAL_SKIPPED: dryRun.candidates.filter((c) => c.classification === CLASSIFICATIONS.EXTERNAL_ROLE).length,
    OTHER_SKIPPED: 0,
    ACTION_LOGS_CREATED: 0,
  };
  summary.OTHER_SKIPPED = summary.TOTAL_DRY_RUN_CANDIDATES
    - summary.HIGH_UPDATE_CANDIDATES
    - summary.MANUAL_REVIEW_SKIPPED
    - summary.EXTERNAL_SKIPPED
    - summary.CONFLICT_SKIPPED;

  const results = [];

  if (!commit) {
    // Report only. No mongoose write is issued from this branch.
    for (const c of tenantScoped) {
      results.push({ membershipId: c.membershipId, applied: false, reason: 'NO_WRITE_MODE' });
    }
    return finalize({ args, dryRunHash, batchId, summary, results, generatedAt });
  }

  const toAttempt = tenantScoped.slice(0, args.limit);
  const overLimit = tenantScoped.slice(args.limit);
  summary.SKIPPED_BY_LIMIT = overLimit.length;
  overLimit.forEach((c) => results.push({ membershipId: c.membershipId, applied: false, reason: 'SKIPPED_BY_LIMIT' }));

  // One transaction per candidate — if any single write fails, only that
  // candidate rolls back; the batch continues. Concurrency uses CAS, not a
  // shared batch lock.
  for (const candidate of toAttempt) {
    summary.ATTEMPTED += 1;
    let outcome;
    let session = null;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        outcome = await module.exports.applyOneCandidate({ candidate, dryRunHash, batchId, actor, session });
      });
    } catch (err) {
      // Non-replica-set fallback: retry without a session (documented in
      // report as NON_TRANSACTIONAL). Only triggered when the driver refuses
      // to start a transaction (standalone Mongo).
      const msg = String(err && err.message || err);
      if (/Transaction numbers|replica set|no transactions/i.test(msg)) {
        outcome = await module.exports.applyOneCandidate({ candidate, dryRunHash, batchId, actor, session: null });
      } else {
        outcome = { membershipId: candidate.membershipId, applied: false, reason: `ERROR:${msg}` };
      }
    } finally {
      if (session) await session.endSession();
    }
    results.push(outcome);
    if (outcome.applied) {
      summary.APPLIED += 1;
      summary.ACTION_LOGS_CREATED += 1;
    } else if (outcome.reason === 'CAS_CONCURRENT_UPDATE_SKIPPED') {
      summary.CAS_SKIPPED += 1;
    }
  }

  return finalize({ args, dryRunHash, batchId, summary, results, generatedAt });
}

function finalize({ args, dryRunHash, batchId, summary, results, generatedAt }) {
  results.sort((a, b) => (a.membershipId < b.membershipId ? -1 : a.membershipId > b.membershipId ? 1 : 0));
  return {
    metadata: {
      mode: args.live && args.commit ? 'apply' : 'dry-run',
      live: Boolean(args.live),
      commit: Boolean(args.commit),
      tenantFilter: args.tenant || null,
      limit: args.limit,
      dryRunHash,
      batchId,
      generatedAt: generatedAt || new Date().toISOString(),
      version: VERSION,
      dryRunEngineVersion: DRY_RUN_VERSION,
    },
    summary,
    results,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = validateArgs(parseArgs(process.argv.slice(2)));
  const connection = resolveApplyConnection(args);
  console.log(`[1H.1] MODE: ${args.live && args.commit ? 'LIVE COMMIT' : 'DRY-RUN'}`);
  console.log(`[1H.1] CONNECTION VARIABLE: ${connection.variable}`);
  if (connection.target) {
    console.log(`[1H.1] TARGET: scheme=${connection.target.scheme} database=${connection.target.databaseName} hostFingerprint=${connection.target.hostFingerprint}`);
  }
  console.log(`[1H.1] MAX WRITES: ${args.limit}`);
  console.log(`[1H.1] TENANT FILTER: ${args.tenant || 'ALL'}`);
  await mongoose.connect(connection.uri);
  try {
    const report = await runApply({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = {
  runApply,
  applyOneCandidate,
  parseArgs,
  validateArgs,
  resolveApplyConnection,
  computeDryRunHash,
  isEligibleCandidate,
  ACTION_NAME,
  VERSION,
  DEFAULT_LIMIT,
};

if (require.main === module) {
  main().catch((err) => {
    const safeValidationCodes = new Set([
      'READONLY_URI_REQUIRED',
      'READONLY_URI_INVALID',
      'READONLY_DATABASE_REQUIRED',
      'MONGO_URI_REQUIRED',
      'MODE_REFUSED: --commit requires --live.',
    ]);
    console.error(safeValidationCodes.has(err?.message) ? err.message : 'APPLY_FAILED');
    process.exit(1);
  });
}
