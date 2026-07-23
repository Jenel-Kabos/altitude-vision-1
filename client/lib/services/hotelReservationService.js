import api from './api';

// ── Sprint C — moteur de réservation hôtelière ──

// Public (hébergée sous /hotels/:hotelId, pas d'auth requise — voir
// server/routes/hotelRoutes.js).
export const getHotelAvailability = async (hotelId, { roomCategoryId, checkInDate, checkOutDate, roomsCount }) => {
  const res = await api.get(`/hotels/${hotelId}/availability`, {
    params: { roomCategoryId, checkInDate, checkOutDate, roomsCount },
  });
  return res.data.data; // { available, nights }
};

export const createPublicHotelReservation = async (hotelId, payload) => {
  const res = await api.post(`/hotels/${hotelId}/reservations`, payload);
  return res.data.data.reservation;
};

// Client connecté — "Mes réservations"
export const getMyHotelReservations = async () => {
  const res = await api.get('/hotel-reservations/mine');
  return res.data.data.reservations;
};

export const getHotelReservation = async (id) => {
  const res = await api.get(`/hotel-reservations/${id}`);
  return res.data.data.reservation;
};

export const cancelHotelReservation = async (id, reason) => {
  const res = await api.patch(`/hotel-reservations/${id}/cancel`, { reason });
  return res.data.data.reservation;
};

// Propriétaire (+ staff, ownership vérifiée côté backend)
export const getOwnerHotelReservations = async (params = {}) => {
  const res = await api.get('/hotel-reservations/owner', { params });
  return res.data.data; // { reservations, total, page, limit }
};

export const createOwnerHotelReservation = async (payload) => {
  const res = await api.post('/hotel-reservations/owner', payload);
  return res.data.data.reservation;
};

export const updateHotelReservation = async (id, payload) => {
  const res = await api.patch(`/hotel-reservations/${id}`, payload);
  return res.data.data.reservation;
};

export const confirmHotelReservation = async (id) => {
  const res = await api.patch(`/hotel-reservations/${id}/confirm`);
  return res.data.data.reservation;
};

export const rejectHotelReservation = async (id, reason) => {
  const res = await api.patch(`/hotel-reservations/${id}/reject`, { reason });
  return res.data.data.reservation;
};

// Administration
export const getAdminHotelReservations = async (params = {}) => {
  const res = await api.get('/hotel-reservations/admin/list', { params });
  return res.data.data; // { reservations, total, page, limit }
};

export const getPendingHotelReservations = async () => {
  const res = await api.get('/hotel-reservations/status/pending');
  return res.data.data.reservations;
};

// ── Sprint D — check-in / check-out (jamais accessible au client) ──

export const checkInHotelReservation = async (id, { roomId, reason } = {}) => {
  const res = await api.patch(`/hotel-reservations/${id}/check-in`, { roomId, reason });
  return res.data.data; // { reservation, room }
};

export const checkOutHotelReservation = async (id, { reason, financialOverride } = {}) => {
  const res = await api.patch(`/hotel-reservations/${id}/check-out`, { reason, financialOverride });
  return res.data.data; // { reservation, room }
};
export const getCheckoutFinancialReadiness = async (id) => { const res = await api.get(`/hotel-reservations/${id}/checkout-financial-readiness`); return res.data.data.financialReadiness; };

// Correctif — récupération PERSISTANTE de l'affectation active (survit à un
// rechargement), remplace la dépendance exclusive à l'état local post-action.
export const getReservationRoomAssignment = async (id) => {
  const res = await api.get(`/hotel-reservations/${id}/room-assignment`);
  return res.data.data.activeRoomAssignment; // null | { id, room:{id,roomNumber,floor,status,roomCategory}, assignedAt }
};
