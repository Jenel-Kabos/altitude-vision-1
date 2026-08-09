// TENANT-CORE-1 (Phase 4) — Middleware d'isolation, opt-in par route
// (jamais monté globalement — voir tenantContextService.js pour la
// justification). Deux niveaux :
//   attachTenantContext  — résout req.platformTenant si possible, ne bloque
//                           jamais (utile aux routes qui personnalisent sans
//                           exiger un tenant, ex. branding public).
//   requireTenantScope   — exige un tenant résolu, 403 sinon.
const { resolveTenantForUser, resolveAvailableTenantsForUser } = require('../services/platformTenant/tenantContextService');

const requestedTenant = (req) => req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;

const attachTenantContext = async (req, res, next) => {
  try {
    req.platformTenant = req.user ? await resolveTenantForUser(req.user._id || req.user.id, requestedTenant(req)) : null;
  } catch {
    req.platformTenant = null;
  }
  next();
};

const requireTenantScope = async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  const explicitTenantId = requestedTenant(req);
  const available = userId ? await resolveAvailableTenantsForUser(userId).catch(() => []) : [];
  req.platformTenant = userId ? await resolveTenantForUser(userId, explicitTenantId).catch(() => null) : null;
  if (!req.platformTenant) {
    res.status(403);
    const message = explicitTenantId
      ? "Accès refusé : le tenant demandé n'est pas accessible à cet utilisateur."
      : available.length > 1
        ? 'Contexte tenant ambigu : sélectionnez explicitement un tenant accessible.'
        : 'Accès refusé : aucun tenant SaaS actif résolu pour cet utilisateur.';
    return next(new Error(message));
  }
  const scope = await require('../services/platformTenant/tenantContextService').resolveTenantScope(req.platformTenant._id);
  req.tenantScopeUserIds = scope.scopeUserIds;
  return next();
};

module.exports = { attachTenantContext, requireTenantScope };
