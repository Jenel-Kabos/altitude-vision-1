// __tests__/housekeepingService.test.js — Sprint E
// Room/HousekeepingTask mockés. `HousekeepingTask.create` reproduit la
// contrainte d'unicité partielle réelle ({room, open:true}, voir
// HousekeepingTask.js) — même méthodologie que roomAssignmentService.test.js
// (Sprint D) pour prouver l'absence de double tâche ouverte.

jest.mock('../models/Room');
jest.mock('../models/HousekeepingTask');
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const Room = require('../models/Room');
const HousekeepingTask = require('../models/HousekeepingTask');
const { notify, notifyStaff } = require('../services/notificationService');
const {
  createTask, assignTask, startTask, completeTask, cancelTask,
} = require('../services/housekeepingService');

HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS = {
  pending: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [], cancelled: [],
};

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const RESERVATION_ID = '907f1f77bcf86cd799439077';
const USER_ID = '507f1f77bcf86cd799439012';

/** Simule fidèlement la contrainte d'unicité partielle {room, open:true}. */
function makeTaskStore() {
  const openByRoom = new Map();
  let seq = 0;

  HousekeepingTask.create = jest.fn(async (data) => {
    const roomKey = String(data.room);
    if (openByRoom.has(roomKey)) { const e = new Error('duplicate'); e.code = 11000; throw e; }
    seq += 1;
    const task = {
      _id: `TASK-${seq}`, room: data.room, hotel: data.hotel, reservation: data.reservation || null,
      type: data.type, priority: data.priority || 'normal', status: 'pending', open: true,
      assignedTo: null, notes: data.notes || '', startedAt: null, completedAt: null,
      createdBy: data.createdBy || null,
    };
    task.save = jest.fn(async () => {
      if (!task.open && openByRoom.get(roomKey) === task) openByRoom.delete(roomKey);
    });
    openByRoom.set(roomKey, task);
    return task;
  });

  return { openByRoom };
}

describe('housekeepingService.createTask — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeTaskStore();
  });

  test('crée une tâche pending/open avec le type et la priorité fournis', async () => {
    const task = await createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID } });
    expect(task.status).toBe('pending');
    expect(task.open).toBe(true);
    expect(task.type).toBe('checkout_cleaning');
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'housekeeping_task_created' }));
  });

  test('refuse une seconde tâche ouverte pour la même chambre (mission §3)', async () => {
    await createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID } });
    await expect(createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('deux créations concurrentes sur la même chambre : une seule réussit', async () => {
    const [a, b] = await Promise.allSettled([
      createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID } }),
      createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh', actingUser: { id: USER_ID } }),
    ]);
    const outcomes = [a.status, b.status];
    expect(outcomes.filter((s) => s === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((s) => s === 'rejected')).toHaveLength(1);
  });

  test('une tâche ouverte sur une AUTRE chambre n\'empêche pas la création', async () => {
    await createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID } });
    const task2 = await createTask({ roomId: 'OTHER-ROOM', hotelId: HOTEL_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID } });
    expect(task2.room).toBe('OTHER-ROOM');
  });
});

describe('housekeepingService — assignTask/startTask/completeTask/cancelTask — TEST DATA', () => {
  let store;
  beforeEach(() => {
    jest.clearAllMocks();
    store = makeTaskStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'inspection' });
  });

  const createPendingTask = async () => createTask({
    roomId: ROOM_ID, hotelId: HOTEL_ID, reservationId: RESERVATION_ID, type: 'checkout_cleaning', actingUser: { id: USER_ID },
  });

  test('assignTask : pending → assigned, assignedTo renseigné, notification individuelle', async () => {
    const task = await createPendingTask();
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    const updated = await assignTask({ taskId: task._id, assignedToUserId: 'EMPLOYEE-1', actingUser: { id: USER_ID } });
    expect(updated.status).toBe('assigned');
    expect(updated.assignedTo).toBe('EMPLOYEE-1');
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'EMPLOYEE-1', type: 'housekeeping_task_assigned' }));
  });

  test('assignTask : réaffectation d\'une tâche déjà assigned à un autre employé', async () => {
    const task = await createPendingTask();
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    await assignTask({ taskId: task._id, assignedToUserId: 'EMPLOYEE-1', actingUser: { id: USER_ID } });
    const updated = await assignTask({ taskId: task._id, assignedToUserId: 'EMPLOYEE-2', actingUser: { id: USER_ID } });
    expect(updated.assignedTo).toBe('EMPLOYEE-2');
  });

  test('assignTask refuse une tâche déjà completed', async () => {
    const task = await createPendingTask();
    task.status = 'completed';
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    await expect(assignTask({ taskId: task._id, assignedToUserId: 'EMPLOYEE-1', actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('startTask : pending → in_progress, startedAt renseigné', async () => {
    const task = await createPendingTask();
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    const updated = await startTask({ taskId: task._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('in_progress');
    expect(updated.startedAt).toBeInstanceOf(Date);
  });

  test('completeTask : in_progress → completed, open passe à false, chambre cleaning → inspection', async () => {
    const task = await createPendingTask();
    task.status = 'in_progress';
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'inspection' });

    const updated = await completeTask({ taskId: task._id, actingUser: { id: USER_ID } });
    expect(updated.status).toBe('completed');
    expect(updated.open).toBe(false);
    expect(updated.completedAt).toBeInstanceOf(Date);
    expect(Room.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ROOM_ID, status: 'cleaning' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'inspection' }) }),
      { new: true },
    );
    expect(notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ type: 'housekeeping_task_completed' }));
  });

  test('completeTask libère la chambre pour une nouvelle tâche (index unique désormais inactif)', async () => {
    const task = await createPendingTask();
    task.status = 'in_progress';
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    await completeTask({ taskId: task._id, actingUser: { id: USER_ID } });
    expect(store.openByRoom.has(ROOM_ID)).toBe(false);
    const newTask = await createTask({ roomId: ROOM_ID, hotelId: HOTEL_ID, type: 'refresh', actingUser: { id: USER_ID } });
    expect(newTask.room).toBe(ROOM_ID);
  });

  test('completeTask refuse depuis pending (doit d\'abord être in_progress)', async () => {
    const task = await createPendingTask();
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    await expect(completeTask({ taskId: task._id, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('cancelTask : pending → cancelled, open passe à false', async () => {
    const task = await createPendingTask();
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    const updated = await cancelTask({ taskId: task._id, actingUser: { id: USER_ID }, reason: 'Chambre finalement non salie' });
    expect(updated.status).toBe('cancelled');
    expect(updated.open).toBe(false);
  });

  test('cancelTask refuse une tâche déjà completed', async () => {
    const task = await createPendingTask();
    task.status = 'completed';
    HousekeepingTask.findById = jest.fn().mockResolvedValue(task);
    await expect(cancelTask({ taskId: task._id, actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('404 sur une tâche introuvable (assign/start/complete/cancel)', async () => {
    HousekeepingTask.findById = jest.fn().mockResolvedValue(null);
    await expect(assignTask({ taskId: 'X', assignedToUserId: 'E', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(startTask({ taskId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(completeTask({ taskId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(cancelTask({ taskId: 'X', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});
