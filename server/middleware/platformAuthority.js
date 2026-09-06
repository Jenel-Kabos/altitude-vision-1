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

module.exports = { requirePlatformOperatorCapability };
