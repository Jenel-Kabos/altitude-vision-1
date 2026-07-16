import api from './api';

export const getAllVisites = async () => {
  const res = await api.get('/visites');
  return res.data?.data?.visites || [];
};

export const updateVisite = async (id, data) => {
  const res = await api.patch(`/visites/${id}`, data);
  return res.data?.data?.visite;
};

export const getOwnerVisites = async () => {
  const res = await api.get('/visites/owner');
  return res.data?.data?.visites || [];
};

export const updateOwnerVisite = async (id, action, data = {}) => {
  const res = await api.patch(`/visites/${id}/owner/${action}`, data);
  return res.data?.data?.visite;
};

export const getOwnerVisitesUnreadCount = async () => {
  const res = await api.get('/visites/owner/unread-count');
  return res.data?.data?.unreadCount || 0;
};

export const getAllPayments = async () => {
  const res = await api.get('/visites/all-payments');
  return res.data?.data?.visites || [];
};

export const updatePaiementVisite = async (id, data) => {
  const res = await api.patch(`/visites/${id}/paiement`, data);
  return res.data?.data?.visite;
};

export const getMyPayments = async () => {
  const res = await api.get('/visites/my-payments');
  return res.data?.data?.visites || [];
};

export const initierPaiementVisite = async (id, data) => {
  const res = await api.post(`/visites/${id}/paiement/initier`, data);
  return res.data?.data;
};

export const verifierPaiementVisite = async (intentId) => {
  const res = await api.get(`/visites/paiement/verifier/${intentId}`);
  return res.data?.data;
};
