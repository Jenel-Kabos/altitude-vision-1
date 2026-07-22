// __tests__/housekeepingTaskModel.test.js — Sprint E, schéma réel (non mocké).

const HousekeepingTask = require('../models/HousekeepingTask');

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const HOTEL_ID = '707f1f77bcf86cd799439055';

const base = (overrides = {}) => new HousekeepingTask({
  room: ROOM_ID, hotel: HOTEL_ID, type: 'checkout_cleaning',
  ...overrides,
});

describe('HousekeepingTask model — TEST DATA', () => {
  test('valeurs par défaut : priority=normal, status=pending, open=true', async () => {
    const task = base();
    await expect(task.validate()).resolves.toBeUndefined();
    expect(task.priority).toBe('normal');
    expect(task.status).toBe('pending');
    expect(task.open).toBe(true);
    expect(task.reservation).toBeNull();
    expect(task.assignedTo).toBeNull();
  });

  test('room/hotel/type sont requis', () => {
    const task = new HousekeepingTask({});
    const errors = task.validateSync()?.errors || {};
    expect(errors.room).toBeDefined();
    expect(errors.hotel).toBeDefined();
    expect(errors.type).toBeDefined();
  });

  test('type accepte uniquement checkout_cleaning/refresh/deep_cleaning', () => {
    expect(HousekeepingTask.HOUSEKEEPING_TYPES).toEqual(['checkout_cleaning', 'refresh', 'deep_cleaning']);
    const task = base({ type: 'invalid_type' });
    const errors = task.validateSync()?.errors || {};
    expect(errors.type).toBeDefined();
  });

  test('priority accepte uniquement low/normal/high/urgent', () => {
    expect(HousekeepingTask.HOUSEKEEPING_PRIORITIES).toEqual(['low', 'normal', 'high', 'urgent']);
    const task = base({ priority: 'critical' });
    const errors = task.validateSync()?.errors || {};
    expect(errors.priority).toBeDefined();
  });

  test('status accepte uniquement pending/assigned/in_progress/completed/cancelled', () => {
    expect(HousekeepingTask.HOUSEKEEPING_STATUSES).toEqual(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']);
    const task = base({ status: 'done' });
    const errors = task.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('un index unique partiel {room, open:true} est déclaré (mission §3, anti double-tâche ouverte)', () => {
    const indexes = HousekeepingTask.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.room === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
    expect(idx[1].partialFilterExpression).toEqual({ open: true });
  });

  test('un index {status} et {hotel,status} sont déclarés', () => {
    const indexes = HousekeepingTask.schema.indexes();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.status === 1)).toBeDefined();
    expect(indexes.find(([keys]) => keys.hotel === 1 && keys.status === 1)).toBeDefined();
  });

  describe('HOUSEKEEPING_STATUS_TRANSITIONS', () => {
    test('pending → assigned/in_progress/cancelled', () => {
      expect(HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS.pending).toEqual(['assigned', 'in_progress', 'cancelled']);
    });
    test('completed et cancelled sont terminaux', () => {
      expect(HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS.completed).toEqual([]);
      expect(HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS.cancelled).toEqual([]);
    });
  });

  test('OPEN_HOUSEKEEPING_STATUSES = pending/assigned/in_progress', () => {
    expect(HousekeepingTask.OPEN_HOUSEKEEPING_STATUSES).toEqual(['pending', 'assigned', 'in_progress']);
  });
});
