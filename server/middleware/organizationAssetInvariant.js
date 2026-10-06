const asyncHandler = require('express-async-handler');
const { resolvePropertyCreationTenant } = require('../services/platformTenant/organizationAssetInvariantService');

const preventOrganizationOwnerPersonalProfessionalAsset = asyncHandler(async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  try {
    req.propertyCreationTenantId = await resolvePropertyCreationTenant({
      ownerId: userId,
      contextualTenantId: req.platformTenant?._id || null,
    });
    return next();
  } catch (error) {
    res.status(error.statusCode || 409);
    return next(error);
  }
});

module.exports = { preventOrganizationOwnerPersonalProfessionalAsset };
