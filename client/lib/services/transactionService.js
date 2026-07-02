import api from './api';

export const getMyTransactions = async () => {
  const res = await api.get('/transactions/my');
  return res.data?.data?.transactions || [];
};

export const getAllTransactions = async ({ page = 1, limit = 20, status, transactionType } = {}) => {
  const res = await api.get('/transactions', { params: { page, limit, status, transactionType } });
  return res.data;
};

export const getTransaction = async (id) => {
  const res = await api.get(`/transactions/${id}`);
  return res.data?.data?.transaction;
};

export const getStats = async () => {
  const res = await api.get('/transactions/stats');
  return res.data?.data;
};

export const createTransaction = async (payload) => {
  const res = await api.post('/transactions', payload);
  return res.data?.data?.transaction;
};

export const finalizeTransaction = async (id, { tauxCommission } = {}) => {
  const res = await api.post(`/transactions/${id}/finalize`, { tauxCommission });
  return res.data?.data?.transaction;
};

export const cancelTransaction = async (id, raison = '') => {
  const res = await api.patch(`/transactions/${id}/cancel`, { raison });
  return res.data?.data?.transaction;
};

export const updateNotes = async (id, notes) => {
  const res = await api.patch(`/transactions/${id}/notes`, { notes });
  return res.data?.data?.transaction;
};

export const getPaiements = async (transactionId) => {
  const res = await api.get(`/transactions/${transactionId}/paiements`);
  return res.data?.data?.paiements || [];
};

export const initierCinetpay = async (transactionId, { methode, provider }) => {
  const res = await api.post(`/transactions/${transactionId}/paiements/initier`, { methode, provider });
  return res.data?.data;
};

export const soumettreVirement = async (transactionId, { referenceBancaire, notes, fichier } = {}) => {
  const form = new FormData();
  form.append('referenceBancaire', referenceBancaire);
  if (notes)   form.append('notes', notes);
  if (fichier) form.append('preuve', fichier);
  const res = await api.post(`/transactions/${transactionId}/paiements/virement`, form);
  return res.data?.data?.paiement;
};

export const validerVirement = async (transactionId, paiementId, { action, notes }) => {
  const res = await api.patch(`/transactions/${transactionId}/paiements/${paiementId}/valider`, { action, notes });
  return res.data?.data;
};

export const enregistrerEspeces = async (transactionId, payload) => {
  const res = await api.post(`/transactions/${transactionId}/paiements/especes`, payload);
  return res.data?.data?.paiement;
};
