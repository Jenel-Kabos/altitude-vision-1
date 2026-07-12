// client/lib/services/signalementService.js
import api from './api';

export const getAllSignalements = async () => {
  const res = await api.get('/signalements');
  return res.data?.data || [];
};

export const traiterSignalement = async (id, data) => {
  const res = await api.patch(`/signalements/${id}/traiter`, data);
  return res.data;
};
