import api from './api';
import { rentalRequestConfig } from './rentalRequestContext';

// ── Sprint GL-B2 — maintenance LOCATIVE (distincte de /api/maintenance, hôtelier) ──

export const getRentalMaintenanceTickets = async (params = {}, rentalContext) => {
  const res = await api.get('/rental-maintenance', rentalRequestConfig(rentalContext, params));
  return res.data.data.tickets;
};

export const createRentalMaintenanceTicket = async (data, rentalContext) => {
  const res = await api.post('/rental-maintenance', data, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};

export const assignRentalMaintenanceTicket = async (id, assignedToUserId, rentalContext) => {
  const res = await api.patch(`/rental-maintenance/${id}/assign`, { assignedToUserId }, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};

export const scheduleRentalMaintenanceTicket = async (id, scheduledFor, rentalContext) => {
  const res = await api.patch(`/rental-maintenance/${id}/schedule`, { scheduledFor }, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};

export const startRentalMaintenanceWork = async (id, rentalContext) => {
  const res = await api.patch(`/rental-maintenance/${id}/start`, {}, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};

export const resolveRentalMaintenanceTicket = async (id, actualCost, rentalContext) => {
  const res = await api.patch(`/rental-maintenance/${id}/resolve`, { actualCost }, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};

export const closeRentalMaintenanceTicket = async (id, rentalContext) => {
  const res = await api.patch(`/rental-maintenance/${id}/close`, {}, rentalRequestConfig(rentalContext));
  return res.data.data.ticket;
};
