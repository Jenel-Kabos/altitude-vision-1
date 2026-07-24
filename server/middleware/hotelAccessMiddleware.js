const { assertHotelCapability } = require('../services/hotel/hotelAccessScopeService');

/**
 * Résout et attache `req.hotelAccessScope` pour la capacité requise, à partir d'un hotelId
 * extrait par `resolveHotelId(req)` (jamais une confiance aveugle dans le frontend : le
 * contrôleur peut fournir un extracteur qui charge la ressource réelle, ex: document → hotel).
 */
function requireHotelCapability(capability, resolveHotelId = (req) => req.params.hotelId || req.body?.hotelId || req.query?.hotelId) {
  return async (req, res, next) => {
    try {
      const hotelId = await resolveHotelId(req);
      const scope = await assertHotelCapability({ actor: req.user, requiredCapability: capability, hotelId });
      req.hotelAccessScope = scope;
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { requireHotelCapability };
