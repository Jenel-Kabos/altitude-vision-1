import * as Crypto from 'expo-crypto';
import api from './api';

export const newReservationRequestId = () => Crypto.randomUUID();
export const searchPublicHotels = async (params = {}) => (await api.get('/hotels/public', { params })).data.data;
export const getPublicHotel = async (id) => (await api.get(`/hotels/public/${id}`)).data.data;
export const getHotelAvailability = async (hotelId, params) => (await api.get(`/hotels/${hotelId}/availability`, { params })).data.data;
// PHASE-H2 — recherche multi-catégories (jamais un roomCategoryId préalable
// requis, contrairement à getHotelAvailability ci-dessus qui reste inchangé
// pour son propre usage dans HotelBookingScreen).
export const searchHotelAvailability = async (hotelId, { checkIn, checkOut, adults, children, rooms }) => (
  await api.get(`/hotels/public/${hotelId}/availability`, { params: { checkIn, checkOut, adults, children, rooms } })
).data.data;
export const createHotelReservation = async (hotelId, payload) => (await api.post(`/hotels/${hotelId}/reservations`, payload)).data.data;
// PHASE-H3 — avis publics (séjour vérifié uniquement), paginés indépendamment
// de la fiche hôtel (jamais tous les avis chargés d'un coup).
export const getHotelReviews = async (hotelId, { page = 1, limit = 5 } = {}) => (
  await api.get(`/hotels/public/${hotelId}/reviews`, { params: { page, limit } })
).data.data;
// PHASE-H4 — hôtels à proximité (distance géospatiale calculée côté
// serveur, jamais recalculée côté mobile).
export const getNearbyHotels = async (hotelId, { limit } = {}) => (
  await api.get(`/hotels/public/${hotelId}/nearby`, { params: { limit } })
).data.data.hotels;
export const getMyHotelReservations = async () => (await api.get('/hotel-reservations/mine')).data.data.reservations;
// PHASE-H5 §20 — `reviewEligibility` (server-authoritative, jamais déduit
// côté mobile du seul statut) accompagne désormais la réservation.
export const getHotelReservation = async (id) => (await api.get(`/hotel-reservations/${id}`)).data.data;
// PHASE-H5 — calcul pur (aucune écriture), dérivé du snapshot contractuel.
export const getCancellationEligibility = async (id) => (await api.get(`/hotel-reservations/${id}/cancellation-eligibility`)).data.data.eligibility;
// PHASE-H5 §20/21 — complétion de la soumission d'avis mobile (H3 avait
// déféré ce point d'entrée) : réutilise l'endpoint H3 existant tel quel.
export const createHotelReview = async (hotelId, payload) => (await api.post(`/hotels/${hotelId}/reviews`, payload)).data.data;
export const updateHotelReservation = async (id, payload) => (await api.patch(`/hotel-reservations/${id}`, payload)).data.data.reservation;
export const cancelHotelReservation = async (id, reason) => (await api.patch(`/hotel-reservations/${id}/cancel`, { reason })).data.data.reservation;
export const getOwnerHotelReservations = async (params = {}) => (await api.get('/hotel-reservations/owner', { params })).data.data;
export const getAccessibleHotels = async () => (await api.get('/hotels/accessible')).data.data.hotels;
export const getReservationAssignments = async (id) => (await api.get(`/hotel-reservations/${id}/room-assignment`)).data.data;
export const getHotelRooms = async (hotelId, params = {}) => (await api.get(`/hotels/${hotelId}/rooms`, { params })).data.data.rooms;
export const assignHotelRoom = async (reservationId, roomId) => (await api.post('/hotels/room-assignments', { reservationId, roomId })).data.data.assignment;
export const autoAssignHotelRooms = async (reservationId) => (await api.post('/hotels/room-assignments/auto', { reservationId })).data.data;
export const changeHotelRoom = async (reservationId, oldRoomId, newRoomId, reason) => (await api.patch('/hotels/room-assignments/change', { reservationId, oldRoomId, newRoomId, reason })).data.data.assignment;
export const checkInHotelReservation = async (id, payload = {}) => (await api.patch(`/hotel-reservations/${id}/check-in`, payload)).data.data;
export const checkOutHotelReservation = async (id, payload = {}) => (await api.patch(`/hotel-reservations/${id}/check-out`, payload)).data.data;
export const getHotelInventory = async (hotelId, params) => (await api.get(`/hotels/${hotelId}/inventory/calendar`, { params })).data.data;
export const updateHotelInventory = async (hotelId, payload) => (await api.patch(`/hotels/${hotelId}/inventory/range`, payload)).data.data;
// SYNC-2B — même endpoint certifié E2E-1 (server/controllers/hotelReservationController.js
// `checkoutFinancialReadiness`), jamais un calcul de solde recalculé côté mobile.
export const getCheckoutFinancialReadiness = async (id) => (await api.get(`/hotel-reservations/${id}/checkout-financial-readiness`)).data.data.financialReadiness;
// SYNC-2B — mêmes champs `kpis` que client/lib/pages/dashboard/HotelDetailPage.jsx
// (client/lib/services/dashboardAnalyticsService.js) : aucun KPI inventé, seuls les
// champs réellement renvoyés par le backend sont consommés côté écran.
export const getHotelCockpitAnalytics = async (hotelId) => (await api.get('/dashboard-analytics/hotels', { params: { hotelId } })).data.data;
