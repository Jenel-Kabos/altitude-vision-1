import api from './api';

// ── Sprint E — tickets de maintenance (MaintenanceTicket) ──

export const getMaintenanceTickets = async (params = {}) => {
  const res = await api.get('/maintenance', { params });
  return res.data.data.tickets;
};

export const createMaintenanceTicket = async (data) => {
  const res = await api.post('/maintenance', data);
  return res.data.data.ticket;
};

export const assignMaintenanceTicket = async (id, assignedToUserId) => {
  const res = await api.patch(`/maintenance/${id}/assign`, { assignedToUserId });
  return res.data.data.ticket;
};

export const startMaintenanceWork = async (id) => {
  const res = await api.patch(`/maintenance/${id}/start`);
  return res.data.data.ticket;
};

export const resolveMaintenanceTicket = async (id) => {
  const res = await api.patch(`/maintenance/${id}/resolve`);
  return res.data.data.ticket;
};

export const closeMaintenanceTicket = async (id) => {
  const res = await api.patch(`/maintenance/${id}/close`);
  return res.data.data.ticket;
};
