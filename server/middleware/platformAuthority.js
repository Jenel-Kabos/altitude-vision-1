const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');

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
 * Require both the global Admin identity and an active PlatformOperator
 * carrying the exact capability. Neither authority substitutes for the other.
 */
const requirePlatformOperatorCapability = (capability) => async (req, res, next) => {
  if (req.user?.role !== 'Admin') return requireGlobalAdmin(req, res, next);
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

module.exports = { requireGlobalAdmin, requirePlatformOperatorCapability, requirePlatformOperatorCapabilityWhenPresent };
