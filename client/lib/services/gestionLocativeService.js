import api from './api';

// ── Dossiers locatifs synchronisés avec Property ─────────────
export const getRentalManagement = async (params = {}) => {
  const res = await api.get('/rental-management', { params });
  return res.data.data;
};
export const getRentalManagementStats = async () => {
  const res = await api.get('/rental-management/stats');
  return res.data.data.stats;
};
export const getRentalManagementDetail = async (id) => {
  const res = await api.get(`/rental-management/${id}`);
  return res.data.data.rental;
};
export const enableRentalManagement = async (data) => {
  const res = await api.post('/rental-management', data);
  return res.data.data.rental;
};
export const runRentalAction = async (id, action, data = {}) => {
  const res = await api.post(`/rental-management/${id}/${action}`, data);
  return res.data.data;
};
export const getMyRentalManagement = async () => {
  const res = await api.get('/rental-management/owner/my');
  return res.data.data.rentals;
};
export const requestRentalAction = async (id, action, data = {}) => {
  const res = await api.post(`/rental-management/${id}/owner/${action}`, data);
  return res.data.data;
};

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

// Sprint GL-B2 — liste enrichie (bien, bail, paiements, préavis actif).
export const getLocataireDossiers = async (params = {}) => {
  const res = await api.get('/locataires/dossiers', { params });
  return res.data.data; // { locataires, total, page, totalPages }
};

export const getLocataireDossier = async (id) => {
  const res = await api.get(`/locataires/${id}/dossier`);
  return res.data.data.locataire;
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

export const inviteLocataire = async (id) => (await api.post(`/locataires/${id}/invite`)).data.data;
export const getTenantLinkRequests = async (params = {}) => (await api.get('/locataires/link-requests', { params })).data.data;
export const reviewTenantLinkRequest = async (requestId, decision, comment = '') => (await api.patch(`/locataires/link-requests/${requestId}/review`, { decision, comment })).data.data;
export const cancelTenantInvitation = async (requestId) => (await api.patch(`/locataires/invitations/${requestId}/cancel`)).data.data;
export const resendTenantInvitation = async (requestId) => (await api.post(`/locataires/invitations/${requestId}/resend`)).data.data;

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

export const marquerPaiementPaye = async (id, data) => {
  const res = await api.post(`/paiements/${id}/marquer-paye`, data);
  return res.data.data.paiement;
};

export const calculerPenalites = async () => {
  const res = await api.post('/paiements/calculer-penalites');
  return res.data.data;
};

export const getAlertesPaiements = async () => {
  const res = await api.get('/paiements/alertes');
  return res.data.data;
};

// Sprint GL-B2 — liste paginée (tableau de bord Paiements locatifs) et
// statistiques d'encaissement (calculées côté serveur).
export const getPaiementsPage = async (params = {}) => {
  const res = await api.get('/paiements', { params });
  return res.data.data; // { paiements, total, page, totalPages }
};

export const getPaiementsStats = async (params = {}) => {
  const res = await api.get('/paiements/stats', { params });
  return res.data.data.stats;
};

// ── Sprint GL-B2 — Préavis (actions sur RentalManagement) ────────

export const acknowledgeNotice = async (rentalManagementId, comment) => {
  const res = await api.post(`/rental-management/${rentalManagementId}/acknowledge-notice`, { comment });
  return res.data.data.rental;
};

export const cancelNotice = async (rentalManagementId, comment) => {
  const res = await api.post(`/rental-management/${rentalManagementId}/cancel-notice`, { comment });
  return res.data.data.rental;
};

export const startNotice = async (rentalManagementId, plannedExitAt, comment) => {
  const res = await api.post(`/rental-management/${rentalManagementId}/start-notice`, { plannedExitAt, comment });
  return res.data.data.rental;
};

export const validateExit = async (rentalManagementId, data = {}) => {
  const res = await api.post(`/rental-management/${rentalManagementId}/validate-exit`, data);
  return res.data.data;
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
