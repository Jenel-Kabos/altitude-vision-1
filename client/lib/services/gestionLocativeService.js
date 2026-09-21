import api from './api';

// GL-DEBT-1 (Phase 3) — accès contrôlé aux documents Gestion Locative.
// Remplace l'exposition directe de l'URL Cloudinary (Sprint GL-UX1) : le
// serveur vérifie l'authentification, le rôle et la relation avec le bail
// avant de proxy-streamer le fichier. Même pattern que
// tenantPortalService.downloadTenantDocument (portail locataire, non
// modifié ici).
export const downloadRentalDocument = async (documentId, filename = 'document') => {
  const response = await api.get(`/rental-documents/${documentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
};

// DOC-EVO-1 — évolution 8 (prévisualisation) : le serveur sert déjà ce
// fichier en `Content-Disposition: inline` (rentalDocumentController.js) —
// seul le comportement du CLIENT forçait un enregistrement (l'attribut
// `download` sur l'ancre ci-dessus). Ouvrir le blob dans un nouvel onglet
// laisse le navigateur l'afficher nativement (PDF/image), sans
// téléchargement obligatoire — même endpoint sécurisé, même vérification
// d'accès, seule la présentation change.
export const previewRentalDocument = async (documentId) => {
  const response = await api.get(`/rental-documents/${documentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener,noreferrer');
};
export const previewSecureDocumentEndpoint = async (endpoint) => {
  const response = await api.get(String(endpoint).replace(/^\/api/, ''), { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
export const getRentalOnboardingOptions = async () => (await api.get('/rental-management/onboarding/options')).data.data;
export const onboardRentalProperty = async (data) => (await api.post('/rental-management/onboarding', data)).data.data;
export const runRentalAction = async (id, action, data = {}) => {
  const res = await api.post(`/rental-management/${id}/${action}`, data);
  return res.data.data;
};
export const deactivateRentalManagement = async (id, comment = '') => {
  const res = await api.post(`/rental-management/${id}/deactivate`, { comment });
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

// GL-ARCH-1.1 — Intègre un bien propre (Proprietaire.biensPropres[]) dans la
// Gestion locative : crée un Property réel + un RentalManagement actif.
// `overrides` complète les champs obligatoires absents de la fiche (ex :
// arrondissement, latitude/longitude, jamais présents sur biensPropres[]).
// Idempotent côté serveur : un second appel sur le même bien renvoie 200
// avec `alreadyImported: true` au lieu de dupliquer.
export const importBienIntoGestionLocative = async (proprietaireId, bienIndex, overrides = {}) => {
  const res = await api.post(`/proprietaires/${proprietaireId}/biens/${bienIndex}/importer-gestion`, overrides);
  return res.data.data;
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
//
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV — CONTRAT-DOMAIN-SPLIT
// (Phase 3B). Le backend expose des surfaces typées certifiées :
//   /api/contrats/location/*   → rental, module `location` requis
//   /api/contrats/vente/*      → sale,  module `location` indépendant
// La conclusion marketplace `POST /api/contrats` reste PLATFORM-only.
//
// Règle canonique du service frontend : le DOMAINE d'un contrat vient
// TOUJOURS d'une ressource déjà chargée (`contrat.type`), JAMAIS d'un
// champ contrôlé par l'utilisateur dans le payload. Les callers doivent
// utiliser `updateContratByResource` / `deleteContratByResource` en
// passant l'objet `Contrat` chargé, jamais un couple `(id, formType)`
// où `formType` serait un champ de formulaire.
//
// Lecture polymorphique legacy `GET /api/contrats` est CONSERVÉE pour
// les surfaces UI polymorphiques (GestionLocativePage affiche location
// + vente) — décision B (POLYMORPHIC_READ_STILL_REQUIRED=YES).

export const getContrats = async (params = {}) => {
  const res = await api.get('/contrats', { params });
  return res.data.data.contrats;
};

export const getRentalContracts = async (params = {}) => {
  const res = await api.get('/contrats/location', { params });
  return res.data.data.contrats;
};

export const getSaleContracts = async (params = {}) => {
  const res = await api.get('/contrats/vente', { params });
  return res.data.data.contrats;
};

export const createContrat = async (data) => {
  const res = await api.post('/contrats', data);
  return res.data.data.contrat;
};

export const updateRentalContract = async (id, data) => {
  const res = await api.put(`/contrats/location/${id}`, data);
  return res.data.data.contrat;
};

export const updateSaleContract = async (id, data) => {
  const res = await api.put(`/contrats/vente/${id}`, data);
  return res.data.data.contrat;
};

export const deleteRentalContract = async (id) => {
  await api.delete(`/contrats/location/${id}`);
};

export const deleteSaleContract = async (id) => {
  await api.delete(`/contrats/vente/${id}`);
};

// Dispatchers pilotés PAR LA RESSOURCE (jamais par un champ de payload).
// `contrat` doit être l'objet Contrat chargé depuis le backend — son
// `.type` est la référence canonique du domaine.
export const updateContratByResource = async (contrat, data) => {
  if (contrat?.type === 'location') return updateRentalContract(contrat._id, data);
  if (contrat?.type === 'vente') return updateSaleContract(contrat._id, data);
  throw new Error("Type de contrat inconnu ; mise à jour typée impossible sans ressource fiable.");
};

export const deleteContratByResource = async (contrat) => {
  if (contrat?.type === 'location') return deleteRentalContract(contrat._id);
  if (contrat?.type === 'vente') return deleteSaleContract(contrat._id);
  throw new Error("Type de contrat inconnu ; suppression typée impossible sans ressource fiable.");
};

// GL-RECON-UX-1 — centre staff de régularisation, décisions serveur only.
export const getRentalRegularizationCases = async () => (await api.get('/rental-contract-regularization')).data.data.cases;
export const decideRentalRegularization = async (contractId, payload) => (await api.post(`/rental-contract-regularization/${contractId}/decision`, payload)).data.data.reconciliation;
export const revertRentalRegularization = async (contractId, reason) => (await api.post(`/rental-contract-regularization/${contractId}/revert`, { reason })).data.data.reconciliation;

// ── Paiements ─────────────────────────────────────────────────

// La grille de paiements par échéances est un artefact exclusif du domaine
// location (aucun contrat de vente n'a de schedule de paiement mensuel).
// La surface typée `/api/contrats/location/:id/paiements` applique déjà le
// module `location` en amont — un contrat de vente y renvoie 404 domain
// mismatch, comportement attendu.
export const getRentalContractPayments = async (contratId, annee) => {
  const params = {};
  if (annee) params.annee = annee;
  const res = await api.get(`/contrats/location/${contratId}/paiements`, { params });
  return res.data.data.paiements;
};

// Alias historique — même signature, backend typé. Conservé pour ne pas
// casser les callers existants pendant la migration progressive.
export const getPaiements = getRentalContractPayments;

export const updatePaiement = async (id, data) => {
  const res = await api.put(`/paiements/${id}`, data);
  return res.data.data.paiement;
};

export const deletePaiement = async (id) => {
  await api.delete(`/paiements/${id}`);
};

export const marquerPaiementPaye = async (id, { preuve, ...data } = {}) => {
  if (!preuve) {
    const res = await api.post(`/paiements/${id}/marquer-paye`, data);
    return res.data.data.paiement;
  }
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') form.append(key, value); });
  form.append('preuve', preuve);
  const res = await api.post(`/paiements/${id}/marquer-paye`, form);
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
