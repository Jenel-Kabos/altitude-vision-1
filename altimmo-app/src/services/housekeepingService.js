import api from './api';

// SYNC-2B — pur wrapper HTTP autour de /api/housekeeping et /api/inspections
// (Sprint E, server/controllers/housekeepingController.js,
// inspectionController.js), même contrat que
// client/lib/services/housekeepingService.js et inspectionService.js.
// Aucune règle métier ici : la transition de la chambre (cleaning →
// inspection → available/out_of_service) reste décidée par le backend.

export const getHousekeepingTasks = async (params = {}) => (await api.get('/housekeeping', { params })).data.data.tasks;
export const assignHousekeepingTask = async (id, assignedToUserId) => (await api.patch(`/housekeeping/${id}/assign`, { assignedToUserId })).data.data.task;
export const startHousekeepingTask = async (id) => (await api.patch(`/housekeeping/${id}/start`)).data.data.task;
export const completeHousekeepingTask = async (id) => (await api.patch(`/housekeeping/${id}/complete`)).data.data.task;
export const cancelHousekeepingTask = async (id, reason) => (await api.patch(`/housekeeping/${id}/cancel`, { reason })).data.data.task;

// Inspection : pas d'endpoint de liste (voir ETAT_INITIAL) — une inspection
// est créée à la demande depuis une tâche `completed`, son id est ensuite
// gardé en état local le temps de la décision, exactement comme le Web.
export const createInspection = async ({ roomId, housekeepingTaskId, notes }) =>
  (await api.post('/inspections', { roomId, housekeepingTaskId, notes })).data.data.inspection;
export const approveInspection = async (id) => (await api.patch(`/inspections/${id}/approve`)).data.data;
export const rejectInspection = async (id, notes) => (await api.patch(`/inspections/${id}/reject`, { notes })).data.data;
