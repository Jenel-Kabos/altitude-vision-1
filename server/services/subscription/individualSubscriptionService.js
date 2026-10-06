const IndividualSubscription = require('../../models/IndividualSubscription');
const { PLATFORM_TENANT_PLANS, TENANT_FEATURE_MODULES } = require('../../constants/platformTenantConstants');
const { DEFAULT_QUOTAS_BY_PLAN } = require('../../models/PlatformTenantSubscription');

class IndividualSubscriptionError extends Error {
  constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; }
}

const actorId = (actor) => actor?._id || actor?.id || null;

async function getIndividualSubscription(userId) {
  return IndividualSubscription.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
}

async function changeIndividualSubscription(userId, { plan, modulesIncluded, quotas, actor } = {}) {
  if (!PLATFORM_TENANT_PLANS.includes(plan)) throw new IndividualSubscriptionError('INDIVIDUAL_PLAN_INVALID', `Plan inconnu : ${plan}.`, 422);
  const modules = modulesIncluded?.length ? modulesIncluded : ['location'];
  if (modules.some((module) => !TENANT_FEATURE_MODULES.includes(module))) throw new IndividualSubscriptionError('INDIVIDUAL_MODULE_INVALID', 'Module individuel inconnu.', 422);
  const previous = await IndividualSubscription.findOne({ user: userId, status: { $in: ['trialing', 'active'] } });
  if (previous) {
    previous.status = 'cancelled'; previous.cancelledAt = new Date(); previous.cancelledBy = actorId(actor);
    previous.cancellationReason = 'Changement de plan'; previous.endDate = new Date(); await previous.save();
  }
  const defaults = DEFAULT_QUOTAS_BY_PLAN[plan] || DEFAULT_QUOTAS_BY_PLAN.trial;
  return IndividualSubscription.create({
    user: userId, plan, status: 'active', modulesIncluded: modules,
    quotas: { maxManagedProperties: quotas?.maxManagedProperties ?? defaults.maxManagedProperties ?? null },
    createdBy: actorId(actor),
  });
}

async function cancelIndividualSubscription(userId, { actor, reason } = {}) {
  const subscription = await IndividualSubscription.findOne({ user: userId, status: { $in: ['trialing', 'active'] } });
  if (!subscription) throw new IndividualSubscriptionError('INDIVIDUAL_SUBSCRIPTION_NOT_FOUND', 'Aucun abonnement individuel actif.', 404);
  subscription.status = 'cancelled'; subscription.cancelledAt = new Date(); subscription.cancelledBy = actorId(actor);
  subscription.cancellationReason = reason || null; subscription.endDate = new Date();
  return subscription.save();
}

module.exports = { IndividualSubscriptionError, getIndividualSubscription, changeIndividualSubscription, cancelIndividualSubscription };
