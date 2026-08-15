jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '../api';
import {
  approveInspection, assignHousekeepingTask, cancelHousekeepingTask, completeHousekeepingTask,
  createInspection, getHousekeepingTasks, rejectInspection, startHousekeepingTask,
} from '../housekeepingService';

describe('housekeepingService — contrat exact server/routes/housekeepingRoutes.js', () => {
  test('getHousekeepingTasks transmet les filtres en query et retourne tasks', async () => {
    api.get.mockResolvedValue({ data: { data: { tasks: [{ _id: 't1' }] } } });
    const result = await getHousekeepingTasks({ hotelId: 'hotel-1', status: 'pending' });
    expect(api.get).toHaveBeenCalledWith('/housekeeping', { params: { hotelId: 'hotel-1', status: 'pending' } });
    expect(result).toEqual([{ _id: 't1' }]);
  });

  test('assignHousekeepingTask appelle PATCH /:id/assign avec assignedToUserId', async () => {
    api.patch.mockResolvedValue({ data: { data: { task: { _id: 't1', status: 'assigned' } } } });
    const result = await assignHousekeepingTask('t1', 'user-9');
    expect(api.patch).toHaveBeenCalledWith('/housekeeping/t1/assign', { assignedToUserId: 'user-9' });
    expect(result).toEqual({ _id: 't1', status: 'assigned' });
  });

  test('startHousekeepingTask / completeHousekeepingTask / cancelHousekeepingTask ciblent les bonnes routes', async () => {
    api.patch.mockResolvedValue({ data: { data: { task: {} } } });
    await startHousekeepingTask('t1');
    expect(api.patch).toHaveBeenCalledWith('/housekeeping/t1/start');
    await completeHousekeepingTask('t1');
    expect(api.patch).toHaveBeenCalledWith('/housekeeping/t1/complete');
    await cancelHousekeepingTask('t1', 'raison');
    expect(api.patch).toHaveBeenCalledWith('/housekeeping/t1/cancel', { reason: 'raison' });
  });

  test('createInspection envoie roomId/housekeepingTaskId/notes, jamais un statut décidé côté mobile', async () => {
    api.post.mockResolvedValue({ data: { data: { inspection: { _id: 'insp-1', result: null } } } });
    const result = await createInspection({ roomId: 'room-1', housekeepingTaskId: 't1', notes: 'ok' });
    expect(api.post).toHaveBeenCalledWith('/inspections', { roomId: 'room-1', housekeepingTaskId: 't1', notes: 'ok' });
    expect(result.result).toBeNull();
  });

  test('approveInspection / rejectInspection ciblent PATCH /:id/approve|reject', async () => {
    api.patch.mockResolvedValue({ data: { data: { inspection: {}, room: {} } } });
    await approveInspection('insp-1');
    expect(api.patch).toHaveBeenCalledWith('/inspections/insp-1/approve');
    await rejectInspection('insp-1', 'échec');
    expect(api.patch).toHaveBeenCalledWith('/inspections/insp-1/reject', { notes: 'échec' });
  });
});
