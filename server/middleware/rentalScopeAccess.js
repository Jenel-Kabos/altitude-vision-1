const {
  assertIndependentOwnerState,
  assertIndividualEntitlement,
} = require('../services/rentalIndividualAccessService');

function selectIndividualRoute(req, _res, next) {
  if (req.query?.scope !== 'individual') return next('route');
  return next();
}

async function requireIndividualRentalScope(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    await assertIndependentOwnerState(userId);
    const entitlement = await assertIndividualEntitlement(userId);
    req.rentalScope = { mode: 'individual', ownerId: String(userId), tenantId: null, entitlement };
    return next();
  } catch (error) {
    res.status(error.statusCode || 403);
    return next(error);
  }
}

module.exports = { selectIndividualRoute, requireIndividualRentalScope };
