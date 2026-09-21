// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1C — autorité canonique tenant-scoped.
//
// requireTenantMembershipRole(...allowedBusinessRoles)
//
// Contrat :
//   - protect + attachTenantContext DOIVENT s'exécuter avant (fournissent
//     `req.user` et `req.platformTenant` déjà validé, jamais un tenant
//     forgé issu du body/header non résolu).
//   - Le middleware ne fait JAMAIS confiance à `User.role` seul, ni à
//     `req.body.tenant*`, ni à `X-Platform-Tenant-Id` sans passer par le
//     tenantContext canonique déjà attaché.
//   - PlatformOperator seul NE satisfait PAS ce middleware — les routes
//     qui autorisent aussi les opérateurs plateforme doivent composer
//     `requirePlatformOperatorCapability(...)` explicitement en amont ou
//     en alternative, jamais via un bypass implicite ici.
//
// Aucun fallback User.role : la businessRole de la membership active est
// l'unique source d'autorité tenant.
//
// Configuration invalide (rôle non listé dans TENANT_BUSINESS_ROLES) :
// throw au montage — impossible d'atteindre la production. Fail fast.

const { TENANT_BUSINESS_ROLES } = require('../constants/organizationConstants');
const { resolveTenantMembership } = require('../services/tenantMembershipService');

const buildError = (code, message, statusCode = 403) => {
  const err = new Error(message);
  err.name = 'TenantMembershipRoleError';
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

function requireTenantMembershipRole(...rest) {
  // Deux formes d'appel :
  //   requireTenantMembershipRole('Admin', 'GestionnaireImmobilier')
  //   requireTenantMembershipRole({ roles })
  let allowedBusinessRoles;
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    allowedBusinessRoles = Array.isArray(rest[0].roles) ? rest[0].roles : [];
  } else {
    allowedBusinessRoles = rest;
  }
  if (!allowedBusinessRoles.length) {
    throw new Error('requireTenantMembershipRole: at least one businessRole is required.');
  }
  const invalid = allowedBusinessRoles.filter((r) => !TENANT_BUSINESS_ROLES.includes(r));
  if (invalid.length) {
    throw new Error(`requireTenantMembershipRole: invalid role(s) [${invalid.join(', ')}] — must be one of ${TENANT_BUSINESS_ROLES.join(', ')}.`);
  }
  const allowed = new Set(allowedBusinessRoles);

  return async function tenantMembershipRoleMiddleware(req, res, next) {
    try {
      const deny = (code, message, statusCode = 403) => {
        // errorHandler lit `res.statusCode` — le poser explicitement garantit
        // que le refus canonique ne soit pas remonté en 500 par le mapper.
        res.status(statusCode);
        return next(buildError(code, message, statusCode));
      };
      if (!req.user?._id && !req.user?.id) return deny('AUTH_REQUIRED', 'Authentification requise.', 401);
      // `req.platformTenant` provient de `attachTenantContext` (jamais du
      // body/header brut). Absence = pas de tenant canonique résolu.
      const tenant = req.platformTenant;
      if (!tenant?._id) return deny('TENANT_CONTEXT_REQUIRED', 'Contexte tenant requis.', 403);
      // PlatformTenant status : refus explicite d'archived/suspended.
      if (tenant.status === 'archived' || tenant.status === 'suspended') {
        return deny('TENANT_UNAVAILABLE', 'Tenant indisponible.', 403);
      }
      const resolved = await resolveTenantMembership(req.user._id || req.user.id, tenant._id);
      if (!resolved) return deny('NO_ACTIVE_TENANT_MEMBERSHIP', 'Aucune adhésion tenant active.', 403);
      if (resolved.ambiguous) return deny('AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', 'Adhésions actives multiples pour ce tenant — accès refusé.', 403);
      if (!resolved.businessRole || !allowed.has(resolved.businessRole)) {
        return deny('INSUFFICIENT_TENANT_MEMBERSHIP_ROLE', 'Rôle métier tenant insuffisant.', 403);
      }
      req.tenantMembership = resolved.membership;
      req.tenantBusinessRole = resolved.businessRole;
      req.tenantMembershipSource = resolved.source;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireTenantMembershipRole };
