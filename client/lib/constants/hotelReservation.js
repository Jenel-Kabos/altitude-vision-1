// client/lib/constants/hotelReservation.js — Sprint C, synchronisé avec
// server/models/HotelReservation.js (RESERVATION_STATUSES/RESERVATION_SOURCES).

export const RESERVATION_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'amber' },
  { value: 'confirmed', label: 'Confirmée', color: 'green' },
  { value: 'cancelled', label: 'Annulée', color: 'gray' },
  { value: 'expired', label: 'Expirée', color: 'orange' },
  { value: 'rejected', label: 'Rejetée', color: 'red' },
];

export const RESERVATION_SOURCES = {
  public_web: 'Site public',
  owner_dashboard: 'Propriétaire',
  admin_dashboard: 'Administration',
};

export const RESERVATION_STATUS_CLASSES = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-700',
};
