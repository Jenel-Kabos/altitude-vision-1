jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '../api';
import {
  assignMaintenanceTicket, closeMaintenanceTicket, createMaintenanceTicket, getHotelMaintenanceTickets,
  resolveMaintenanceTicket, startMaintenanceWork,
} from '../hotelMaintenanceService';

describe('hotelMaintenanceService — contrat exact server/routes/maintenanceRoutes.js', () => {
  test('getHotelMaintenanceTickets transmet les filtres et retourne tickets', async () => {
    api.get.mockResolvedValue({ data: { data: { tickets: [{ _id: 'm1' }] } } });
    const result = await getHotelMaintenanceTickets({ hotelId: 'hotel-1', status: 'open' });
    expect(api.get).toHaveBeenCalledWith('/maintenance', { params: { hotelId: 'hotel-1', status: 'open' } });
    expect(result).toEqual([{ _id: 'm1' }]);
  });

  test('createMaintenanceTicket envoie exactement les champs attendus par le contrôleur', async () => {
    api.post.mockResolvedValue({ data: { data: { ticket: { _id: 'm1' } } } });
    await createMaintenanceTicket({ roomId: 'room-1', hotelId: 'hotel-1', inspectionId: 'insp-1', category: 'plumbing', priority: 'high', description: 'Fuite' });
    expect(api.post).toHaveBeenCalledWith('/maintenance', {
      roomId: 'room-1', hotelId: 'hotel-1', inspectionId: 'insp-1', category: 'plumbing', priority: 'high', description: 'Fuite',
    });
  });

  test('assign/start/resolve/close ciblent les bonnes routes PATCH', async () => {
    api.patch.mockResolvedValue({ data: { data: { ticket: {} } } });
    await assignMaintenanceTicket('m1', 'user-9');
    expect(api.patch).toHaveBeenCalledWith('/maintenance/m1/assign', { assignedToUserId: 'user-9' });
    await startMaintenanceWork('m1');
    expect(api.patch).toHaveBeenCalledWith('/maintenance/m1/start');
    await resolveMaintenanceTicket('m1');
    expect(api.patch).toHaveBeenCalledWith('/maintenance/m1/resolve');
    await closeMaintenanceTicket('m1');
    expect(api.patch).toHaveBeenCalledWith('/maintenance/m1/close');
  });
});
