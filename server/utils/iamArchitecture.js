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

// RBAC-2 — capacités qui existent et sont réellement exigées par une route
// (`requireCapability(...)`) mais qu'AUCUN rôle staff nommé ne détient dans
// DEFAULT_CAPABILITIES — accessibles uniquement via les jokers `*` (Admin) et
// `legacy.full` (Collaborateur). Toujours réservées ainsi de façon
// délibérée, jamais un oubli : `payments.reverse` (annulation d'un
// encaissement, `paiementRoutes.js` → `POST /:id/receipts/:receiptId/cancel`)
// en est la preuve directe — le test `__tests__/rentalPaymentReceiptsAndCancellation
// .mongo.integration.test.js` ("IAM-3 : GestionnaireImmobilier ne peut pas
// annuler un encaissement") prouve que ce rôle doit rester exclu malgré le
// commentaire plus ancien et désormais inexact de `paiementController.js`
// (`CANCEL_ROLES`, code mort pour GestionnaireImmobilier — jamais atteint
// depuis que le guard de route existe). Cette liste sert uniquement à faire
// reconnaître la capacité par `assertKnownCapability` sans l'accorder à
// aucun rôle nommé — jamais à décider d'un accès.
const ADMIN_ONLY_CAPABILITIES = ['payments.reverse'];

// RBAC-2 — registre canonique des capacités réellement déclarées (union de
// toutes les valeurs de DEFAULT_CAPABILITIES + ADMIN_ONLY_CAPABILITIES, hors
// les deux jokers `*`/`legacy.full` qui ne sont pas des capacités nommées).
// Sert uniquement à valider qu'une capacité demandée à `requireCapability(...)`
// existe bien quelque part dans la table — jamais à décider d'un accès.
const ALL_CAPABILITIES = Object.freeze([
  ...new Set([
    ...Object.values(DEFAULT_CAPABILITIES).flat().filter((cap) => cap !== '*' && cap !== 'legacy.full'),
    ...ADMIN_ONLY_CAPABILITIES,
  ]),
]);

// RBAC-2 — lève une erreur de configuration claire (jamais un 403 silencieux)
// si une route référence une capacité qui n'existe dans aucune liste de
// DEFAULT_CAPABILITIES — typiquement une faute de frappe au moment d'écrire
// `requireCapability('propertie.read')`. Volontairement appelée au moment de
// la déclaration de la route (synchrone, au chargement du module), pas à
// chaque requête : une faute de frappe doit faire échouer le démarrage du
// serveur / les tests, jamais produire un 403 muet en production.
function assertKnownCapability(capability) {
  if (!ALL_CAPABILITIES.includes(capability)) {
    throw new Error(`[iamArchitecture] Capacité inconnue : "${capability}". Vérifier server/utils/iamArchitecture.js (DEFAULT_CAPABILITIES) — faute de frappe probable.`);
  }
}

// RBAC-2 — capacités effectives d'un rôle, forme préparatoire pour un futur
// payload /me (RBAC-3+). Pure fonction du rôle uniquement : ne résout ni
// HotelStaffAssignment, ni businessProfiles, ni tenant, ni ownership — ce
// sont des dimensions distinctes, jamais mélangées ici (voir RBAC2_REPORT.md
// §Principe architectural). Non exposée par aucune route dans ce sprint.
function getEffectiveCapabilities(role) {
  const capabilities = DEFAULT_CAPABILITIES[role] || [];
  if (capabilities.includes('*')) return [...ALL_CAPABILITIES];
  if (capabilities.includes('legacy.full')) return [...ALL_CAPABILITIES];
  return [...capabilities];
}

module.exports = {
  ACCOUNT_FAMILIES, STAFF_FUNCTIONS, DEFAULT_CAPABILITIES, ROLE_PROJECTION,
  projectLegacyRole, hasDefaultCapability,
  ALL_CAPABILITIES, ADMIN_ONLY_CAPABILITIES, assertKnownCapability, getEffectiveCapabilities,
};
