import api from './api';

export const getContratDocuments = async (contratId) => {
  const res = await api.get(`/gestion-docs/contrat/${contratId}`);
  return res.data.data;
};

export const generateBail = async (contratId) => {
  const res = await api.post(`/gestion-docs/bail/${contratId}`);
  return res.data.data.document;
};

export const generateQuittance = async (paiementId) => {
  const res = await api.post(`/gestion-docs/quittance/${paiementId}`);
  return res.data.data.document;
};

export const generateMiseEnDemeure = async (paiementId) => {
  const res = await api.post(`/gestion-docs/mise-en-demeure/${paiementId}`);
  return res.data.data.document;
};

export const generatePreavis = async (contratId, typeInitiateur) => {
  const res = await api.post(`/gestion-docs/preavis/${contratId}`, { typeInitiateur });
  return res.data.data.document;
};

export const generateEtatDesLieux = async (contratId, type, pieces) => {
  const res = await api.post(`/gestion-docs/etat-des-lieux/${contratId}`, { type, pieces });
  return res.data.data.document;
};

export const envoyerDocument = async (contratId, docIndex, data) => {
  const res = await api.post(`/gestion-docs/envoyer/${contratId}/${docIndex}`, data);
  return res.data;
};
