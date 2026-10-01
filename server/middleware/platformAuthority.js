const { resolveActiveOperator, hasCapability, isPlatformViewEligible } = require('../services/platformOperator/platformOperatorService');
const { resolveTenantMembership } = require('../services/tenantMembershipService');
const { resolveEffectiveTenantContext } = require('../services/platformTenant/tenantContextService');
const { PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS } = require('../constants/platformOperatorConstants');

/**
 * Global platform-administrator identity. This guard deliberately reads only
 * the authenticated User identity; tenant context and memberships are not
 * authority inputs for global administration.
 */
const requireGlobalAdmin = (req, res, next) => {
  if (req.user?.role === 'Admin') return next();
  return res.status(403).json({
    status: 'fail',
    message: 'Action refusée : identité administrateur plateforme requise.',
  });
};

const requestedTenantHeader = (req) => req.get?.('X-Platform-Tenant-Id') || req.get?.('X-Tenant-Id') || null;

// Un tenant explicitement sélectionné ET résolu (`platform_operator_selection`)
// — jamais la simple présence d'un en-tête, qu'un opérateur partiel pourrait
// forger pour contourner la gate d'éligibilité.
const hasResolvedTenantSelection = async (req, userId) => {
  if (req.platformTenant) return true;
  const header = requestedTenantHeader(req);
  if (!header) return false;
  const context = await resolveEffectiveTenantContext(userId, header).catch(() => null);
  return Boolean(context?.tenant && context.source === 'platform_operator_selection');
};

/**
 * Canonical platform authority: an active PlatformOperator carrying the
 * exact capability. User.role and tenant memberships are deliberately not
 * inputs to this platform-scoped decision.
 *
 * PLATFORM-ADMIN-04A — these surfaces are platform-native (they apply no
 * tenant filter of their own), so they are part of the Vue plateforme and
 * additionally require `isPlatformViewEligible`. `allowTenantSelection` is an
 * explicit, per-route opt-in reserved for routes whose downstream chain
 * verifiably enforces the selected tenant (strict tenant-scope middleware or
 * a tenant-scoped resource guard): with a tenant explicitly requested, the
 * partial operator keeps the existing tenant behavior; without one, the
 * request is a platform-scope request and eligibility is required.
 */
const requirePlatformOperatorCapability = (capability, { allowTenantSelection = false } = {}) => async (req, res, next) => {
  const operator = await resolveActiveOperator(req.user?._id || req.user?.id).catch(() => null);
  if (!operator || !hasCapability(operator, capability)) {
    return res.status(403).json({
      status: 'fail',
      message: 'Action refusée : capacité opérateur plateforme requise.',
    });
  }
  const tenantScopedUse = allowTenantSelection && await hasResolvedTenantSelection(req, req.user?._id || req.user?.id);
  if (!tenantScopedUse && !isPlatformViewEligible(operator)) {
    return res.status(403).json({
      status: 'fail',
      code: 'PLATFORM_VIEW_NOT_ELIGIBLE',
      message: 'Action refusée : la Vue plateforme est réservée aux administrateurs plateforme pleinement habilités.',
    });
  }
  req.isPlatformOperatorContext = true;
  req.platformOperatorCapabilities = operator.capabilities || [];
  req.platformOperator = operator;
  return next();
};

/**
 * PLATFORM-ADMIN-04A CLOSURE (H3) — platform-native SPECIALIZED workflow.
 * Authorizes exactly one capability of a declared workflow for an active
 * PlatformOperator, eligible or not. It never resolves or marks a platform
 * scope: no `platform_operator_unscoped`, no `isPlatformOperatorContext`, no
 * tenant context — only `req.platformNativeWorkflow`, which the workflow's own
 * handlers use to bound their resources. Misconfiguration fails at load time.
 * Never reads User.role.
 */
const requirePlatformNativeCapability = (capability, { workflow } = {}) => {
  const allowed = PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS[workflow];
  if (!allowed || !allowed.includes(capability)) {
    throw new Error(`[platformAuthority] Workflow platform-native non déclaré : ${workflow} / ${capability}`);
  }
  return async (req, res, next) => {
    const operator = await resolveActiveOperator(req.user?._id || req.user?.id).catch(() => null);
    if (!operator || !hasCapability(operator, capability)) {
      return res.status(403).json({ status: 'fail', message: 'Action refusée : capacité opérateur plateforme requise.' });
    }
    req.platformOperator = operator;
    req.platformNativeWorkflow = Object.freeze({ workflow, capability });
    return next();
  };
};

/**
 * Dual-mode route guard. Platform-wide mode requires the exact operator
 * capability; tenant mode requires a canonical active root membership with
 * one of the supplied business roles. The two authority sources never imply
 * one another.
 */
const requireTenantBusinessRoleOrPlatformCapability = ({ tenantRoles = [], platformCapability }) => async (req, res, next) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });

  if (req.isPlatformOperatorContext) {
    const operator = req.platformOperator || await resolveActiveOperator(userId).catch(() => null);
    if (hasCapability(operator, platformCapability)) {
      req.platformOperator = operator;
      req.platformOperatorCapabilities = operator.capabilities || [];
      req.platformAuthorityUsed = true;
      return next();
    }
    return res.status(403).json({ status: 'fail', message: 'Action refusée : capacité opérateur plateforme requise.' });
  }

  if (!req.platformTenant?._id) {
    return res.status(403).json({ status: 'fail', message: 'Contexte tenant requis.' });
  }
  const membership = await resolveTenantMembership(userId, req.platformTenant._id).catch(() => null);
  if (membership?.ambiguous) {
    return res.status(403).json({ status: 'fail', code: 'AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP', message: 'Adhésions actives multiples : accès refusé.' });
  }
  if (membership?.businessRole && tenantRoles.includes(membership.businessRole)) {
    req.tenantMembership = membership.membership;
    req.tenantBusinessRole = membership.businessRole;
    req.platformAuthorityUsed = false;
    return next();
  }
  return res.status(403).json({ status: 'fail', message: 'Autorité tenant ou capacité plateforme requise.' });
};

// Compose after tenant-context resolution on dual-mode staff routes. Legacy
// staff keeps its role capabilities; a recognized PlatformOperator must also
// hold the explicit cross-platform capability.
const requirePlatformOperatorCapabilityWhenPresent = (capability) => (req, res, next) => {
  if (!req.isPlatformOperatorContext) return next();
  if (hasCapability({ status: 'active', capabilities: req.platformOperatorCapabilities || [] }, capability)) return next();
  return res.status(403).json({
    status: 'fail',
    message: 'Action refusée : capacité opérateur plateforme requise.',
  });
};

module.exports = {
  requireGlobalAdmin,
  requirePlatformNativeCapability,
  requirePlatformOperatorCapability,
  requirePlatformOperatorCapabilityWhenPresent,
  requireTenantBusinessRoleOrPlatformCapability,
};
