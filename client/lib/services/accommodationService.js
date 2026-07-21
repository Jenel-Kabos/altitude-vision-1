import api from './api';

// ── Hébergement (meublés — Sprint 2) — satellite 1-1 de Property ──

export const getPendingAccommodations = async () => {
  const res = await api.get('/accommodations/status/pending');
  return res.data.data.accommodations;
};

export const getMyAccommodations = async () => {
  const res = await api.get('/accommodations/mine');
  return res.data.data.accommodations;
};

export const getAccommodation = async (id) => {
  const res = await api.get(`/accommodations/${id}`);
  return res.data.data.accommodation;
};

export const createAccommodation = async (data) => {
  const res = await api.post('/accommodations', data);
  return res.data.data.accommodation;
};

export const updateAccommodation = async (id, data) => {
  const res = await api.patch(`/accommodations/${id}`, data);
  return res.data.data.accommodation;
};

export const submitAccommodation = async (id) => {
  const res = await api.post(`/accommodations/${id}/submit`);
  return res.data.data.accommodation;
};

export const reviewAccommodation = async (id, action, data = {}) => {
  const res = await api.patch(`/accommodations/${id}/${action}`, data);
  return res.data.data.accommodation;
};

// ── Sprint B1 : cycle de vie propriétaire (désactiver/dupliquer/supprimer) ──

export const deactivateAccommodation = async (id) => {
  const res = await api.patch(`/accommodations/${id}/deactivate`);
  return res.data.data.accommodation;
};

export const reactivateAccommodation = async (id) => {
  const res = await api.patch(`/accommodations/${id}/reactivate`);
  return res.data.data.accommodation;
};

export const duplicateAccommodation = async (id) => {
  const res = await api.post(`/accommodations/${id}/duplicate`);
  return res.data.data;
};

export const deleteAccommodation = async (id) => {
  await api.delete(`/accommodations/${id}`);
};

// ── Sprint B1 : dashboard admin — "Tous les hébergements" ──

/** @param {{status?, type?, search?, sort?, page?, limit?}} params */
export const getAccommodationsAdmin = async (params = {}) => {
  const res = await api.get('/accommodations/admin/list', { params });
  return res.data.data; // { accommodations, total, page, limit }
};

export const getAccommodationRates = async (id) => {
  const res = await api.get(`/accommodations/${id}/rate-plans`);
  return res.data.data.rates;
};

export const upsertAccommodationRate = async (id, data) => {
  const res = await api.post(`/accommodations/${id}/rate-plans`, data);
  return res.data.data.rate;
};

export const deactivateAccommodationRate = async (id, rateId) => {
  await api.delete(`/accommodations/${id}/rate-plans/${rateId}`);
};

// ── Dashboard admin — création/édition complète Property+Accommodation+RatePlan ──

/**
 * Crée un hébergement complet (Property + Accommodation + RatePlan optionnel)
 * depuis le dashboard admin, en un seul appel atomique côté backend.
 * @param {FormData} formData
 * @returns {Promise<{property, accommodation, rate}>}
 */
export const createFullAccommodation = async (formData) => {
  const res = await api.post('/accommodations/admin', formData);
  return res.data.data;
};

/**
 * Met à jour un hébergement complet existant (Property + Accommodation +
 * tarif nightly optionnel) depuis le dashboard admin.
 * @param {string} propertyId
 * @param {FormData} formData
 */
export const updateFullAccommodation = async (propertyId, formData) => {
  const res = await api.put(`/accommodations/admin/${propertyId}`, formData);
  return res.data.data;
};

// ── Établissements hôteliers (Sprint Hôtel) — sélecteur admin ──

/** Liste des hôtels actifs pour le sélecteur "Établissement hôtelier". */
export const getHotels = async () => {
  const res = await api.get('/hotels');
  return res.data.data.hotels;
};

export const getHotel = async (id) => {
  const res = await api.get(`/hotels/${id}`);
  return res.data.data.hotel;
};
