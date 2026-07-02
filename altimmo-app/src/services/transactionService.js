import api from './api';

export const getMyTransactions = async () => {
  const res = await api.get('/transactions/my');
  return res.data?.data?.transactions || [];
};

export const getTransaction = async (id) => {
  const res = await api.get(`/transactions/${id}`);
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
  if (fichier) form.append('preuve', { uri: fichier.uri, name: fichier.name, type: fichier.mimeType });
  const res = await api.post(`/transactions/${transactionId}/paiements/virement`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data?.paiement;
};
