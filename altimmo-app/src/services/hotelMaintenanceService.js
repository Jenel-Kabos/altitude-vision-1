import api from './api';

// SYNC-2B — pur wrapper HTTP autour de /api/maintenance (Sprint E,
// server/controllers/maintenanceController.js, modèle `MaintenanceTicket`),
// même contrat que client/lib/services/maintenanceService.js. Nommé
// `hotelMaintenanceService` (jamais `maintenanceService` seul) pour ne
// jamais être confondu avec la maintenance locative GL
// (`tenantPortalService.js`, modèle `MaintenanceTicket` DIFFÉRENT côté GL :
// `RentalMaintenanceTicket`) — deux modèles distincts, jamais fusionnés.

export const getHotelMaintenanceTickets = async (params = {}) => (await api.get('/maintenance', { params })).data.data.tickets;
export const assignMaintenanceTicket = async (id, assignedToUserId) => (await api.patch(`/maintenance/${id}/assign`, { assignedToUserId })).data.data.ticket;
export const startMaintenanceWork = async (id) => (await api.patch(`/maintenance/${id}/start`)).data.data.ticket;
export const resolveMaintenanceTicket = async (id) => (await api.patch(`/maintenance/${id}/resolve`)).data.data.ticket;
export const closeMaintenanceTicket = async (id) => (await api.patch(`/maintenance/${id}/close`)).data.data.ticket;
export const createMaintenanceTicket = async ({ roomId, hotelId, inspectionId, category, priority, description }) =>
  (await api.post('/maintenance', { roomId, hotelId, inspectionId, category, priority, description })).data.data.ticket;
