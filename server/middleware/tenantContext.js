// TENANT-CORE-1 (Phase 4) — Middleware d'isolation, opt-in par route
// (jamais monté globalement — voir tenantContextService.js pour la
// justification). Trois niveaux :
//   attachTenantContext        — résout req.platformTenant si possible, ne
//                                 bloque jamais, N'ENRICHIT PAS req.user
//                                 (utile aux routes qui personnalisent sans
//                                 exiger un tenant, ex. branding public —
//                                 aucun service en aval ne lit
//                                 req.user.platformTenant sur ces routes).
//   requireTenantScope         — exige un tenant résolu, 403 sinon.
//   attachTenantScopeIfResolvable — TENANT-SCOPE-HOTFIX-3 : même résolution
//                                 et même enrichissement de `req.user` que
//                                 `requireTenantScope` QUAND un tenant se
//                                 résout (aucun changement pour le staff),
//                                 mais ne bloque JAMAIS quand aucun tenant
//                                 ne se résout — laisse la requête atteindre
//                                 le contrôleur/service d'autorisation
//                                 métier (hotelAccessScopeService,
//                                 financialAuthorizationService…) qui
//                                 applique la vraie vérification
//                                 d'ownership. Ne décide jamais lui-même de
//                                 l'autorisation — voir §12 du mandat
//                                 HOTFIX-3 : « laisser passer la requête
//                                 jusqu'au bon garde, jamais supprimer le
//                                 garde ». Réservé aux routeurs dont TOUTES
//                                 les routes staff-only restent protégées
//                                 indépendamment par rôle/capacité (jamais
//                                 par la seule présence d'un tenant) — voir
//                                 TENANT_SCOPE_HOTFIX3_ROUTE_MATRIX.md.
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

// Résolution + enrichissement partagés par `requireTenantScope` et
// `attachTenantScopeIfResolvable` — extrait une seule fois pour qu'aucune
// des deux variantes ne puisse diverger accidentellement dans SA façon de
// peupler `req.platformTenant`/`req.tenantScopeUserIds`/`req.user.*`. Ne
// décide JAMAIS du blocage : chaque appelant applique sa propre politique
// (bloquant ou non) sur le résultat retourné.
async function resolveAndAttachTenantScope(req, { allowAnyStatus = false } = {}) {
  const userId = req.user?._id || req.user?.id;
  const explicitTenantId = requestedTenant(req);
  const available = userId ? await resolveAvailableTenantsForUser(userId).catch(() => []) : [];
  const context = userId ? await resolveEffectiveTenantContext(userId, explicitTenantId).catch(() => null) : null;
  req.platformTenant = context?.tenant || null;
  req.tenantContextSource = context?.source || null;

  const isPlatformOperator = typeof req.tenantContextSource === 'string' && req.tenantContextSource.startsWith('platform_operator');
  req.isPlatformOperatorContext = isPlatformOperator;
  req.platformOperatorCapabilities = isPlatformOperator ? (context.operator?.capabilities || []) : [];

  if (!req.platformTenant) {
    return { resolved: false, isPlatformOperator, available, explicitTenantId, context };
  }

  const scope = await require('../services/platformTenant/tenantContextService').resolveTenantScope(
    req.platformTenant._id,
    { allowAnyStatus: allowAnyStatus || isPlatformOperator },
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
  return { resolved: true, isPlatformOperator, available, explicitTenantId, context };
}

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
const createRequireTenantScope = ({ allowPlatformWide = false, requireWhen = () => true } = {}) => async (req, res, next) => {
  const { resolved, isPlatformOperator, available, explicitTenantId } = await resolveAndAttachTenantScope(req);

  // Certaines routes restent légitimement accessibles aux clients sans
  // OrgMembership, tout en étant tenant-scoped pour le staff et les
  // Platform Operators. Le prédicat permet de réutiliser exactement le
  // garde canonique et ses codes sans imposer un tenant aux clients.
  if (!requireWhen({ req, resolved, isPlatformOperator })) return next();

  const unscopedOperatorAllowed = allowPlatformWide && isPlatformOperator && req.tenantContextSource === 'platform_operator_unscoped';

  if (!resolved && !unscopedOperatorAllowed) {
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

  if (!resolved) {
    // Opérateur en mode plateforme, sur une route qui l'autorise
    // explicitement : aucun scope à résoudre, `scopeParams` (reportingController)
    // sait lire `req.isPlatformOperatorContext` pour laisser `tenantId`
    // volontairement absent plutôt que d'inventer un scope global ici.
    req.tenantScopeUserIds = null;
    req.user.isPlatformOperatorContext = req.isPlatformOperatorContext;
    req.user.platformOperatorCapabilities = req.platformOperatorCapabilities;
  }
  return next();
};

const requireTenantScope = createRequireTenantScope({ allowPlatformWide: false });
const requireTenantScopeAllowPlatformWide = createRequireTenantScope({ allowPlatformWide: true });
const requireTenantScopeForStaffOrPlatformOperator = createRequireTenantScope({
  allowPlatformWide: false,
  requireWhen: ({ req, isPlatformOperator }) => isPlatformOperator || require('../utils/roles').ALL_STAFF.includes(req.user?.role),
});
const requireTenantScopeForAnalytics = createRequireTenantScope({
  allowPlatformWide: true,
  requireWhen: ({ req, isPlatformOperator }) => isPlatformOperator || require('../utils/roles').ALL_STAFF.includes(req.user?.role),
});
const requireTenantScopeForStaffAllowPlatformWide = createRequireTenantScope({
  allowPlatformWide: true,
  requireWhen: ({ req, isPlatformOperator }) => isPlatformOperator || require('../utils/roles').ALL_STAFF.includes(req.user?.role),
});

// TENANT-SCOPE-HOTFIX-3 — voir bandeau d'en-tête. `allowAnyStatus` n'a de
// sens que pour un PlatformOperator (mêmes garanties que
// `requireTenantScope`) ; sans objet pour le cas self-service visé ici,
// exposé uniquement par cohérence avec `resolveAndAttachTenantScope`.
const attachTenantScopeIfResolvable = async (req, res, next) => {
  try {
    await resolveAndAttachTenantScope(req);
  } catch {
    req.platformTenant = null;
    req.tenantScopeUserIds = null;
  }
  return next();
};

module.exports = {
  attachTenantContext, requireTenantScope, requireTenantScopeAllowPlatformWide,
  requireTenantScopeForStaffOrPlatformOperator, requireTenantScopeForAnalytics,
  requireTenantScopeForStaffAllowPlatformWide,
  attachTenantScopeIfResolvable,
};
