// PLATFORM-ADMIN-1 — Registre central des capacités PlatformOperator.
// Une capacité = un droit granulaire d'agir transversalement sur la
// plateforme. Un opérateur ne reçoit que les capacités qui lui sont
// explicitement accordées (jamais un "god mode" implicite). Extensible sans
// changement cassant : ajouter une valeur ici n'affecte aucun opérateur
// existant (ses `capabilities[]` restent celles accordées au moment du
// grant).
const PLATFORM_OPERATOR_CAPABILITIES = [
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.users.read',
  'platform.users.manage',
  'platform.properties.read',
  'platform.properties.manage',
  'platform.rentals.read',
  'platform.rentals.manage',
  'platform.hotels.read',
  'platform.hotels.manage',
  'platform.accommodations.read',
  'platform.accommodations.manage',
  'platform.crm.read',
  'platform.crm.manage',
  'platform.finance.read',
  'platform.finance.manage',
  'platform.reporting.read',
  'platform.organization.read',
  'platform.organization.manage',
  'platform.marketing.read',
  'platform.marketing.manage',
  'platform.api.read',
  'platform.api.manage',
  'platform.audit.read',
  'platform.documents.read',
  'platform.documents.manage',
  'platform.support.impersonation',
  // Gouvernance de la capacité opérateur elle-même — distincte des autres :
  // seul un opérateur actif possédant CETTE capacité précise peut
  // accorder/suspendre/révoquer un autre opérateur (mission §44).
  'platform.operators.manage',
];

const PLATFORM_OPERATOR_STATUSES = ['active', 'suspended', 'revoked'];

module.exports = { PLATFORM_OPERATOR_CAPABILITIES, PLATFORM_OPERATOR_STATUSES };
