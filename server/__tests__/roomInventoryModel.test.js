// __tests__/roomInventoryModel.test.js — Sprint C, schéma réel (non mocké).

const RoomInventory = require('../models/RoomInventory');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new RoomInventory({
  hotel: HOTEL_ID,
  roomCategory: CATEGORY_ID,
  date: new Date('2026-08-10T00:00:00Z'),
  totalUnits: 5,
  ...overrides,
});

describe('RoomInventory model — TEST DATA', () => {
  test('valeurs par défaut : blockedUnits/reservedUnits=0, isClosed/stopSell=false', async () => {
    const inv = base();
    await expect(inv.validate()).resolves.toBeUndefined();
    expect(inv.blockedUnits).toBe(0);
    expect(inv.reservedUnits).toBe(0);
    expect(inv.isClosed).toBe(false);
    expect(inv.stopSell).toBe(false);
  });

  test('hotel/roomCategory/date/totalUnits sont requis', () => {
    const inv = new RoomInventory({});
    const errors = inv.validateSync()?.errors || {};
    expect(errors.hotel).toBeDefined();
    expect(errors.roomCategory).toBeDefined();
    expect(errors.date).toBeDefined();
    expect(errors.totalUnits).toBeDefined();
  });

  test('un index unique {roomCategory, date} est déclaré (contrainte centrale mission §3)', () => {
    const indexes = RoomInventory.schema.indexes();
    const idx = indexes.find(([keys]) => keys.roomCategory === 1 && keys.date === 1);
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
  });

  test('un index {hotel, date} existe (vue dashboard, non-unique)', () => {
    const indexes = RoomInventory.schema.indexes();
    const idx = indexes.find(([keys]) => keys.hotel === 1 && keys.date === 1 && Object.keys(keys).length === 2);
    expect(idx).toBeDefined();
  });

  describe('availableUnits — règle de disponibilité (mission §3)', () => {
    test('availableUnits = totalUnits - blockedUnits - reservedUnits', () => {
      const inv = base({ totalUnits: 10, blockedUnits: 2, reservedUnits: 3 });
      expect(inv.availableUnits).toBe(5);
    });

    test('availableUnits ne descend jamais sous zéro (sur-réservation défensive)', () => {
      const inv = base({ totalUnits: 5, blockedUnits: 2, reservedUnits: 10 });
      expect(inv.availableUnits).toBe(0);
    });

    test('availableUnits est bien un virtuel (jamais persisté)', () => {
      const inv = base({ totalUnits: 10, reservedUnits: 4 });
      const obj = inv.toObject();
      // `toObject({virtuals:true})` est configuré par défaut sur ce schéma —
      // le champ apparaît donc dans la sortie, mais n'est jamais stocké tel
      // quel dans le document Mongo sous-jacent (pas de `type` dans le schéma).
      expect(RoomInventory.schema.path('availableUnits')).toBeUndefined();
      expect(obj.availableUnits).toBe(6);
    });
  });

  test('reservedUnits et blockedUnits ne peuvent pas être négatifs', () => {
    const inv = base({ blockedUnits: -1, reservedUnits: -1 });
    const errors = inv.validateSync()?.errors || {};
    expect(errors.blockedUnits).toBeDefined();
    expect(errors.reservedUnits).toBeDefined();
  });
});
