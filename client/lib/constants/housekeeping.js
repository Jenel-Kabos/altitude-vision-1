// client/lib/constants/housekeeping.js — Sprint E, synchronisé avec
// server/models/HousekeepingTask.js.

export const HOUSEKEEPING_TYPES = [
  { value: 'checkout_cleaning', label: 'Nettoyage départ' },
  { value: 'refresh', label: 'Rafraîchissement' },
  { value: 'deep_cleaning', label: 'Nettoyage approfondi' },
];

export const HOUSEKEEPING_PRIORITIES = [
  { value: 'low', label: 'Basse' },
  { value: 'normal', label: 'Normale' },
  { value: 'high', label: 'Haute' },
  { value: 'urgent', label: 'Urgente' },
];

export const HOUSEKEEPING_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'assigned', label: 'Assignée' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
  { value: 'cancelled', label: 'Annulée' },
];

export const HOUSEKEEPING_STATUS_CLASSES = {
  pending: 'bg-amber-100 text-amber-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_CLASSES = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-700',
};
