import api from './api';

// GL-UX-1 — pur wrapper HTTP autour de /api/rental-lease-lifecycle/* (GL-LIFE-1).
// Aucune décision métier ici : chaque fonction relaie simplement la requête
// et renvoie ce que le backend a décidé (machine d'état, règle de
// renouvellement, etc.) — le frontend n'invente jamais de comportement.

export const getLeaseLifecycleDashboard = async () => {
  const res = await api.get('/rental-lease-lifecycle/dashboard');
  return res.data.data.dashboard;
};

export const getAvailableTransitions = async (contratId) => {
  const res = await api.get(`/rental-lease-lifecycle/${contratId}/available-transitions`);
  return res.data.data;
};

export const transitionLease = async (contratId, target, comment) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/transition`, { target, comment });
  return res.data.data.contrat;
};

export const previewRenewal = async (contratId, payload) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/renew/preview`, payload);
  return res.data.data.preview;
};

export const renewLease = async (contratId, payload) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/renew`, payload);
  return res.data.data;
};

export const addLeaseAvenant = async (contratId, payload) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/avenants`, payload);
  return res.data.data.contrat;
};

export const encaisserCaution = async (contratId, payload = {}) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/encaisser`, payload);
  return res.data.data.contrat;
};

export const bloquerCaution = async (contratId, payload = {}) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/bloquer`, payload);
  return res.data.data.contrat;
};

export const appliquerRetenueCaution = async (contratId, payload) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/retenue`, payload);
  return res.data.data.contrat;
};

export const restituerCaution = async (contratId, payload = {}) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/restituer`, payload);
  return res.data.data.contrat;
};
