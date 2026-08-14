// IAM-2 — projection additive de User.role vers familles/fonctions et
// capacités cibles. Elle ne remplace aucun guard, tenant scope ou ownership.
const ACCOUNT_FAMILIES = Object.freeze({ ADMIN: 'ADMIN', STAFF: 'STAFF', OWNER: 'OWNER', CLIENT: 'CLIENT', LEGACY: 'LEGACY' });
const STAFF_FUNCTIONS = Object.freeze({
  SECRETARY: 'SECRETARY', REAL_ESTATE_MANAGER: 'REAL_ESTATE_MANAGER',
  COMMUNITY_MANAGER: 'COMMUNITY_MANAGER', COMMUNICATION: 'COMMUNICATION', LEGACY_FULL: 'LEGACY_FULL',
});
const DEFAULT_CAPABILITIES = Object.freeze({
  Admin: ['*'],
  Secretaire: ['documents.read', 'documents.manage', 'payments.read', 'payments.manage', 'clients.read', 'owners.read', 'tenants.read', 'leases.read', 'properties.read'],
  GestionnaireImmobilier: ['properties.read', 'properties.create', 'properties.update', 'owners.read', 'tenants.read', 'tenants.manage', 'visits.read', 'visits.manage', 'rental.read', 'rental.manage', 'leases.read', 'leases.manage', 'maintenance.read', 'maintenance.manage', 'notice.read', 'notice.manage', 'occupancy.read', 'occupancy.manage', 'payment.status'],
  CommunityManager: ['altcom.read', 'altcom.manage', 'events.read', 'events.manage', 'media.read', 'media.manage'],
  Communicant: ['messages.read', 'messages.manage', 'visits.read'],
  Collaborateur: ['legacy.full'],
  Proprietaire: ['properties.own', 'accommodation.own'],
  Client: ['client.self'], User: ['client.self'], Prestataire: ['provider.self'],
});
const ROLE_PROJECTION = Object.freeze({
  Admin: { accountFamily: ACCOUNT_FAMILIES.ADMIN, staffFunction: null },
  Secretaire: { accountFamily: ACCOUNT_FAMILIES.STAFF, staffFunction: STAFF_FUNCTIONS.SECRETARY },
  GestionnaireImmobilier: { accountFamily: ACCOUNT_FAMILIES.STAFF, staffFunction: STAFF_FUNCTIONS.REAL_ESTATE_MANAGER },
  CommunityManager: { accountFamily: ACCOUNT_FAMILIES.STAFF, staffFunction: STAFF_FUNCTIONS.COMMUNITY_MANAGER },
  Communicant: { accountFamily: ACCOUNT_FAMILIES.STAFF, staffFunction: STAFF_FUNCTIONS.COMMUNICATION },
  Collaborateur: { accountFamily: ACCOUNT_FAMILIES.STAFF, staffFunction: STAFF_FUNCTIONS.LEGACY_FULL },
  Proprietaire: { accountFamily: ACCOUNT_FAMILIES.OWNER, staffFunction: null },
  Client: { accountFamily: ACCOUNT_FAMILIES.CLIENT, staffFunction: null },
  User: { accountFamily: ACCOUNT_FAMILIES.CLIENT, staffFunction: null },
  Prestataire: { accountFamily: ACCOUNT_FAMILIES.LEGACY, staffFunction: null },
});
function projectLegacyRole(role) {
  return { role, ...(ROLE_PROJECTION[role] || { accountFamily: ACCOUNT_FAMILIES.LEGACY, staffFunction: null }), defaultCapabilities: [...(DEFAULT_CAPABILITIES[role] || [])] };
}
function hasDefaultCapability(role, capability) {
  const capabilities = DEFAULT_CAPABILITIES[role] || [];
  return capabilities.includes('*') || capabilities.includes('legacy.full') || capabilities.includes(capability);
}
module.exports = { ACCOUNT_FAMILIES, STAFF_FUNCTIONS, DEFAULT_CAPABILITIES, ROLE_PROJECTION, projectLegacyRole, hasDefaultCapability };
