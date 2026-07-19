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
