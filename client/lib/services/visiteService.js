import api from './api';

export const getAllVisites = async () => {
  const res = await api.get('/visites');
  return res.data?.data?.visites || [];
};

export const updateVisite = async (id, data) => {
  const res = await api.patch(`/visites/${id}`, data);
  return res.data?.data?.visite;
};

export const getOwnerVisites = async () => {
  const res = await api.get('/visites/owner');
  return res.data?.data?.visites || [];
};
