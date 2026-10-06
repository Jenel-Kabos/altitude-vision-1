import api from './api';
import { rentalRequestConfig } from './rentalRequestContext';

// GL-UX-1 — pur wrapper HTTP autour de /api/rental-lease-lifecycle/* (GL-LIFE-1).
// Aucune décision métier ici : chaque fonction relaie simplement la requête
// et renvoie ce que le backend a décidé (machine d'état, règle de
// renouvellement, etc.) — le frontend n'invente jamais de comportement.

export const getLeaseLifecycleDashboard = async (rentalContext) => {
  const res = await api.get('/rental-lease-lifecycle/dashboard', rentalRequestConfig(rentalContext));
  return res.data.data.dashboard;
};

export const getAvailableTransitions = async (contratId, rentalContext) => {
  const res = await api.get(`/rental-lease-lifecycle/${contratId}/available-transitions`, rentalRequestConfig(rentalContext));
  return res.data.data;
};

export const transitionLease = async (contratId, target, comment, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/transition`, { target, comment }, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};

export const previewRenewal = async (contratId, payload, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/renew/preview`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.preview;
};

export const renewLease = async (contratId, payload, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/renew`, payload, rentalRequestConfig(rentalContext));
  return res.data.data;
};

export const addLeaseAvenant = async (contratId, payload, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/avenants`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};

export const encaisserCaution = async (contratId, payload = {}, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/encaisser`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};

export const bloquerCaution = async (contratId, payload = {}, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/bloquer`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};

export const appliquerRetenueCaution = async (contratId, payload, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/retenue`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};

export const restituerCaution = async (contratId, payload = {}, rentalContext) => {
  const res = await api.post(`/rental-lease-lifecycle/${contratId}/caution/restituer`, payload, rentalRequestConfig(rentalContext));
  return res.data.data.contrat;
};
