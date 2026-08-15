// SYNC-2B — miroir de client/lib/constants/maintenance.js, lui-même
// synchronisé avec server/models/MaintenanceTicket.js (maintenance
// HÔTELIÈRE, distincte de la maintenance locative GL). Aucune valeur
// inventée ; les trois copies doivent rester identiques.

export const MAINTENANCE_CATEGORY_LABELS = {
  plumbing: 'Plomberie',
  electricity: 'Électricité',
  furniture: 'Mobilier',
  cleanliness: 'Propreté',
  security: 'Sécurité',
  other: 'Autre',
};

export const MAINTENANCE_STATUS_LABELS = {
  open: 'Ouvert',
  assigned: 'Assigné',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Clôturé',
};
