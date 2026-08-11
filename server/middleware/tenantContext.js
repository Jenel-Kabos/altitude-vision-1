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

const requireTenantScope = async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  const explicitTenantId = requestedTenant(req);
  const available = userId ? await resolveAvailableTenantsForUser(userId).catch(() => []) : [];
  const context = userId ? await resolveEffectiveTenantContext(userId, explicitTenantId).catch(() => null) : null;
  req.platformTenant = context?.tenant || null;
  req.tenantContextSource = context?.source || null;
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
  return next();
};

module.exports = { attachTenantContext, requireTenantScope };
