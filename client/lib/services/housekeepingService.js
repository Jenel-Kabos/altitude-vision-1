import api from './api';

// ── Sprint E — ménage (HousekeepingTask) ──

export const getHousekeepingTasks = async (params = {}) => {
  const res = await api.get('/housekeeping', { params });
  return res.data.data.tasks;
};

export const createHousekeepingTask = async (data) => {
  const res = await api.post('/housekeeping', data);
  return res.data.data.task;
};

export const assignHousekeepingTask = async (id, assignedToUserId) => {
  const res = await api.patch(`/housekeeping/${id}/assign`, { assignedToUserId });
  return res.data.data.task;
};

export const startHousekeepingTask = async (id) => {
  const res = await api.patch(`/housekeeping/${id}/start`);
  return res.data.data.task;
};

export const completeHousekeepingTask = async (id) => {
  const res = await api.patch(`/housekeeping/${id}/complete`);
  return res.data.data.task;
};

export const cancelHousekeepingTask = async (id, reason) => {
  const res = await api.patch(`/housekeeping/${id}/cancel`, { reason });
  return res.data.data.task;
};
