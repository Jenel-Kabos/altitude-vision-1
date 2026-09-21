// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-G — canonical membership
// resolver for MIXED owner/tenant endpoints.
//
// Composes AFTER `protect`. When a tenant context can be resolved (via
// `X-Platform-Tenant-Id` header or the user's single available tenant),
// this middleware populates:
//   req.platformTenant           (the resolved tenant document)
//   req.tenantMembership         (the caller's active OrgMembership on it)
//   req.tenantBusinessRole       (canonical businessRole from the membership)
//   req.tenantMembershipSource   ('membership_business_role' or null)
//
// Never throws. Never denies. Never falls back to `User.role`. Never reads
// body/query. Suspended/revoked memberships resolve to a null businessRole
// (they are `status !== 'active'` and therefore excluded by
// `resolveTenantMembership` at the source).
//
// Downstream MIXED handlers (updateProperty/deleteProperty) branch on:
//   • `Property.owner === req.user.id`        → OWNER path (no tenant needed)
//   • `req.tenantBusinessRole` + `Property.tenant === req.platformTenant._id`
//                                              → TENANT STAFF path
// Anything else → 403 refused by the handler.

const { resolveEffectiveTenantContext } = require('../services/platformTenant/tenantContextService');
const { resolveTenantMembership } = require('../services/tenantMembershipService');

const requestedTenant = (req) => req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;

async function resolveTenantMembershipIfPresent(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return next();
    // Try to resolve a tenant. If nothing resolves, we simply proceed with
    // no tenant context — the downstream handler falls back to the OWNER
    // branch (or refuses if the caller is neither owner nor tenant staff).
    const context = await resolveEffectiveTenantContext(userId, requestedTenant(req)).catch(() => null);
    const tenant = context?.tenant || null;
    if (!tenant?._id) return next();
    req.platformTenant = tenant;
    req.tenantContextSource = context?.source || null;
    // Canonical membership lookup — no legacy fallback (matches Lot 2D
    // semantics). Suspended/revoked → not returned. Ambiguous → not used.
    const resolved = await resolveTenantMembership(userId, tenant._id, { allowLegacyRoleFallback: false }).catch(() => null);
    if (!resolved || resolved.ambiguous) return next();
    if (!resolved.businessRole) return next();
    req.tenantMembership = resolved.membership;
    req.tenantBusinessRole = resolved.businessRole;
    req.tenantMembershipSource = resolved.source;
    return next();
  } catch { return next(); }
}

module.exports = { resolveTenantMembershipIfPresent };
