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

// Documents + paiements
// Correctif Sprint GL-B2 : GestionnaireImmobilier voyait le lien "Documents"
// dans la sidebar (ROLES_DOCS l'inclut déjà) mais recevait un 403 réel sur
// GET /api/documents et les routes de génération documentaire locative
// (gestionDocumentRoutes/contratRoutes docOnly, toutes basées sur STAFF_DOC)
// — incohérence entre navigation et API, corrigée ici plutôt qu'en
// dupliquant une nouvelle constante.
const STAFF_DOC  = ['Admin', 'Secretaire', 'Collaborateur'];

// Gestion immobilière : proprio, biens, locataires, contrats
const STAFF_IMMO = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];

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

// Altimmo (biens)
const ROLES_ALTIMMO = [
  'Admin', 'Collaborateur', 'GestionnaireImmobilier',
];

// Mila Events + Altcom
const ROLES_CM = [
  'Admin', 'Collaborateur', 'CommunityManager',
];

// Gestion Locative (lecture + gestion)
const ROLES_GL = [
  'Admin', 'Collaborateur', 'GestionnaireImmobilier',
];

// Paiements Gestion Locative
const ROLES_PAIEMENTS = [
  'Admin', 'Collaborateur', 'Secretaire',
];

// Documents
const ROLES_DOCS = [
  'Admin', 'Collaborateur', 'Secretaire',
];

// Litiges (+ GestionnaireImmobilier)
const ROLES_LITIGES = [
  'Admin', 'Collaborateur', 'GestionnaireImmobilier',
];

// Modération
const ROLES_MODERATION = ['Admin', 'Collaborateur'];

module.exports = {
  COLLAB_ROLES, STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM, ROLE_LABELS,
  ROLES, ALL_STAFF, ROLES_UNIVERSAL,
  ROLES_ESTIMATION, ROLES_ALTIMMO, ROLES_CM,
  ROLES_GL, ROLES_PAIEMENTS, ROLES_DOCS,
  ROLES_LITIGES, ROLES_MODERATION,
};
