// TENANT-CORE-1 (Phase 4) — Middleware d'isolation, opt-in par route
// (jamais monté globalement — voir tenantContextService.js pour la
// justification). Deux niveaux :
//   attachTenantContext  — résout req.platformTenant si possible, ne bloque
//                           jamais (utile aux routes qui personnalisent sans
//                           exiger un tenant, ex. branding public).
//   requireTenantScope   — exige un tenant résolu, 403 sinon.
const { resolveEffectiveTenantContext, resolveAvailableTenantsForUser } = require('../services/platformTenant/tenantContextService');

const requestedTenant = (req) => req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;

const attachTenantContext = async (req, res, next) => {
  try {
    const context = req.user ? await resolveEffectiveTenantContext(req.user._id || req.user.id, requestedTenant(req)) : null;
    req.platformTenant = context?.tenant || null;
    req.tenantContextSource = context?.source || null;
  } catch {
    req.platformTenant = null;
  }
  next();
};

// PLATFORM-ADMIN-1 — factory, pas une fonction unique : `allowPlatformWide`
// distingue les DEUX routes/domaines qui supportent nativement un mode
// plateforme sans tenant sélectionné (reporting exécutif — voir
// reportingController.js) de TOUS les autres, qui continuent d'exiger une
// sélection de tenant explicite même pour un opérateur (mission §20-21 —
// jamais de scope global fabriqué pour un domaine qui n'a pas déjà cette
// capacité native). `requireTenantScope` (export par défaut, `false`) est
// utilisé PARTOUT ailleurs et n'a AUCUN changement de comportement pour un
// opérateur non scopé au-delà du message d'erreur (voir plus bas) — il
// bloque toujours, exactement comme le fail-closed historique.
const createRequireTenantScope = ({ allowPlatformWide = false } = {}) => async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  const explicitTenantId = requestedTenant(req);
  const available = userId ? await resolveAvailableTenantsForUser(userId).catch(() => []) : [];
  const context = userId ? await resolveEffectiveTenantContext(userId, explicitTenantId).catch(() => null) : null;
  req.platformTenant = context?.tenant || null;
  req.tenantContextSource = context?.source || null;

  // PLATFORM-ADMIN-1 — un opérateur actif est reconnu par `source` même
  // quand `tenant` reste `null` (mode plateforme non scopé) : ne jamais
  // déduire ce flag de l'absence de tenant seule (mission §15 — un
  // `tenantId` absent ne doit JAMAIS, à lui seul, signifier un accès global).
  const isPlatformOperator = typeof req.tenantContextSource === 'string' && req.tenantContextSource.startsWith('platform_operator');
  req.isPlatformOperatorContext = isPlatformOperator;
  req.platformOperatorCapabilities = isPlatformOperator ? (context.operator?.capabilities || []) : [];

  const unscopedOperatorAllowed = allowPlatformWide && isPlatformOperator && req.tenantContextSource === 'platform_operator_unscoped';

  if (!req.platformTenant && !unscopedOperatorAllowed) {
    res.status(403);
    let message;
    if (isPlatformOperator && req.tenantContextSource === 'platform_operator_tenant_not_found') {
      message = "Accès refusé : le tenant sélectionné est introuvable.";
    } else if (isPlatformOperator) {
      // Opérateur authentifié comme tel mais sans tenant choisi : signal
      // distinct d'un échec ordinaire — invite explicitement à sélectionner
      // un tenant plutôt que de suggérer un problème de compte.
      message = "Sélectionnez un tenant à administrer (en-tête X-Platform-Tenant-Id requis pour ce module).";
    } else {
      message = explicitTenantId
        ? "Accès refusé : le tenant demandé n'est pas accessible à cet utilisateur."
        : available.length > 1
          ? 'Contexte tenant ambigu : sélectionnez explicitement un tenant accessible.'
          : 'Accès refusé : aucun tenant SaaS actif résolu pour cet utilisateur.';
    }
    const error = new Error(message);
    error.name = 'TenantContextError';
    error.code = isPlatformOperator ? 'PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED' : 'TENANT_CONTEXT_REQUIRED';
    error.statusCode = 403;
    return next(error);
  }

  if (!req.platformTenant) {
    // Opérateur en mode plateforme, sur une route qui l'autorise
    // explicitement : aucun scope à résoudre, `scopeParams` (reportingController)
    // sait lire `req.isPlatformOperatorContext` pour laisser `tenantId`
    // volontairement absent plutôt que d'inventer un scope global ici.
    req.tenantScopeUserIds = null;
    req.user.isPlatformOperatorContext = req.isPlatformOperatorContext;
    req.user.platformOperatorCapabilities = req.platformOperatorCapabilities;
    return next();
  }

  const scope = await require('../services/platformTenant/tenantContextService').resolveTenantScope(
    req.platformTenant._id,
    { allowAnyStatus: isPlatformOperator },
  );
  req.tenantScopeUserIds = Array.from(scope.scopeUserIds || []);
  if (context.source === 'legacy_fallback' && !req.tenantScopeUserIds.some((id) => String(id) === String(userId))) {
    req.tenantScopeUserIds.push(userId);
  }
  // Les services métier centraux reçoivent déjà `req.user`; enrichir cet
  // acteur évite de disperser tenantId dans chaque signature sans jamais
  // faire confiance à une valeur issue du body/query client.
  req.user.platformTenant = req.platformTenant;
  req.user.tenantScopeUserIds = req.tenantScopeUserIds;
  req.user.tenantContextSource = req.tenantContextSource;
  req.user.isPlatformOperatorContext = req.isPlatformOperatorContext;
  req.user.platformOperatorCapabilities = req.platformOperatorCapabilities;
  return next();
};

const requireTenantScope = createRequireTenantScope({ allowPlatformWide: false });
const requireTenantScopeAllowPlatformWide = createRequireTenantScope({ allowPlatformWide: true });

module.exports = { attachTenantContext, requireTenantScope, requireTenantScopeAllowPlatformWide };
