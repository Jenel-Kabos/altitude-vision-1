const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');

/**
 * Require an active PlatformOperator capability. User.role is deliberately
 * not used as a substitute for platform authority.
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

module.exports = { requirePlatformOperatorCapability, requirePlatformOperatorCapabilityWhenPresent };
