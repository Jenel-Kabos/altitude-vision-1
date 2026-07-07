import api from './api';

export const getAllDevis = async () => {
  const res = await api.get('/devis');
  return res.data?.data?.devis || [];
};

export const updateDevis = async (id, data) => {
  const res = await api.patch(`/devis/${id}`, data);
  return res.data?.data?.devis;
};
