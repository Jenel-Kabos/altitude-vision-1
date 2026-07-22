import api from './api';

// ── Sprint GL-B2 — maintenance LOCATIVE (distincte de /api/maintenance, hôtelier) ──

export const getRentalMaintenanceTickets = async (params = {}) => {
  const res = await api.get('/rental-maintenance', { params });
  return res.data.data.tickets;
};

export const createRentalMaintenanceTicket = async (data) => {
  const res = await api.post('/rental-maintenance', data);
  return res.data.data.ticket;
};

export const assignRentalMaintenanceTicket = async (id, assignedToUserId) => {
  const res = await api.patch(`/rental-maintenance/${id}/assign`, { assignedToUserId });
  return res.data.data.ticket;
};

export const scheduleRentalMaintenanceTicket = async (id, scheduledFor) => {
  const res = await api.patch(`/rental-maintenance/${id}/schedule`, { scheduledFor });
  return res.data.data.ticket;
};

export const startRentalMaintenanceWork = async (id) => {
  const res = await api.patch(`/rental-maintenance/${id}/start`);
  return res.data.data.ticket;
};

export const resolveRentalMaintenanceTicket = async (id, actualCost) => {
  const res = await api.patch(`/rental-maintenance/${id}/resolve`, { actualCost });
  return res.data.data.ticket;
};

export const closeRentalMaintenanceTicket = async (id) => {
  const res = await api.patch(`/rental-maintenance/${id}/close`);
  return res.data.data.ticket;
};
