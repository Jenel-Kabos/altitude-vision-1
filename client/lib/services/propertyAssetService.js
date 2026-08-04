import api from './api';

// GL-ASSET-UX-1 — pur wrapper HTTP autour de /api/property-asset/* (GL-ASSET-1).
// Aucune décision métier ici : chaque fonction relaie simplement la requête
// et renvoie ce que le backend a calculé (machine d'état, historique,
// valorisation, alertes) — le frontend n'invente jamais un comportement.

export const getPropertyLifecycle = async (propertyId) => {
  const res = await api.get(`/property-asset/${propertyId}/lifecycle`);
  return res.data.data;
};

export const transitionPropertyAsset = async (propertyId, target, comment) => {
  const res = await api.post(`/property-asset/${propertyId}/transition`, { target, comment });
  return res.data.data.property;
};

export const getPropertyHistory = async (propertyId) => {
  const res = await api.get(`/property-asset/${propertyId}/history`);
  return res.data.data.history;
};

export const getPropertyMaintenanceLogbook = async (propertyId) => {
  const res = await api.get(`/property-asset/${propertyId}/maintenance-logbook`);
  return res.data.data.logbook;
};

export const getPropertyValuation = async (propertyId) => {
  const res = await api.get(`/property-asset/${propertyId}/valuation`);
  return res.data.data.valuation;
};

export const getPropertyAlerts = async (propertyId) => {
  const res = await api.get(`/property-asset/${propertyId}/alerts`);
  return res.data.data.alerts;
};

// Phase 8 — Dashboard Patrimoine (portefeuille). Réutilise exclusivement
// les mêmes services par-bien déjà exposés ci-dessus, agrégés côté serveur
// (server/services/propertyAssetPortfolioService.js) — aucune logique de
// calcul supplémentaire côté client.
export const getPortfolioDashboard = async () => {
  const res = await api.get('/property-asset/portfolio/dashboard');
  return res.data.data.dashboard;
};
