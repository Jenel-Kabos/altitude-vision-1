// client/lib/services/litigeService.js
import api from './api';

const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) q.set(k, v);
  });
  return q.toString();
};

export const createLitige = async (formData) => {
  const res = await api.post('/litiges', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getLitiges = async (params = {}) => {
  const res = await api.get(`/litiges?${toQuery(params)}`);
  return res.data;
};

export const getLitigeStats = async () => {
  const res = await api.get('/litiges/stats');
  return res.data?.data || {};
};

export const getLitige = async (id) => {
  const res = await api.get(`/litiges/${id}`);
  return res.data?.data?.litige;
};

export const updateLitigeStatut = async (id, body) => {
  const res = await api.put(`/litiges/${id}/statut`, body);
  return res.data;
};

export const addLitigeMessage = async (id, note) => {
  const res = await api.post(`/litiges/${id}/message`, { note });
  return res.data;
};

export const resolveLitige = async (id, decision) => {
  const res = await api.post(`/litiges/${id}/resolution`, { decision });
  return res.data;
};

export const previewLitigeProof = async (endpoint) => {
  const res = await api.get(endpoint, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};
