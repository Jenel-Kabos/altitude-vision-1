// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1B — service canonique de résolution
// d'une membership tenant.
//
// Autorité: `PlatformTenant.rootOrgUnit` → `OrgMembership` (status:'active').
// Un `businessRole` renseigné sur une membership racine active est la seule
// autorité métier pour ce (user, tenant). Une membership sans businessRole
// reste sans autorité : User.role est une identité globale orthogonale.
//
// NE JAMAIS :
//   - utiliser body.tenant / body.tenantId / header comme autorité ;
//   - considérer PlatformOperator comme membre tenant ;
//   - considérer un Property.owner / Reservation.client externe comme
//     membre tenant sans OrgMembership explicite.

const mongoose = require('mongoose');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');

const isValidId = (id) => id && mongoose.isValidObjectId(id);
const asId = (v) => (v && v._id ? v._id : v);

/**
 * Trouve la membership tenant canonique pour (userId, tenantId).
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} tenantId
 * @returns {Promise<null | {
 *   membership: object,
 *   tenant: object,
 *   businessRole: string | null,
 *   roleInUnit: string,
 *   status: 'active',
 *   source: 'membership_business_role' | null,
 * }>}
 */
async function resolveTenantMembership(userId, tenantId) {
  if (!isValidId(userId) || !isValidId(tenantId)) return null;
  const tenant = await PlatformTenant.findById(tenantId).lean();
  if (!tenant?.rootOrgUnit) return null;
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-1C — le partial-unique index
  // canonique porte sur (user, orgUnit, roleInUnit) status:'active'. Deux
  // roleInUnit actifs différents peuvent donc coexister sur la même racine
  // tenant. Autoriser findOne() arbitrairement choisirait "silencieusement"
  // l'une des memberships — impossible à sécuriser pour une décision RBAC.
  // Fail-closed en cas d'ambiguïté : le middleware caller renvoie 403 avec
  // le code AMBIGUOUS_ACTIVE_TENANT_MEMBERSHIP.
  const active = await OrgMembership.find({
    user: asId(userId),
    orgUnit: tenant.rootOrgUnit,
    status: 'active',
  }).lean();
  if (active.length === 0) return null;
  if (active.length > 1) {
    return { ambiguous: true, memberships: active, tenant, businessRole: null, source: null };
  }
  const membership = active[0];
  if (membership.businessRole) {
    return {
      membership, tenant,
      businessRole: membership.businessRole,
      roleInUnit: membership.roleInUnit,
      status: membership.status,
      source: 'membership_business_role',
    };
  }
  return {
    membership, tenant, businessRole: null,
    roleInUnit: membership.roleInUnit,
    status: membership.status,
    source: null,
  };
}

module.exports = { resolveTenantMembership };
