const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');

// Legacy compatibility boundary for public-signup users on an unambiguous
// single-tenant deployment. This must stay local to the explicitly opted-in
// back-office use cases and must never be folded into resolveTenantScope.
async function expandScopeWithUnaffiliatedUsersIfSoleTenant(scopeUserIds) {
  const ids = new Set((scopeUserIds || []).map(String));
  const tenantCount = await PlatformTenant.countDocuments({ status: { $in: ['trial', 'active'] } });
  if (tenantCount !== 1) return [...ids];

  const [membershipUserIds, operatorUserIds] = await Promise.all([
    OrgMembership.distinct('user'),
    PlatformOperator.distinct('user'),
  ]);
  const excluded = new Set([...membershipUserIds, ...operatorUserIds].map(String));
  const unaffiliated = await User.find({
    isTechnical: { $ne: true },
    isActive: { $ne: false },
    status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] },
    _id: { $nin: [...excluded] },
  }).select('_id').lean();
  unaffiliated.forEach((user) => ids.add(String(user._id)));
  return [...ids];
}

module.exports = { expandScopeWithUnaffiliatedUsersIfSoleTenant };
