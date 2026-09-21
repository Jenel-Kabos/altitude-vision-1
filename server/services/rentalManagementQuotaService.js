// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H — canonical quota primitive.
//
// Answers ONE question: "May this tenant activate one more rental-management
// resource under its current subscription?" Never touches identity/authority
// — module + businessRole + Property.tenant continue to be enforced upstream.
//
// Consistency model: **count-then-write with a session-scoped re-check**.
// The primary check runs INSIDE the same `session.withTransaction` block as
// the write that flips `managementActivated=true`. Under
// MongoMemoryReplSet / replica-set production, `session.withTransaction`
// retries automatically on TransientTransactionError (WriteConflict), so
// two concurrent activations at the quota boundary serialise: the second
// re-runs its transaction, re-reads the count, and observes the first
// write already committed — the second is refused with
// `TENANT_MANAGED_PROPERTY_QUOTA_EXCEEDED`.

const mongoose = require('mongoose');
const RentalManagement = require('../models/RentalManagement');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');

const QUOTA_ERROR_CODE = 'TENANT_MANAGED_PROPERTY_QUOTA_EXCEEDED';

class QuotaError extends Error {
  constructor(current, limit, plan) {
    super(`Quota de biens gérés atteint (${current}/${limit}).`);
    this.name = 'RentalManagementQuotaError';
    this.code = QUOTA_ERROR_CODE;
    this.statusCode = 409;
    this.current = current;
    this.limit = limit;
    this.plan = plan;
  }
}

async function getActiveManagedCount(tenantId, { session } = {}) {
  if (!tenantId) return 0;
  const query = RentalManagement.countDocuments({ tenant: tenantId, managementActivated: true });
  if (session) return query.session(session);
  return query;
}

async function resolveSubscription(tenantId, { session } = {}) {
  if (!tenantId) return null;
  const query = PlatformTenantSubscription.findOne({
    tenant: tenantId,
    status: { $in: ['trialing', 'active'] },
  }).select('plan quotas');
  if (session) query.session(session);
  return query.lean();
}

// Primary assertion. Call BEFORE any write that flips
// `managementActivated: true`. If `session` is provided (recommended) the
// count and the subscription read are session-scoped so the transaction
// retry loop observes the correct pre-write state.
async function assertActivationAllowed({ tenantId, session } = {}) {
  if (!tenantId) return { limit: null, current: 0, plan: null }; // unattributed → no quota enforced here
  const subscription = await resolveSubscription(tenantId, { session });
  const limit = subscription?.quotas?.maxManagedProperties;
  const plan = subscription?.plan || null;
  // Unlimited (null) or missing subscription → allowed. Missing subscription
  // is a separate concern already handled by requireTenantModule + module
  // gate upstream.
  if (limit === null || limit === undefined) return { limit: null, current: 0, plan };
  const current = await getActiveManagedCount(tenantId, { session });
  if (current >= limit) throw new QuotaError(current, limit, plan);
  return { limit, current, plan };
}

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-H.1 — canonical activation
// wrapper. Every runtime path that flips `RentalManagement.managementActivated`
// from anything but `true` must be wrapped by this helper. It:
//   1. resolves an active session (creates one if none is provided);
//   2. runs `assertActivationAllowed` INSIDE the session;
//   3. issues a serialising sentinel write on the tenant's subscription
//      (`$currentDate: { updatedAt: true }`) so concurrent transactions on
//      the same tenant WriteConflict and retry;
//   4. invokes the caller's write via `run(session)`;
//   5. commits (or aborts on any thrown error).
//
// A `tenantId=null` (personal/legacy management, unattributed) bypasses the
// quota — the tenant contract has no budget to enforce there. This matches
// the Lot E/G "Property.tenant is authoritative" model.
async function withActivationQuotaGuard({ tenantId, session, run }) {
  if (typeof run !== 'function') throw new Error('withActivationQuotaGuard: `run` callback is required.');
  if (!tenantId) return run(session || null);
  const wrap = async (activeSession) => {
    await assertActivationAllowed({ tenantId, session: activeSession });
    await PlatformTenantSubscription.updateOne(
      { tenant: tenantId, status: { $in: ['trialing', 'active'] } },
      { $currentDate: { updatedAt: true } },
      { session: activeSession },
    );
    return run(activeSession);
  };
  if (session) return wrap(session);
  const local = await mongoose.startSession();
  try {
    let result;
    await local.withTransaction(async () => { result = await wrap(local); });
    return result;
  } finally {
    await local.endSession();
  }
}

module.exports = {
  QUOTA_ERROR_CODE,
  QuotaError,
  getActiveManagedCount,
  assertActivationAllowed,
  resolveSubscription,
  withActivationQuotaGuard,
};
