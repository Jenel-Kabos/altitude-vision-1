const { hasDefaultCapability } = require('../utils/iamArchitecture');

// Ce guard ne remplace jamais auth, tenant, ownership, ABAC ou invariants métier.
const requireCapability = (...acceptedCapabilities) => (req, res, next) => {
  const role = req.user?.role;
  if (role && acceptedCapabilities.some(capability => hasDefaultCapability(role, capability))) return next();
  res.status(403);
  throw new Error(`Accès refusé : capacité requise (${acceptedCapabilities.join(' ou ')}).`);
};

const STAFF_ROLES = new Set(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant']);
const requireCapabilityForStaff = (...acceptedCapabilities) => (req, res, next) => {
  if (!STAFF_ROLES.has(req.user?.role)) return next();
  return requireCapability(...acceptedCapabilities)(req, res, next);
};

module.exports = { requireCapability, requireCapabilityForStaff };
