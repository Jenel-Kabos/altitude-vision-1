// TENANT-CORE-1 (Phase 4) — Middleware d'isolation, opt-in par route
// (jamais monté globalement — voir tenantContextService.js pour la
// justification). Deux niveaux :
//   attachTenantContext  — résout req.platformTenant si possible, ne bloque
//                           jamais (utile aux routes qui personnalisent sans
//                           exiger un tenant, ex. branding public).
//   requireTenantScope   — exige un tenant résolu, 403 sinon.
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

const attachTenantContext = async (req, res, next) => {
  try {
    req.platformTenant = req.user ? await resolveTenantForUser(req.user._id || req.user.id) : null;
  } catch {
    req.platformTenant = null;
  }
  next();
};

const requireTenantScope = async (req, res, next) => {
  await attachTenantContext(req, res, () => {});
  if (!req.platformTenant) {
    res.status(403);
    return next(new Error("Accès refusé : aucun tenant SaaS résolu pour cet utilisateur."));
  }
  if (req.platformTenant.status === 'suspended') {
    res.status(403);
    return next(new Error('Accès refusé : ce tenant est suspendu.'));
  }
  return next();
};

module.exports = { attachTenantContext, requireTenantScope };
