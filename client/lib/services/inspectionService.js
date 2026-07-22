import api from './api';

// ── Sprint E — inspections de chambre (RoomInspection) ──

export const createInspection = async ({ roomId, housekeepingTaskId, notes }) => {
  const res = await api.post('/inspections', { roomId, housekeepingTaskId, notes });
  return res.data.data.inspection;
};

export const approveInspection = async (id) => {
  const res = await api.patch(`/inspections/${id}/approve`);
  return res.data.data; // { inspection, room }
};

export const rejectInspection = async (id, notes) => {
  const res = await api.patch(`/inspections/${id}/reject`, { notes });
  return res.data.data; // { inspection, room }
};
