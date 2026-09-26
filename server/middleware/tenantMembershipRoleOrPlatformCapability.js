// PLATFORM-SUPER-ADMIN OPTION-3 — compositional authority gate.
//
// Accepte l'accès à une route tenant-scopée si l'appelant satisfait AU MOINS
// UN des deux chemins d'autorité canoniques — jamais un troisième chemin
// implicite, jamais un bypass User.role, jamais un OrgMembership artificiel.
//
// PATH A — TENANT AUTHORITY :
//   - `req.platformTenant` résolu (via attachTenantContext / requireTenantScope) ;
//   - OrgMembership active de l'utilisateur dans ce tenant ;
//   - businessRole ∈ tenantRoles.
//
// PATH B — PLATFORM AUTHORITY :
//   - `req.platformTenant` résolu (l'opérateur DOIT sélectionner un tenant) ;
//   - PlatformOperator actif (via resolveActiveOperator) ;
//   - au moins une des capabilities platformCapabilities.
//
// Aucun des deux chemins ne substitue l'autre : PATH B ne satisfait pas
// PATH A (l'opérateur n'a pas de businessRole tenant), PATH A ne satisfait
// pas PATH B (le membre tenant n'a pas de capability plateforme). Toute
// mutation reste bornée à `req.platformTenant` par le service métier — cette
// garde ne fait qu'ouvrir/refuser l'entrée, la frontière tenant reste
// appliquée en aval par le service métier tenantMemberService.
//
// La protection last-admin distribuée (tenantMemberService.*) reste
// l'autorité invariante : ni un tenant Admin ni un PlatformOperator ne peut
// démoter/suspendre/révoquer le dernier Admin actif d'un tenant.

const { TENANT_BUSINESS_ROLES } = require('../constants/organizationConstants');
const { resolveTenantMembership } = require('../services/tenantMembershipService');
const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');
const { PLATFORM_OPERATOR_CAPABILITIES } = require('../constants/platformOperatorConstants');

const buildError = (code, message, statusCode = 403) => {
  const err = new Error(message);
  err.name = 'TenantMembershipRoleError';
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

function requireTenantMembershipRoleOrPlatformCapability({ tenantRoles, platformCapabilities } = {}) {
  const roles = Array.isArray(tenantRoles) ? tenantRoles : [];
  if (roles.length === 0) {
    throw new Error('requireTenantMembershipRoleOrPlatformCapability: tenantRoles requis (>=1).');
  }
  const invalidRoles = roles.filter((r) => !TENANT_BUSINESS_ROLES.includes(r));
  if (invalidRoles.length) {
    throw new Error(`requireTenantMembershipRoleOrPlatformCapability: rôle(s) invalide(s) [${invalidRoles.join(', ')}]`);
  }
  const capabilities = Array.isArray(platformCapabilities) ? platformCapabilities : [];
  if (capabilities.length === 0) {
    throw new Error('requireTenantMembershipRoleOrPlatformCapability: platformCapabilities requis (>=1).');
  }
  const invalidCaps = capabilities.filter((c) => !PLATFORM_OPERATOR_CAPABILITIES.includes(c));
  if (invalidCaps.length) {
    throw new Error(`requireTenantMembershipRoleOrPlatformCapability: capability(s) inconnue(s) [${invalidCaps.join(', ')}]`);
  }
  const allowedRoles = new Set(roles);

  return async function tenantMembershipOrPlatformGate(req, res, next) {
    try {
      const deny = (code, message, statusCode = 403) => {
        res.status(statusCode);
        return next(buildError(code, message, statusCode));
      };
      const userId = req.user?._id || req.user?.id;
      if (!userId) return deny('AUTH_REQUIRED', 'Authentification requise.', 401);

      const tenant = req.platformTenant;
      if (!tenant?._id) return deny('TENANT_CONTEXT_REQUIRED', 'Contexte tenant requis (sélectionnez un tenant).', 403);
      if (tenant.status === 'archived' || tenant.status === 'suspended') {
        return deny('TENANT_UNAVAILABLE', 'Tenant indisponible.', 403);
      }

      // PATH A — canonical tenant membership.
      const resolved = await resolveTenantMembership(userId, tenant._id);
      if (resolved && resolved.ambiguous) {
        return deny('AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', 'Adhésions actives multiples pour ce tenant — accès refusé.', 403);
      }
      if (resolved && resolved.businessRole && allowedRoles.has(resolved.businessRole)) {
        req.tenantMembership = resolved.membership;
        req.tenantBusinessRole = resolved.businessRole;
        req.tenantMembershipSource = resolved.source;
        req.platformAuthorityUsed = false;
        return next();
      }

      // PATH B — platform operator capability. Requires the caller to have
      // been recognised as an operator context by attachTenantContext OR
      // resolvable now via the platform operator service directly. In both
      // cases the operator must be ACTIVE and hold at least one required
      // platform capability. The tenant MUST already be selected explicitly
      // (checked above) — no automatic bypass of tenant selection.
      const operator = req.platformOperator || await resolveActiveOperator(userId).catch(() => null);
      if (operator && operator.status === 'active') {
        const grantedCap = capabilities.find((cap) => hasCapability(operator, cap));
        if (grantedCap) {
          req.platformAuthorityUsed = true;
          req.platformAuthorityCapability = grantedCap;
          if (!req.platformOperator) req.platformOperator = operator;
          if (!req.platformOperatorCapabilities?.length) req.platformOperatorCapabilities = operator.capabilities || [];
          req.isPlatformOperatorContext = true;
          return next();
        }
      }

      return deny('NO_TENANT_AUTHORITY_AND_NO_PLATFORM_CAPABILITY', "Autorité tenant ou capacité plateforme requise.", 403);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireTenantMembershipRoleOrPlatformCapability };
