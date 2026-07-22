// client/lib/constants/room.js — Sprint D, synchronisé avec
// server/models/Room.js (ROOM_STATUSES/ROOM_STATUS_TRANSITIONS).
// Pas de statut 'maintenance' — réservé au Sprint E (Housekeeping/Maintenance).

export const ROOM_STATUSES = [
  { value: 'available', label: 'Disponible', color: 'green' },
  { value: 'reserved', label: 'Réservée', color: 'blue' },
  { value: 'occupied', label: 'Occupée', color: 'red' },
  { value: 'cleaning', label: 'Nettoyage', color: 'amber' },
  { value: 'inspection', label: 'Inspection', color: 'purple' },
  { value: 'out_of_service', label: 'Hors service', color: 'gray' },
];

export const ROOM_STATUS_CLASSES = {
  available: 'bg-green-100 text-green-800',
  reserved: 'bg-blue-100 text-blue-800',
  occupied: 'bg-red-100 text-red-700',
  cleaning: 'bg-amber-100 text-amber-800',
  inspection: 'bg-purple-100 text-purple-800',
  out_of_service: 'bg-gray-200 text-gray-600',
};

// Miroir de Room.ROOM_STATUS_TRANSITIONS (server) — utilisé pour ne proposer
// dans les menus déroulants que les transitions manuelles autorisées.
export const ROOM_STATUS_TRANSITIONS = {
  available: ['reserved', 'occupied', 'out_of_service'],
  reserved: ['occupied', 'available', 'out_of_service'],
  occupied: ['cleaning', 'out_of_service'],
  cleaning: ['inspection', 'available', 'out_of_service'],
  inspection: ['available', 'cleaning', 'out_of_service'],
  out_of_service: ['available'],
};
