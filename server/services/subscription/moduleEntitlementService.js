const mongoose = require('mongoose');
const IndividualSubscription = require('../../models/IndividualSubscription');
const PlatformTenantFeature = require('../../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../../models/PlatformTenantSubscription');
const { TENANT_FEATURE_MODULES } = require('../../constants/platformTenantConstants');

const MODULE_SCOPE = Object.freeze({
  INDIVIDUAL: 'INDIVIDUAL',
  ORGANIZATION: 'ORGANIZATION',
});

const ELIGIBLE_STATUSES = Object.freeze(['trialing', 'active']);

class ModuleEntitlementError extends Error {
  constructor(code, message, decision) {
    super(message);
    this.name = 'ModuleEntitlementError';
    this.code = code;
    this.statusCode = 403;
    this.decision = decision;
  }
}

const id = (value) => (mongoose.isValidObjectId(value?._id || value) ? String(value?._id || value) : null);

function assertKnownModule(module) {
  if (!TENANT_FEATURE_MODULES.includes(module)) {
    throw new Error(`moduleEntitlementService: unknown module '${module}'.`);
  }
}

const leanWithSession = (query, session) => {
  if (session) query.session(session);
  return query.lean();
};

async function individualDecision({ userId, module, session }) {
  const subjectId = id(userId);
  if (!subjectId) return { allowed: false, reason: 'SUBJECT_REQUIRED', status: null, subjectId: null, scope: MODULE_SCOPE.INDIVIDUAL, module };
  const subscription = await leanWithSession(
    IndividualSubscription.findOne({ user: subjectId }).sort({ createdAt: -1 }),
    session,
  );
  if (!subscription) return { allowed: false, reason: 'NO_SUBSCRIPTION', status: null, subjectId, scope: MODULE_SCOPE.INDIVIDUAL, module };
  if (!ELIGIBLE_STATUSES.includes(subscription.status)) {
    return { allowed: false, reason: 'SUBSCRIPTION_INELIGIBLE', status: subscription.status, subjectId, scope: MODULE_SCOPE.INDIVIDUAL, module };
  }
  const allowed = subscription.modulesIncluded.includes(module);
  return { allowed, reason: allowed ? 'ENTITLED' : 'MODULE_UNAVAILABLE', status: subscription.status, subjectId, scope: MODULE_SCOPE.INDIVIDUAL, module };
}

async function organizationDecision({ tenantId, module, session }) {
  const subjectId = id(tenantId);
  if (!subjectId) return { allowed: false, reason: 'SUBJECT_REQUIRED', status: null, subjectId: null, scope: MODULE_SCOPE.ORGANIZATION, module };
  const [feature, subscription] = await Promise.all([
    leanWithSession(PlatformTenantFeature.findOne({ tenant: subjectId, module }), session),
    leanWithSession(PlatformTenantSubscription.findOne({ tenant: subjectId, status: { $in: ELIGIBLE_STATUSES }, modulesIncluded: module }).select('status'), session),
  ]);
  if (feature?.enabled === false) return { allowed: false, reason: 'MODULE_DISABLED', status: subscription?.status || null, subjectId, scope: MODULE_SCOPE.ORGANIZATION, module };
  if (feature?.enabled === true) return { allowed: true, reason: 'ENTITLED', status: subscription?.status || null, subjectId, scope: MODULE_SCOPE.ORGANIZATION, module };
  return { allowed: Boolean(subscription), reason: subscription ? 'ENTITLED' : 'NO_ELIGIBLE_SUBSCRIPTION', status: subscription?.status || null, subjectId, scope: MODULE_SCOPE.ORGANIZATION, module };
}

async function canUseModule({ scope, userId, tenantId, module, session } = {}) {
  assertKnownModule(module);
  if (scope === MODULE_SCOPE.INDIVIDUAL) return individualDecision({ userId, module, session });
  if (scope === MODULE_SCOPE.ORGANIZATION) return organizationDecision({ tenantId, module, session });
  throw new Error(`moduleEntitlementService: unknown scope '${scope}'.`);
}

async function assertCanUseModule(input) {
  const decision = await canUseModule(input);
  if (decision.allowed) return decision;
  const prefix = decision.scope === MODULE_SCOPE.INDIVIDUAL ? 'INDIVIDUAL' : 'TENANT';
  const code = decision.reason === 'MODULE_UNAVAILABLE'
    ? `${prefix}_MODULE_UNAVAILABLE`
    : `${prefix}_ENTITLEMENT_REQUIRED`;
  throw new ModuleEntitlementError(code, 'Module location indisponible pour cet espace.', decision);
}

module.exports = {
  ELIGIBLE_STATUSES,
  MODULE_SCOPE,
  ModuleEntitlementError,
  canUseModule,
  assertCanUseModule,
};
