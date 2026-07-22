// client/lib/constants/maintenance.js — Sprint E, synchronisé avec
// server/models/MaintenanceTicket.js.

export const MAINTENANCE_CATEGORIES = [
  { value: 'plumbing', label: 'Plomberie' },
  { value: 'electricity', label: 'Électricité' },
  { value: 'furniture', label: 'Mobilier' },
  { value: 'cleanliness', label: 'Propreté' },
  { value: 'security', label: 'Sécurité' },
  { value: 'other', label: 'Autre' },
];

export const MAINTENANCE_STATUSES = [
  { value: 'open', label: 'Ouvert' },
  { value: 'assigned', label: 'Assigné' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Clôturé' },
];

export const MAINTENANCE_STATUS_CLASSES = {
  open: 'bg-red-100 text-red-700',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
};
