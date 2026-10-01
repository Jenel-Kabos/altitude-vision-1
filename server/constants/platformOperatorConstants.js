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
  // Marketplace commercial (non-financial) platform operations —
  // independent of platform.finance.*; never implied by finance.manage.
  'platform.commercial.manage',
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
  'platform.tenant_applications.read',
  'platform.tenant_applications.review',
  'platform.tenant_applications.request_changes',
  'platform.tenant_applications.approve',
  'platform.tenant_applications.reject',
  'platform.support.impersonation',
  // Lecture de la file support, distincte d'une éventuelle
  // capacité d'impersonation utilisée par des outils d'assistance.
  'platform.support.read',
  // Gouvernance de la capacité opérateur elle-même — distincte des autres :
  // seul un opérateur actif possédant CETTE capacité précise peut
  // accorder/suspendre/révoquer un autre opérateur (mission §44).
  'platform.operators.manage',
];

const PLATFORM_OPERATOR_STATUSES = ['active', 'suspended', 'revoked'];

// PLATFORM-ADMIN-04A — Éligibilité à la Vue plateforme (scope global).
// Seul un opérateur actif détenant TOUTES les capabilities requises peut
// entrer dans le scope plateforme ; chaque action y reste ensuite gardée par
// sa capability métier. La liste requise est DÉRIVÉE du registre ci-dessus
// moins les exclusions documentées ci-dessous — jamais une seconde liste
// manuelle. Conséquence assumée : ajouter une capability au registre rend
// inéligibles les administrateurs existants tant qu'elle ne leur est pas
// accordée (snapshot dans platformViewEligibility.test.js).
const PLATFORM_VIEW_EXCLUDED_CAPABILITIES = Object.freeze({
  'platform.support.impersonation':
    "Capacité break-glass de support (agir au nom d'un utilisateur) : l'exiger forcerait chaque administrateur plateforme à détenir le pouvoir le plus sensible du registre, contraire au moindre privilège (décision H1, PA-04).",
});

const PLATFORM_VIEW_REQUIRED_CAPABILITIES = Object.freeze(
  PLATFORM_OPERATOR_CAPABILITIES.filter(
    (capability) => !Object.prototype.hasOwnProperty.call(PLATFORM_VIEW_EXCLUDED_CAPABILITIES, capability),
  ),
);

// PLATFORM-ADMIN-04A — sources de contexte opérateur sans tenant. Définies
// ici (module sans dépendance) pour que le prédicat canonique ne dépende
// jamais d'un service mockable : une constante absente doit échouer FERMÉ.
const PLATFORM_WIDE_CONTEXT_SOURCE = 'platform_operator_unscoped';
const PLATFORM_VIEW_FORBIDDEN_CONTEXT_SOURCE = 'platform_operator_platform_view_forbidden';

// PLATFORM-ADMIN-04A CLOSURE (H3) — workflows platform-native SPÉCIALISÉS.
// Distincts de la Vue plateforme : un opérateur PARTIEL détenant la
// capability exacte peut exercer CE workflow global (ressources propres au
// workflow uniquement), sans jamais obtenir `platform_operator_unscoped` ni
// un scope réutilisable ailleurs. Liste fermée : toute nouvelle entrée est une
// décision d'autorité explicite (testée).
//   - tenant_applications : instruction des demandes d'activation (pas de
//     donnée tenant) ; séparation read/review/request_changes/approve/reject.
//   - support_inbox : inbox support transverse, bornée aux conversations
//     `isStaffInbox` (aucun message direct, aucune conversation privée).
const PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS = Object.freeze({
  tenant_applications: Object.freeze([
    'platform.tenant_applications.read',
    'platform.tenant_applications.review',
    'platform.tenant_applications.request_changes',
    'platform.tenant_applications.approve',
    'platform.tenant_applications.reject',
  ]),
  support_inbox: Object.freeze(['platform.support.read']),
});

module.exports = {
  PLATFORM_NATIVE_SPECIALIZED_WORKFLOWS,
  PLATFORM_WIDE_CONTEXT_SOURCE,
  PLATFORM_VIEW_FORBIDDEN_CONTEXT_SOURCE,
  PLATFORM_OPERATOR_CAPABILITIES,
  PLATFORM_OPERATOR_STATUSES,
  PLATFORM_VIEW_EXCLUDED_CAPABILITIES,
  PLATFORM_VIEW_REQUIRED_CAPABILITIES,
};
