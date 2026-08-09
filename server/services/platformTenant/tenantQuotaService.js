const PlatformTenantSubscription = require('../../models/PlatformTenantSubscription');
const OrgMembership = require('../../models/OrgMembership');
const OrgUnit = require('../../models/OrgUnit');
const ApiKey = require('../../models/ApiKey');

class TenantQuotaError extends Error {
  constructor(code, message, statusCode = 409) { super(message); this.name = 'TenantQuotaError'; this.code = code; this.statusCode = statusCode; }
}

const QUOTAS = {
  users: { field: 'maxUsers', count: async (tenant) => OrgMembership.distinct('user', { orgUnit: { $in: await OrgUnit.find({ $or: [{ _id: tenant.rootOrgUnit }, { ancestors: tenant.rootOrgUnit }] }).distinct('_id') }, status: 'active' }).then((ids) => ids.length) },
  orgUnits: { field: 'maxOrgUnits', count: (tenant) => OrgUnit.countDocuments({ $or: [{ _id: tenant.rootOrgUnit }, { ancestors: tenant.rootOrgUnit }], status: 'active' }) },
  apiKeys: { field: 'maxApiKeys', count: (tenant) => ApiKey.countDocuments({ tenant: tenant._id, status: 'active' }) },
};

async function checkQuota(tenant, resource, increment = 1) {
  const definition = QUOTAS[resource];
  if (!definition) throw new TenantQuotaError('TENANT_QUOTA_RESOURCE_UNKNOWN', `Quota inconnu : ${resource}.`, 422);
  const subscription = await PlatformTenantSubscription.findOne({ tenant: tenant._id, status: { $in: ['trialing', 'active'] } }).lean();
  if (!subscription) throw new TenantQuotaError('TENANT_SUBSCRIPTION_REQUIRED', 'Aucun abonnement tenant actif.');
  const limit = subscription.quotas?.[definition.field];
  if (limit == null) return { allowed: true, limit: null, current: await definition.count(tenant) };
  const current = await definition.count(tenant);
  if (current + increment > limit) throw new TenantQuotaError('TENANT_QUOTA_EXCEEDED', `Quota ${resource} atteint (${current}/${limit}).`);
  return { allowed: true, limit, current };
}

module.exports = { TenantQuotaError, checkQuota };
