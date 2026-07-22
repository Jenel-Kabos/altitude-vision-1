// __tests__/inspectionService.test.js — Sprint E

jest.mock('../models/Room');
jest.mock('../models/RoomInspection');
jest.mock('../models/MaintenanceTicket');
jest.mock('../services/notificationService', () => ({ notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const Room = require('../models/Room');
const RoomInspection = require('../models/RoomInspection');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const { notifyStaff } = require('../services/notificationService');
const { createInspection, approveInspection, rejectInspection } = require('../services/inspectionService');

MaintenanceTicket.OPEN_MAINTENANCE_STATUSES = ['open', 'assigned', 'in_progress'];

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const TASK_ID = 'b07f1f77bcf86cd799439077';
const INSPECTOR_ID = '507f1f77bcf86cd799439012';
const USER_ID = INSPECTOR_ID;

describe('inspectionService.createInspection — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crée une inspection quand la chambre est en attente (status "inspection")', async () => {
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'inspection' });
    RoomInspection.create = jest.fn().mockResolvedValue({ _id: 'INSPECT-1', room: ROOM_ID, result: null });

    const inspection = await createInspection({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID, inspectorId: INSPECTOR_ID, actingUser: { id: USER_ID } });
    expect(inspection.result).toBeNull();
    expect(RoomInspection.create).toHaveBeenCalledWith(expect.objectContaining({ room: ROOM_ID, housekeepingTask: TASK_ID, inspector: INSPECTOR_ID }));
  });

  test('transitionne out_of_service → inspection pour une ré-inspection post-maintenance (mission §9)', async () => {
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'out_of_service' });
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'inspection' });
    RoomInspection.create = jest.fn().mockResolvedValue({ _id: 'INSPECT-2', room: ROOM_ID, result: null });

    await createInspection({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID, inspectorId: INSPECTOR_ID, actingUser: { id: USER_ID } });
    expect(Room.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ROOM_ID, status: 'out_of_service' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'inspection' }) }),
      { new: true },
    );
  });

  test('409 si la chambre n\'est ni "inspection" ni "out_of_service"', async () => {
    Room.findById = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'available' });
    await expect(createInspection({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID, inspectorId: INSPECTOR_ID, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('404 si la chambre est introuvable', async () => {
    Room.findById = jest.fn().mockResolvedValue(null);
    await expect(createInspection({ roomId: ROOM_ID, housekeepingTaskId: TASK_ID, inspectorId: INSPECTOR_ID, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inspectionService.approveInspection — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  const pendingInspection = (overrides = {}) => ({
    _id: 'INSPECT-1', room: ROOM_ID, housekeepingTask: TASK_ID, inspector: INSPECTOR_ID,
    result: null, notes: '', save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('passed : la chambre passe inspection → available', async () => {
    const inspection = pendingInspection();
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    MaintenanceTicket.findOne = jest.fn().mockResolvedValue(null);
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'available' });

    const result = await approveInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID } });
    expect(result.inspection.result).toBe('passed');
    expect(result.room.status).toBe('available');
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'room_returned_to_service' }));
  });

  test('409 si un ticket de maintenance ouvert existe encore pour la chambre (mission §8)', async () => {
    const inspection = pendingInspection();
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    MaintenanceTicket.findOne = jest.fn().mockResolvedValue({ _id: 'TICKET-1', status: 'in_progress' });

    await expect(approveInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(inspection.save).not.toHaveBeenCalled();
  });

  test('409 si l\'inspection a déjà été tranchée', async () => {
    const inspection = pendingInspection({ result: 'passed' });
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    await expect(approveInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('409 si la chambre n\'est plus en statut "inspection" (course perdue)', async () => {
    const inspection = pendingInspection();
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    MaintenanceTicket.findOne = jest.fn().mockResolvedValue(null);
    Room.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    await expect(approveInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(inspection.save).not.toHaveBeenCalled();
  });

  test('404 si l\'inspection est introuvable', async () => {
    RoomInspection.findById = jest.fn().mockResolvedValue(null);
    await expect(approveInspection({ inspectionId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inspectionService.rejectInspection — TEST DATA', () => {
  beforeEach(() => jest.clearAllMocks());

  const pendingInspection = (overrides = {}) => ({
    _id: 'INSPECT-1', room: ROOM_ID, housekeepingTask: TASK_ID, inspector: INSPECTOR_ID,
    result: null, notes: '', save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  test('failed : la chambre passe inspection → out_of_service', async () => {
    const inspection = pendingInspection();
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'out_of_service' });

    const result = await rejectInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID }, notes: 'Robinet cassé' });
    expect(result.inspection.result).toBe('failed');
    expect(result.room.status).toBe('out_of_service');
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'room_inspection_failed' }));
  });

  test('409 si l\'inspection a déjà été tranchée', async () => {
    const inspection = pendingInspection({ result: 'failed' });
    RoomInspection.findById = jest.fn().mockResolvedValue(inspection);
    await expect(rejectInspection({ inspectionId: 'INSPECT-1', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('404 si l\'inspection est introuvable', async () => {
    RoomInspection.findById = jest.fn().mockResolvedValue(null);
    await expect(rejectInspection({ inspectionId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});
