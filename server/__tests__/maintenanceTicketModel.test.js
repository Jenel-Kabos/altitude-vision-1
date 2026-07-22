// __tests__/maintenanceTicketModel.test.js — Sprint E, schéma réel (non mocké).

const MaintenanceTicket = require('../models/MaintenanceTicket');

const ROOM_ID = 'a07f1f77bcf86cd799439088';
const HOTEL_ID = '707f1f77bcf86cd799439055';

const base = (overrides = {}) => new MaintenanceTicket({
  room: ROOM_ID, hotel: HOTEL_ID, category: 'plumbing', description: 'Fuite au niveau du lavabo.',
  ...overrides,
});

describe('MaintenanceTicket model — TEST DATA', () => {
  test('valeurs par défaut : priority=normal, status=open', async () => {
    const ticket = base();
    await expect(ticket.validate()).resolves.toBeUndefined();
    expect(ticket.priority).toBe('normal');
    expect(ticket.status).toBe('open');
    expect(ticket.resolvedAt).toBeNull();
    expect(ticket.inspection).toBeNull();
  });

  test('room/hotel/category/description sont requis', () => {
    const ticket = new MaintenanceTicket({});
    const errors = ticket.validateSync()?.errors || {};
    expect(errors.room).toBeDefined();
    expect(errors.hotel).toBeDefined();
    expect(errors.category).toBeDefined();
    expect(errors.description).toBeDefined();
  });

  test('category accepte uniquement plumbing/electricity/furniture/cleanliness/security/other', () => {
    expect(MaintenanceTicket.MAINTENANCE_CATEGORIES).toEqual(['plumbing', 'electricity', 'furniture', 'cleanliness', 'security', 'other']);
    const ticket = base({ category: 'other_stuff' });
    const errors = ticket.validateSync()?.errors || {};
    expect(errors.category).toBeDefined();
  });

  test('status accepte uniquement open/assigned/in_progress/resolved/closed', () => {
    expect(MaintenanceTicket.MAINTENANCE_STATUSES).toEqual(['open', 'assigned', 'in_progress', 'resolved', 'closed']);
    const ticket = base({ status: 'unknown' });
    const errors = ticket.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('un index {room}, {status} et {hotel,status} sont déclarés', () => {
    const indexes = MaintenanceTicket.schema.indexes();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.room === 1)).toBeDefined();
    expect(indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.status === 1)).toBeDefined();
    expect(indexes.find(([keys]) => keys.hotel === 1 && keys.status === 1)).toBeDefined();
  });

  test('OPEN_MAINTENANCE_STATUSES = open/assigned/in_progress (mission §8)', () => {
    expect(MaintenanceTicket.OPEN_MAINTENANCE_STATUSES).toEqual(['open', 'assigned', 'in_progress']);
  });

  describe('MAINTENANCE_STATUS_TRANSITIONS', () => {
    test('resolved → closed uniquement', () => {
      expect(MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS.resolved).toEqual(['closed']);
    });
    test('closed est terminal', () => {
      expect(MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS.closed).toEqual([]);
    });
  });
});
