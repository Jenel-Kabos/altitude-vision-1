// __tests__/roomCategoryModel.test.js — Sprint B2 (domaine Hôtellerie),
// schéma réel (non mocké).

const RoomCategory = require('../models/RoomCategory');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new RoomCategory({
  hotel: HOTEL_ID,
  name: 'Standard',
  createdBy: USER_ID,
  ...overrides,
});

describe('RoomCategory model — Sprint B2 — TEST DATA', () => {
  test('valeurs par défaut cohérentes', async () => {
    const cat = base();
    await expect(cat.validate()).resolves.toBeUndefined();
    expect(cat.capacity.maxAdults).toBe(2);
    expect(cat.capacity.maxChildren).toBe(0);
    expect(cat.beds).toBe(1);
    expect(cat.unitsAvailable).toBe(1);
    expect(cat.status).toBe('actif');
    expect(cat.gallery).toEqual([]);
  });

  test('hotel est requis', () => {
    const cat = base({ hotel: undefined });
    const errors = cat.validateSync()?.errors || {};
    expect(errors.hotel).toBeDefined();
  });

  test('name est requis', () => {
    const cat = base({ name: '' });
    const errors = cat.validateSync()?.errors || {};
    expect(errors.name).toBeDefined();
  });

  test('status rejette toute valeur hors enum', () => {
    const cat = base();
    cat.status = 'archive';
    const errors = cat.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('amenities accepte des valeurs libres par catégorie (comme Accommodation)', async () => {
    const cat = base({ amenities: { cuisine: [], salon: ['TV'], internet: ['Wifi'], exterieur: [], parking: [], securite: [] } });
    await expect(cat.validate()).resolves.toBeUndefined();
    expect(cat.amenities.salon).toEqual(['TV']);
  });

  test('unitsAvailable ne peut pas être négatif', () => {
    const cat = base({ unitsAvailable: -1 });
    const errors = cat.validateSync()?.errors || {};
    expect(errors.unitsAvailable).toBeDefined();
  });

  test("aucun index simple redondant sur 'hotel' seul (doublon corrigé au contrôle final Sprint B2)", () => {
    const indexes = RoomCategory.schema.indexes();
    const compound = indexes.find(([keys]) => keys.hotel === 1 && keys.status === 1);
    expect(compound).toBeDefined();
    const redundant = indexes.find(([keys]) => Object.keys(keys).length === 1 && keys.hotel === 1);
    expect(redundant).toBeUndefined();
  });
});
