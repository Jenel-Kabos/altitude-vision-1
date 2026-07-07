import api from './api';

export const getAllEstimations = async () => {
  const res = await api.get('/estimation');
  return res.data?.data?.estimations || [];
};

export const updateEstimation = async (id, data) => {
  const res = await api.patch(`/estimation/${id}`, data);
  return res.data?.data?.estimation;
};
