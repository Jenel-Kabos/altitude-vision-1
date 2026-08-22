const { hasDefaultCapability, assertKnownCapability } = require('../utils/iamArchitecture');

// Ce guard ne remplace jamais auth, tenant, ownership, ABAC ou invariants métier.
// RBAC-2 — `assertKnownCapability` s'exécute une seule fois, au chargement du
// module de routes (synchrone, hors requête) : une capacité mal orthographiée
// fait échouer le démarrage du serveur / les tests immédiatement, jamais un
// 403 silencieux découvert seulement en production.
const requireCapability = (...acceptedCapabilities) => {
  acceptedCapabilities.forEach(assertKnownCapability);
  return (req, res, next) => {
    const role = req.user?.role;
    if (role && acceptedCapabilities.some(capability => hasDefaultCapability(role, capability))) return next();
    res.status(403);
    throw new Error(`Accès refusé : capacité requise (${acceptedCapabilities.join(' ou ')}).`);
  };
};

const STAFF_ROLES = new Set(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant']);
const requireCapabilityForStaff = (...acceptedCapabilities) => {
  // RBAC-2 — même discipline fail-fast que `requireCapability` : validée une
  // seule fois au chargement du module, pas reconstruite à chaque requête.
  const guard = requireCapability(...acceptedCapabilities);
  return (req, res, next) => {
    if (!STAFF_ROLES.has(req.user?.role)) return next();
    return guard(req, res, next);
  };
};

module.exports = { requireCapability, requireCapabilityForStaff };
