// __tests__/roomAssignmentModel.test.js — Sprint D, schéma réel (non mocké).

const RoomAssignment = require('../models/RoomAssignment');

const RESERVATION_ID = '907f1f77bcf86cd799439077';
const ROOM_ID = 'a07f1f77bcf86cd799439088';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new RoomAssignment({
  reservation: RESERVATION_ID, room: ROOM_ID, assignedBy: USER_ID,
  ...overrides,
});

describe('RoomAssignment model — TEST DATA', () => {
  test('reservation et room sont requis', () => {
    const a = new RoomAssignment({});
    const errors = a.validateSync()?.errors || {};
    expect(errors.reservation).toBeDefined();
    expect(errors.room).toBeDefined();
  });

  test('releasedAt est null par défaut (affectation active)', async () => {
    const a = base();
    await expect(a.validate()).resolves.toBeUndefined();
    expect(a.releasedAt).toBeNull();
  });

  test('assignedAt par défaut = maintenant', async () => {
    const before = Date.now();
    const a = base();
    await expect(a.validate()).resolves.toBeUndefined();
    expect(a.assignedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  test("un index unique partiel {room} sur affectations actives (releasedAt null) est déclaré — anti double-affectation", () => {
    const indexes = RoomAssignment.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.room === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
    expect(idx[1].partialFilterExpression).toBeDefined();
  });

  test("un index unique partiel {reservation} sur affectations actives est déclaré (une seule chambre par réservation, mission §3)", () => {
    const indexes = RoomAssignment.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.reservation === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
    expect(idx[1].partialFilterExpression).toBeDefined();
  });
});
