import api from './api';

// ── Propriétaires ─────────────────────────────────────────────

export const getProprietaires = async () => {
  const res = await api.get('/proprietaires');
  return res.data.data.proprietaires;
};

export const createProprietaire = async (data) => {
  const fd = toFormData(data);
  const res = await api.post('/proprietaires', fd);
  return res.data.data.proprietaire;
};

export const updateProprietaire = async (id, data) => {
  const fd = toFormData(data);
  const res = await api.put(`/proprietaires/${id}`, fd);
  return res.data.data.proprietaire;
};

export const deleteProprietaire = async (id) => {
  await api.delete(`/proprietaires/${id}`);
};

// ── Locataires ────────────────────────────────────────────────

export const getLocataires = async () => {
  const res = await api.get('/locataires');
  return res.data.data.locataires;
};

export const createLocataire = async (data) => {
  const fd = toFormData(data);
  const res = await api.post('/locataires', fd);
  return res.data.data.locataire;
};

export const updateLocataire = async (id, data) => {
  const fd = toFormData(data);
  const res = await api.put(`/locataires/${id}`, fd);
  return res.data.data.locataire;
};

export const deleteLocataire = async (id) => {
  await api.delete(`/locataires/${id}`);
};

// ── Contrats ──────────────────────────────────────────────────

export const getContrats = async (params = {}) => {
  const res = await api.get('/contrats', { params });
  return res.data.data.contrats;
};

export const createContrat = async (data) => {
  const res = await api.post('/contrats', data);
  return res.data.data.contrat;
};

export const updateContrat = async (id, data) => {
  const res = await api.put(`/contrats/${id}`, data);
  return res.data.data.contrat;
};

export const deleteContrat = async (id) => {
  await api.delete(`/contrats/${id}`);
};

// ── Paiements ─────────────────────────────────────────────────

export const getPaiements = async (contratId, annee) => {
  const params = {};
  if (annee) params.annee = annee;
  const res = await api.get(`/contrats/${contratId}/paiements`, { params });
  return res.data.data.paiements;
};

export const updatePaiement = async (id, data) => {
  const res = await api.put(`/paiements/${id}`, data);
  return res.data.data.paiement;
};

export const deletePaiement = async (id) => {
  await api.delete(`/paiements/${id}`);
};

// ── Utilitaire ────────────────────────────────────────────────

const toFormData = (data) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });
  return fd;
};
