// __tests__/roomModel.test.js — Sprint D, schéma réel (non mocké).

const Room = require('../models/Room');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new Room({
  hotel: HOTEL_ID, roomCategory: CATEGORY_ID, roomNumber: '101', createdBy: USER_ID,
  ...overrides,
});

describe('Room model — TEST DATA', () => {
  test('valeurs par défaut : status=available, active=true, floor=0, features=[]', async () => {
    const room = base();
    await expect(room.validate()).resolves.toBeUndefined();
    expect(room.status).toBe('available');
    expect(room.active).toBe(true);
    expect(room.floor).toBe(0);
    expect(room.features).toEqual([]);
  });

  test('hotel/roomCategory/roomNumber/createdBy sont requis', () => {
    const room = new Room({});
    const errors = room.validateSync()?.errors || {};
    expect(errors.hotel).toBeDefined();
    expect(errors.roomCategory).toBeDefined();
    expect(errors.roomNumber).toBeDefined();
    expect(errors.createdBy).toBeDefined();
  });

  test('status accepte uniquement available/occupied/reserved/out_of_service/cleaning/inspection', () => {
    expect(Room.ROOM_STATUSES).toEqual(['available', 'occupied', 'reserved', 'out_of_service', 'cleaning', 'inspection']);
    expect(Room.ROOM_STATUSES).not.toContain('maintenance');
    const room = base();
    room.status = 'maintenance';
    const errors = room.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('un index unique {hotel, roomNumber} est déclaré', () => {
    const indexes = Room.schema.indexes();
    const idx = indexes.find(([keys]) => keys.hotel === 1 && keys.roomNumber === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
  });

  test('un index {status} est déclaré', () => {
    const indexes = Room.schema.indexes();
    const idx = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.status === 1);
    expect(idx).toBeDefined();
  });

  describe('ROOM_STATUS_TRANSITIONS — mission §7', () => {
    test('available → reserved/occupied/out_of_service', () => {
      expect(Room.ROOM_STATUS_TRANSITIONS.available).toEqual(expect.arrayContaining(['reserved', 'occupied']));
    });

    test('occupied ne peut JAMAIS transiter directement vers available (check-out obligatoire)', () => {
      expect(Room.ROOM_STATUS_TRANSITIONS.occupied).not.toContain('available');
      expect(Room.ROOM_STATUS_TRANSITIONS.occupied).toContain('cleaning');
    });

    test('cleaning → inspection → available (chaîne complète)', () => {
      expect(Room.ROOM_STATUS_TRANSITIONS.cleaning).toContain('inspection');
      expect(Room.ROOM_STATUS_TRANSITIONS.inspection).toContain('available');
    });
  });
});
