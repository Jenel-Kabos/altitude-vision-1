// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-A — requireTenantModule.
//
// Répond à UNE seule question : "Ce PlatformTenant possède-t-il ce module ?"
// Jamais à "cet utilisateur a-t-il le droit ?" — cette responsabilité
// appartient à `requireTenantMembershipRole(...)`.
//
// Sémantique (dérivée du code existant, jamais inventée) :
//   1. `PlatformTenantFeature` avec `enabled=false` sur (tenant, module)
//      → DENY prioritaire, quel que soit l'abonnement.
//   2. `PlatformTenantFeature` avec `enabled=true` sur (tenant, module)
//      → ALLOW.
//   3. Aucun `PlatformTenantFeature` explicite ET `PlatformTenantSubscription`
//      dans un statut `trialing|active` qui inclut le module dans
//      `modulesIncluded` → ALLOW.
//   4. Tout le reste (aucun abonnement, abonnement cancelled/past_due,
//      module absent, tenant non résolu, module inconnu, erreur) → DENY.
//
// Fail-closed par défaut. Aucune lecture de `User.role`, `businessRole`,
// `PlatformOperator.capabilities`, `body.role`, `query.module` ni de
// headers custom. Composable après `requireTenantScope` (qui pose
// `req.platformTenant`), et avant `requireTenantMembershipRole`.

const PlatformTenantFeature = require('../models/PlatformTenantFeature');
const PlatformTenantSubscription = require('../models/PlatformTenantSubscription');
const { TENANT_FEATURE_MODULES } = require('../constants/platformTenantConstants');

const buildError = (code, message, statusCode = 403) => {
  const err = new Error(message);
  err.name = 'TenantModuleGateError';
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

// Fail-fast au chargement : une valeur mal orthographiée fait échouer le
// démarrage / les tests immédiatement, jamais un 403 silencieux découvert
// seulement en production (même discipline que `assertKnownCapability` dans
// `capabilityMiddleware.js`).
function assertKnownModule(m) {
  if (typeof m !== 'string' || !TENANT_FEATURE_MODULES.includes(m)) {
    throw new Error(`requireTenantModule: unknown module '${m}' (must be one of ${TENANT_FEATURE_MODULES.join(', ')}).`);
  }
}

async function isModuleAvailable(tenantId, moduleKey) {
  const [feature, subscription] = await Promise.all([
    PlatformTenantFeature.findOne({ tenant: tenantId, module: moduleKey }).lean(),
    PlatformTenantSubscription.findOne({
      tenant: tenantId,
      status: { $in: ['trialing', 'active'] },
      modulesIncluded: moduleKey,
    }).select('_id').lean(),
  ]);
  if (feature && feature.enabled === false) return false;
  if (feature && feature.enabled === true) return true;
  return Boolean(subscription);
}

function requireTenantModule(...modules) {
  if (!modules.length) {
    throw new Error('requireTenantModule: at least one module is required.');
  }
  modules.forEach(assertKnownModule);

  return async function tenantModuleGateMiddleware(req, res, next) {
    try {
      const tenant = req.platformTenant;
      if (!tenant?._id) {
        res.status(403);
        return next(buildError('TENANT_CONTEXT_REQUIRED', 'Contexte tenant requis.', 403));
      }
      for (const m of modules) {
        const ok = await isModuleAvailable(tenant._id, m);
        if (ok) {
          req.tenantModule = m;
          return next();
        }
      }
      res.status(403);
      return next(buildError('TENANT_MODULE_UNAVAILABLE', `Module tenant indisponible (attendu : ${modules.join(' ou ')}).`, 403));
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireTenantModule, isModuleAvailable };
