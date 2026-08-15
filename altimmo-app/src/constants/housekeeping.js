// SYNC-2B — miroir de client/lib/constants/housekeeping.js, lui-même
// synchronisé avec server/models/HousekeepingTask.js. Aucune valeur
// inventée ; les trois copies doivent rester identiques.

export const HOUSEKEEPING_TYPE_LABELS = {
  checkout_cleaning: 'Nettoyage départ',
  refresh: 'Rafraîchissement',
  deep_cleaning: 'Nettoyage approfondi',
};

export const HOUSEKEEPING_PRIORITY_LABELS = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

export const HOUSEKEEPING_STATUS_LABELS = {
  pending: 'En attente',
  assigned: 'Assignée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
