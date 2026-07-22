// __tests__/roomInspectionModel.test.js — Sprint E, schéma réel (non mocké).

const RoomInspection = require('../models/RoomInspection');

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const TASK_ID = 'b07f1f77bcf86cd799439077';
const INSPECTOR_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new RoomInspection({
  room: ROOM_ID, housekeepingTask: TASK_ID, inspector: INSPECTOR_ID,
  ...overrides,
});

describe('RoomInspection model — TEST DATA', () => {
  test('result est null par défaut (décision pas encore rendue)', async () => {
    const inspection = base();
    await expect(inspection.validate()).resolves.toBeUndefined();
    expect(inspection.result).toBeNull();
    expect(inspection.inspectedAt).toBeNull();
  });

  test('room/housekeepingTask/inspector sont requis', () => {
    const inspection = new RoomInspection({});
    const errors = inspection.validateSync()?.errors || {};
    expect(errors.room).toBeDefined();
    expect(errors.housekeepingTask).toBeDefined();
    expect(errors.inspector).toBeDefined();
  });

  test('result accepte uniquement passed/failed', () => {
    expect(RoomInspection.ROOM_INSPECTION_RESULTS).toEqual(['passed', 'failed']);
    const inspection = base({ result: 'maybe' });
    const errors = inspection.validateSync()?.errors || {};
    expect(errors.result).toBeDefined();
  });

  test('un index {room} et {housekeepingTask} sont déclarés', () => {
    const indexes = RoomInspection.schema.indexes();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.room === 1)).toBeDefined();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.housekeepingTask === 1)).toBeDefined();
  });
});
