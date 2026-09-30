const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');
const { resolveTenantMembership } = require('../services/tenantMembershipService');

/**
 * Global platform-administrator identity. This guard deliberately reads only
 * the authenticated User identity; tenant context and memberships are not
 * authority inputs for global administration.
 */
const requireGlobalAdmin = (req, res, next) => {
  if (req.user?.role === 'Admin') return next();
  return res.status(403).json({
    status: 'fail',
    message: 'Action refusée : identité administrateur plateforme requise.',
  });
};

/**
 * Canonical platform authority: an active PlatformOperator carrying the
 * exact capability. User.role and tenant memberships are deliberately not
 * inputs to this platform-scoped decision.
 */
const requirePlatformOperatorCapability = (capability) => async (req, res, next) => {
  const operator = await resolveActiveOperator(req.user?._id || req.user?.id).catch(() => null);
  if (!operator || !hasCapability(operator, capability)) {
    return res.status(403).json({
      status: 'fail',
      message: 'Action refusée : capacité opérateur plateforme requise.',
    });
  }
  req.isPlatformOperatorContext = true;
  req.platformOperatorCapabilities = operator.capabilities || [];
  req.platformOperator = operator;
  return next();
};

/**
 * Dual-mode route guard. Platform-wide mode requires the exact operator
 * capability; tenant mode requires a canonical active root membership with
 * one of the supplied business roles. The two authority sources never imply
 * one another.
 */
const requireTenantBusinessRoleOrPlatformCapability = ({ tenantRoles = [], platformCapability }) => async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });

  if (req.isPlatformOperatorContext) {
    const operator = req.platformOperator || await resolveActiveOperator(userId).catch(() => null);
    if (hasCapability(operator, platformCapability)) {
      req.platformOperator = operator;
      req.platformOperatorCapabilities = operator.capabilities || [];
      req.platformAuthorityUsed = true;
      return next();
    }
    return res.status(403).json({ status: 'fail', message: 'Action refusée : capacité opérateur plateforme requise.' });
  }

  if (!req.platformTenant?._id) {
    return res.status(403).json({ status: 'fail', message: 'Contexte tenant requis.' });
  }
  const membership = await resolveTenantMembership(userId, req.platformTenant._id).catch(() => null);
  if (membership?.ambiguous) {
    return res.status(403).json({ status: 'fail', code: 'AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', message: 'Adhésions actives multiples : accès refusé.' });
  }
  if (membership?.businessRole && tenantRoles.includes(membership.businessRole)) {
    req.tenantMembership = membership.membership;
    req.tenantBusinessRole = membership.businessRole;
    req.platformAuthorityUsed = false;
    return next();
  }
  return res.status(403).json({ status: 'fail', message: 'Autorité tenant ou capacité plateforme requise.' });
};

// Compose after tenant-context resolution on dual-mode staff routes. Legacy
// staff keeps its role capabilities; a recognized PlatformOperator must also
// hold the explicit cross-platform capability.
const requirePlatformOperatorCapabilityWhenPresent = (capability) => (req, res, next) => {
  if (!req.isPlatformOperatorContext) return next();
  if (hasCapability({ status: 'active', capabilities: req.platformOperatorCapabilities || [] }, capability)) return next();
  return res.status(403).json({
    status: 'fail',
    message: 'Action refusée : capacité opérateur plateforme requise.',
  });
};

module.exports = {
  requireGlobalAdmin,
  requirePlatformOperatorCapability,
  requirePlatformOperatorCapabilityWhenPresent,
  requireTenantBusinessRoleOrPlatformCapability,
};
