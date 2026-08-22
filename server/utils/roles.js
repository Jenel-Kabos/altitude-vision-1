/**
 * Groupes de rôles collaborateurs — source unique de vérité.
 *
 * Secrétaire          → documents, paiements
 * GestionnaireImmo    → propriétaires, biens, locataires, contrats
 * CommunityManager    → biens Altimmo, événements Mila Events, portfolios Altcom
 * Communicant         → messages + RDV (partagé par TOUS les collaborateurs)
 */

// Tous les sous-rôles collaborateurs (hors Admin)
const COLLAB_ROLES = [
  'Secretaire',
  'GestionnaireImmobilier',
  'CommunityManager',
  'Communicant',
  'Collaborateur', // legacy — garde l'accès complet pour ne pas bloquer les comptes existants
];

// Accès complet staff (Admin + tout collaborateur) — tableau de bord, messages, RDV
const STAFF_ALL  = ['Admin', ...COLLAB_ROLES];

// RBAC-5 — Documents + paiements : STAFF_DOC/ROLES_PAIEMENTS/ROLES_DOCS
// contenaient la même valeur d'ensemble sous 3 noms distincts, déclarée 3
// fois séparément (RBAC2_REPORT.md §46b, dette explicitement notée mais
// laissée hors périmètre de RBAC-2) — désormais 3 alias stricts de cette
// unique référence. Aucun changement de comportement : `.includes()`/spread
// sont insensibles à l'ordre, et aucun test n'affirme un ordre précis
// (vérifié avant ce changement — voir server/docs/RBAC5_CLEANUP_MATRIX.md).
//
// Historique conservé pour mémoire (Correctif Sprint GL-B2) : GestionnaireImmobilier
// voyait le lien "Documents" dans la sidebar (ROLES_DOCS l'inclut déjà) mais
// recevait un 403 réel sur GET /api/documents et les routes de génération
// documentaire locative (gestionDocumentRoutes/contratRoutes docOnly, toutes
// basées sur STAFF_DOC) — incohérence entre navigation et API, corrigée à
// l'époque plutôt qu'en dupliquant une nouvelle constante.
const CANONICAL_DOC_STAFF_ROLES = ['Admin', 'Secretaire', 'Collaborateur'];

const STAFF_DOC  = CANONICAL_DOC_STAFF_ROLES;

// RBAC-2 — Gestion immobilière : proprio, biens, locataires, contrats,
// litiges. STAFF_IMMO/ROLES_ALTIMMO/ROLES_GL/ROLES_LITIGES (ci-dessous)
// contenaient la même valeur d'ensemble sous 4 noms distincts (RBAC-1
// §Duplication) — désormais 4 alias stricts de cette unique référence.
// Aucun changement de comportement : `.includes()`/spread sont
// insensibles à l'ordre, et aucun test n'affirme un ordre précis
// (vérifié avant ce changement).
const CANONICAL_IMMO_STAFF_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];

// Gestion immobilière : proprio, biens, locataires, contrats
const STAFF_IMMO = CANONICAL_IMMO_STAFF_ROLES;

// Content publishing : biens Altimmo, événements, portfolios
const STAFF_CM   = ['Admin', 'CommunityManager', 'Collaborateur'];

// Messages clients + confirmation RDV (tous les collaborateurs)
const STAFF_COMM = STAFF_ALL;

// Étiquettes lisibles pour l'affichage UI
const ROLE_LABELS = {
  Admin:                 'Administrateur',
  Collaborateur:         'Collaborateur',
  Secretaire:            'Secrétaire',
  GestionnaireImmobilier:'Gestionnaire Immobilier',
  CommunityManager:      'Community Manager',
  Communicant:           'Communicant',
  Client:                'Client',
  Proprietaire:          'Propriétaire',
  Prestataire:           'Prestataire',
};

// ══════════════════════════════════════════════════════════════════════════
// Groupes par périmètre métier (nommage ROLES_* — même source de rôles que
// ci-dessus, regroupements additionnels pour estimation/devis/GL/litiges).
// ══════════════════════════════════════════════════════════════════════════

const ROLES = {
  ADMIN:             'Admin',
  COLLABORATEUR:     'Collaborateur',
  GESTIONNAIRE_IMMO: 'GestionnaireImmobilier',
  SECRETAIRE:        'Secretaire',
  COMMUNITY_MANAGER: 'CommunityManager',
  COMMUNICANT:       'Communicant',
};

const ALL_STAFF = Object.values(ROLES);

// Universel — tous les rôles staff
const ROLES_UNIVERSAL = ALL_STAFF;

// Estimations + Devis
const ROLES_ESTIMATION = [
  'Admin', 'Collaborateur', 'GestionnaireImmobilier',
  'Secretaire', 'Communicant',
];

// Altimmo (biens) — alias de CANONICAL_IMMO_STAFF_ROLES, voir RBAC-2 ci-dessus.
const ROLES_ALTIMMO = CANONICAL_IMMO_STAFF_ROLES;

// Mila Events + Altcom
const ROLES_CM = [
  'Admin', 'Collaborateur', 'CommunityManager',
];

// Gestion Locative (lecture + gestion) — alias de CANONICAL_IMMO_STAFF_ROLES.
const ROLES_GL = CANONICAL_IMMO_STAFF_ROLES;

// Paiements Gestion Locative — alias de CANONICAL_DOC_STAFF_ROLES, voir RBAC-5 ci-dessus.
const ROLES_PAIEMENTS = CANONICAL_DOC_STAFF_ROLES;

// Documents — alias de CANONICAL_DOC_STAFF_ROLES, voir RBAC-5 ci-dessus.
const ROLES_DOCS = CANONICAL_DOC_STAFF_ROLES;

// Litiges (+ GestionnaireImmobilier) — alias de CANONICAL_IMMO_STAFF_ROLES.
const ROLES_LITIGES = CANONICAL_IMMO_STAFF_ROLES;

// Modération
const ROLES_MODERATION = ['Admin', 'Collaborateur'];

module.exports = {
  COLLAB_ROLES, STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM, ROLE_LABELS,
  ROLES, ALL_STAFF, ROLES_UNIVERSAL,
  ROLES_ESTIMATION, ROLES_ALTIMMO, ROLES_CM,
  ROLES_GL, ROLES_PAIEMENTS, ROLES_DOCS,
  ROLES_LITIGES, ROLES_MODERATION,
  CANONICAL_IMMO_STAFF_ROLES,
  CANONICAL_DOC_STAFF_ROLES,
};
