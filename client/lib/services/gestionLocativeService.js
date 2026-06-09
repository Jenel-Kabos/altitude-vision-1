import api from './api';

// ── Propriétaires ─────────────────────────────────────────────

export const getProprietaires = async () => {
  const res = await api.get('/proprietaires');
  return res.data.data.proprietaires;
};

export const createProprietaire = async (data) => {
  const fd = buildPropFD(data);
  const res = await api.post('/proprietaires', fd);
  return res.data.data.proprietaire;
};

export const updateProprietaire = async (id, data) => {
  const fd = buildPropFD(data);
  const res = await api.put(`/proprietaires/${id}`, fd);
  return res.data.data.proprietaire;
};

export const deleteProprietaire = async (id) => {
  await api.delete(`/proprietaires/${id}`);
};

// ── Biens d'un propriétaire ───────────────────────────────────

export const addBienPhotos = async (proprietaireId, bienIndex, files) => {
  const fd = new FormData();
  files.forEach(f => fd.append('photos', f));
  const res = await api.post(`/proprietaires/${proprietaireId}/biens/${bienIndex}/photos`, fd);
  return res.data.data;
};

export const deleteBienPhoto = async (proprietaireId, bienIndex, photoIndex) => {
  await api.delete(`/proprietaires/${proprietaireId}/biens/${bienIndex}/photos/${photoIndex}`);
};

export const deleteBien = async (proprietaireId, bienIndex) => {
  await api.delete(`/proprietaires/${proprietaireId}/biens/${bienIndex}`);
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

// ── Helpers ───────────────────────────────────────────────────

const toFormData = (data) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });
  return fd;
};

const buildPropFD = (data) => {
  // _piece* sont des champs internes frontend — ne pas envoyer au backend
  const { pieceIdentite, biensPropres, _pieceIdentiteUrl, _pieceIdentiteType, _pieceIdentiteNom, ...rest } = data;
  const fd = new FormData();
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') fd.append(k, v);
  });
  if (pieceIdentite instanceof File) fd.append('pieceIdentite', pieceIdentite);
  if (biensPropres !== undefined) fd.append('biensPropres', JSON.stringify(biensPropres));
  return fd;
};
