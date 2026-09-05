import api from './api';

// ── Sprint B2 — domaine Hôtellerie (établissements, catégories, tarifs) ──
// `getHotels`/`getHotel` (sélecteur admin, Sprint Hôtel) restent dans
// accommodationService.js, inchangés — ce fichier couvre le nouveau cycle
// de vie complet (dashboard propriétaire "Mes hôtels", dashboard admin,
// modération, pages publiques).

export const getMyHotels = async () => {
  const res = await api.get('/hotels/mine');
  return res.data.data.hotels;
};

export const getHotelDetail = async (id) => {
  const res = await api.get(`/hotels/${id}`);
  return res.data.data; // { hotel, completion }
};

// PHASE-HW1 — `detail` (H1-H5 normalisé : policies/reviewSummary/faq) est
// désormais le contrat canonique consommé par les pages publiques ; `hotel`/
// `categories` restent pour compatibilité (mobile H2 booking handoff).
export const getPublicHotel = async (id) => {
  const res = await api.get(`/hotels/public/${id}`);
  return res.data.data; // { hotel, categories, detail }
};

/** @param {{ville?, search?, page?, limit?}} params */
export const getPublicHotels = async (params = {}) => {
  const res = await api.get('/hotels/public', { params });
  return res.data.data; // { hotels, total, page, limit }
};

export const createFullHotel = async (formData) => {
  const res = await api.post('/hotels/admin', formData);
  return res.data.data;
};

export const updateFullHotel = async (hotelId, formData) => {
  const res = await api.put(`/hotels/admin/${hotelId}`, formData);
  return res.data.data;
};

// Propriétaire — "Mes hôtels" (mêmes contrôleurs serveur, ownership
// vérifiée côté backend — voir hotelController.createFull/updateFull).
export const createMyHotel = async (formData) => {
  const res = await api.post('/hotels/mine', formData);
  return res.data.data;
};

export const updateMyHotel = async (hotelId, formData) => {
  const res = await api.put(`/hotels/mine/${hotelId}`, formData);
  return res.data.data;
};

export const submitHotel = async (id) => {
  const res = await api.post(`/hotels/${id}/submit`);
  return res.data.data.hotel;
};

export const reviewHotel = async (id, action, data = {}) => {
  const res = await api.patch(`/hotels/${id}/${action}`, data);
  return res.data.data.hotel;
};

export const deactivateHotel = async (id) => {
  const res = await api.patch(`/hotels/${id}/deactivate`);
  return res.data.data.hotel;
};

export const reactivateHotel = async (id) => {
  const res = await api.patch(`/hotels/${id}/reactivate`);
  return res.data.data.hotel;
};

export const duplicateHotel = async (id) => {
  const res = await api.post(`/hotels/${id}/duplicate`);
  return res.data.data;
};

export const deleteHotel = async (id) => {
  await api.delete(`/hotels/${id}`);
};

export const getPendingHotels = async ({ platformScoped = false } = {}) => {
  const res = await api.get('/hotels/status/pending', platformScoped ? { platformScoped: true } : undefined);
  return res.data.data.hotels;
};

/** @param {{status?, search?, sort?, page?, limit?}} params */
export const getHotelsAdmin = async (params = {}) => {
  const res = await api.get('/hotels/admin/list', { params });
  return res.data.data; // { hotels, total, page, limit }
};

/** Portefeuille hôtelier validé. Les statuts de modération sont imposés par le serveur. */
export const getHotelPortfolio = async (params = {}) => {
  const res = await api.get('/hotels/portfolio', { params });
  return res.data.data;
};

export const getHotelPortfolioDetail = async (id) => {
  const res = await api.get(`/hotels/portfolio/${id}`);
  return res.data.data;
};

// ── Catégories de chambres ──

export const getRoomCategories = async (hotelId) => {
  const res = await api.get(`/hotels/${hotelId}/room-categories`);
  return res.data.data.categories;
};

export const createRoomCategory = async (hotelId, data) => {
  const res = await api.post(`/hotels/${hotelId}/room-categories`, data);
  return res.data.data.category;
};

export const updateRoomCategory = async (id, data) => {
  const res = await api.patch(`/hotels/room-categories/${id}`, data);
  return res.data.data.category;
};

export const deleteRoomCategory = async (id) => {
  await api.delete(`/hotels/room-categories/${id}`);
};

export const duplicateRoomCategory = async (id) => {
  const res = await api.post(`/hotels/room-categories/${id}/duplicate`);
  return res.data.data.category;
};

export const activateRoomCategory = async (id) => {
  const res = await api.patch(`/hotels/room-categories/${id}/activate`);
  return res.data.data.category;
};

export const deactivateRoomCategory = async (id) => {
  const res = await api.patch(`/hotels/room-categories/${id}/deactivate`);
  return res.data.data.category;
};

// PHASE-HX1 §10 — upload de photos de catégorie (réutilise exactement le
// mécanisme Cloudinary existant, jamais un second système de stockage).
// Renvoie les URLs ajoutées ; le composant appelant les fusionne dans
// `gallery` et persiste via updateRoomCategory (jamais une seconde route
// d'écriture pour la galerie elle-même).
export const uploadRoomCategoryGallery = async (categoryId, files) => {
  const data = new FormData();
  files.forEach((file) => data.append('images', file));
  const res = await api.post(`/hotels/room-categories/${categoryId}/gallery`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.urls;
};

// ── Tarifs par catégorie ──

export const getRoomCategoryRates = async (categoryId, includeInactive = false) => {
  const res = await api.get(`/hotels/room-categories/${categoryId}/rate-plans`, {
    params: includeInactive ? { includeInactive: 1 } : {},
  });
  return res.data.data.rates;
};

export const upsertRoomCategoryRate = async (categoryId, data) => {
  const res = await api.post(`/hotels/room-categories/${categoryId}/rate-plans`, data);
  return res.data.data.rate;
};

export const archiveRoomCategoryRate = async (categoryId, rateId) => {
  const res = await api.delete(`/hotels/room-categories/${categoryId}/rate-plans/${rateId}`);
  return res.data.data.rate;
};

// ── Sprint D — chambres physiques (tableau des chambres / plan d'étage) ──

export const getRooms = async (hotelId, params = {}) => {
  const res = await api.get(`/hotels/${hotelId}/rooms`, { params });
  return res.data.data.rooms;
};

export const createRoom = async (hotelId, data) => {
  const res = await api.post(`/hotels/${hotelId}/rooms`, data);
  return res.data.data.room;
};

export const updateRoom = async (id, data) => {
  const res = await api.patch(`/hotels/rooms/${id}`, data);
  return res.data.data.room;
};

export const deleteRoom = async (id) => {
  await api.delete(`/hotels/rooms/${id}`);
};

// ── Sprint D — affectation de chambre ──

export const assignRoom = async ({ reservationId, roomId, reason }) => {
  const res = await api.post('/hotels/room-assignments', { reservationId, roomId, reason });
  return res.data.data.assignment;
};

export const changeRoom = async ({ reservationId, oldRoomId, newRoomId, reason }) => {
  const res = await api.patch('/hotels/room-assignments/change', { reservationId, oldRoomId, newRoomId, reason });
  return res.data.data.assignment;
};

export const autoAssignRooms = async ({ reservationId, reason }) => {
  const res = await api.post('/hotels/room-assignments/auto', { reservationId, reason });
  return res.data.data;
};

export const releaseRoom = async ({ reservationId, reason }) => {
  const res = await api.patch('/hotels/room-assignments/release', { reservationId, reason });
  return res.data.data;
};

export const getHotelInventoryCalendar = async (hotelId, params, config = {}) => {
  const res = await api.get(`/hotels/${hotelId}/inventory/calendar`, { params, ...config });
  return res.data.data;
};
export const updateHotelInventoryRange = async (hotelId, data) => {
  const res = await api.patch(`/hotels/${hotelId}/inventory/range`, data);
  return res.data.data;
};
export const rebuildHotelInventory = async (hotelId, data) => {
  const res = await api.post(`/hotels/${hotelId}/inventory/rebuild`, data);
  return res.data.data;
};
// PHASE-HX1 §15-17 — édition professionnelle "stock vendable" par date,
// des valeurs DIFFÉRENTES par date en un seul appel (updates: [{date, sellableUnits}]).
export const updateHotelInventoryDays = async (hotelId, data) => {
  const res = await api.patch(`/hotels/${hotelId}/inventory/days`, data);
  return res.data.data;
};

// ── PHASE-HX1 §23 — FAQ professionnelle (H3 backend, réutilisé tel quel) ──

export const getHotelFaqOwner = async (hotelId) => {
  const res = await api.get(`/hotels/${hotelId}/faq`);
  return res.data.data.faq;
};
export const createHotelFaq = async (hotelId, data) => {
  const res = await api.post(`/hotels/${hotelId}/faq`, data);
  return res.data.data.faq;
};
export const updateHotelFaq = async (hotelId, faqId, data) => {
  const res = await api.patch(`/hotels/${hotelId}/faq/${faqId}`, data);
  return res.data.data.faq;
};
export const deleteHotelFaq = async (hotelId, faqId) => {
  await api.delete(`/hotels/${hotelId}/faq/${faqId}`);
};

// ── PHASE-HX1 §24 — avis professionnels (endpoint PUBLIC H3 réutilisé tel
// quel : même projection sûre, jamais un accès élargi côté propriétaire —
// mission §24 "Do not weaken public privacy projection"). ──
export const getHotelReviewsForOwner = async (hotelId, params = {}) => {
  const res = await api.get(`/hotels/public/${hotelId}/reviews`, { params });
  return res.data.data;
};
