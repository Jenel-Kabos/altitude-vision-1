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
const STAFF_DOC  = ['Admin', 'Secretaire', 'Collaborateur'];

// Gestion immobilière : proprio, biens, locataires, contrats
const STAFF_IMMO = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];

// Content publishing : biens Altimmo, événements, portfolios
const STAFF_CM   = ['Admin', 'CommunityManager', 'GestionnaireImmobilier', 'Collaborateur'];

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

module.exports = { COLLAB_ROLES, STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM, ROLE_LABELS };
