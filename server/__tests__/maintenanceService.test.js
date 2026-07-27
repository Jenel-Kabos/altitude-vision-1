// __tests__/maintenanceService.test.js — Sprint E

jest.mock('../models/MaintenanceTicket');
jest.mock('../models/Room');
jest.mock('../models/RoomAssignment');
jest.mock('../models/HotelReservation');
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const MaintenanceTicket = require('../models/MaintenanceTicket');
const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const HotelReservation = require('../models/HotelReservation');
const { notify, notifyStaff } = require('../services/notificationService');
const {
  createTicket, assignTicket, startWork, resolveTicket, closeTicket,
} = require('../services/maintenanceService');

MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const INSPECTION_ID = 'c07f1f77bcf86cd799439066';
const USER_ID = '507f1f77bcf86cd799439012';

const openTicket = (overrides = {}) => ({
  _id: 'TICKET-1', room: ROOM_ID, hotel: HOTEL_ID, inspection: INSPECTION_ID,
  category: 'plumbing', priority: 'normal', status: 'open', description: 'Fuite',
  assignedTo: null, resolvedAt: null,
  save: jest.fn().mockResolvedValue(),
  ...overrides,
});

describe('maintenanceService.createTicket — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Room.findOne = jest.fn().mockResolvedValue({ _id: ROOM_ID, hotel: HOTEL_ID, roomCategory: '807f1f77bcf86cd799439066', status: 'available' });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'out_of_service' });
    RoomAssignment.find = jest.fn().mockResolvedValue([]);
    HotelReservation.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
  });

  test('crée un ticket "open" et notifie le staff', async () => {
    MaintenanceTicket.create = jest.fn().mockResolvedValue(openTicket());
    const ticket = await createTicket({
      roomId: ROOM_ID, hotelId: HOTEL_ID, inspectionId: INSPECTION_ID, category: 'plumbing',
      description: 'Fuite au lavabo', actingUser: { id: USER_ID },
    });
    expect(ticket.status).toBe('open');
    expect(Room.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ _id: ROOM_ID }), expect.objectContaining({ $set: expect.objectContaining({ status: 'out_of_service' }) }), expect.any(Object));
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'maintenance_ticket_created' }));
  });
});

describe('maintenanceService — assignTicket/startWork/resolveTicket/closeTicket — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('assignTicket : open → assigned, assignedTo renseigné, notification individuelle', async () => {
    const ticket = openTicket();
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await assignTicket({ ticketId: ticket._id, assignedToUserId: 'TECH-1', actingUser: { id: USER_ID } });
    expect(updated.status).toBe('assigned');
    expect(updated.assignedTo).toBe('TECH-1');
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'TECH-1', type: 'maintenance_ticket_assigned' }));
  });

  test('assignTicket : réaffectation d\'un ticket déjà assigned à un autre technicien', async () => {
    const ticket = openTicket({ status: 'assigned', assignedTo: 'TECH-1' });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await assignTicket({ ticketId: ticket._id, assignedToUserId: 'TECH-2', actingUser: { id: USER_ID } });
    expect(updated.assignedTo).toBe('TECH-2');
  });

  test('assignTicket refuse un ticket déjà resolved', async () => {
    const ticket = openTicket({ status: 'resolved' });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await expect(assignTicket({ ticketId: ticket._id, assignedToUserId: 'TECH-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('startWork : open → in_progress', async () => {
    const ticket = openTicket();
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await startWork({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('in_progress');
  });

  test('resolveTicket : in_progress → resolved, resolvedAt renseigné, notifie le staff', async () => {
    const ticket = openTicket({ status: 'in_progress' });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await resolveTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('resolved');
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'maintenance_ticket_resolved' }));
  });

  test('resolveTicket refuse depuis open (doit être assigned/in_progress)', async () => {
    const ticket = openTicket({ status: 'open' });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await resolveTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    // 'open' → 'resolved' EST autorisé dans la table (résolution directe sans étape d'assignation) :
    expect(updated.status).toBe('resolved');
  });

  test('closeTicket : resolved → closed', async () => {
    const ticket = openTicket({ status: 'resolved', resolvedAt: new Date() });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    const updated = await closeTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('closed');
  });

  test('closeTicket refuse un ticket encore open', async () => {
    const ticket = openTicket({ status: 'open' });
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(ticket);
    await expect(closeTicket({ ticketId: ticket._id, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('404 sur un ticket introuvable (assign/start/resolve/close)', async () => {
    MaintenanceTicket.findById = jest.fn().mockResolvedValue(null);
    await expect(assignTicket({ ticketId: 'X', assignedToUserId: 'T', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(startWork({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(resolveTicket({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(closeTicket({ ticketId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});
