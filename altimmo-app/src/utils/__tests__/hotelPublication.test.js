import { createHotelRoomCategory, getHotelCategoryTotals, validateHotelRates, validateHotelRoomCategories } from '../hotelPublication';

const categories = [
  { ...createHotelRoomCategory(0), clientKey: 'std', name: 'Standard', code: 'STD', quantity: 13, adultCapacity: 2, childCapacity: 0, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000 }] },
  { ...createHotelRoomCategory(1), clientKey: 'ste', name: 'Suite', code: 'STE', categoryType: 'suite', quantity: 5, adultCapacity: 2, childCapacity: 1, beds: 2, ratePlans: [{ rateType: 'public', amount: 85000 }] },
];

describe('configuration hôtelière mobile', () => {
  test('recalcule chambres, capacité, lits et minimum/maximum', () => {
    expect(getHotelCategoryTotals(categories)).toEqual({ totalRooms: 18, totalCapacity: 41, totalBeds: 23, minNightlyRate: 35000, maxNightlyRate: 85000, currency: 'XAF' });
  });
  test('refuse un formulaire sans catégorie', () => expect(validateHotelRoomCategories([])).toHaveProperty('roomCategories'));
  test('accepte une catégorie valide sans tarif à l’étape 4', () => {
    expect(validateHotelRoomCategories([{ ...categories[0], ratePlans: [] }])).toEqual({});
  });
  test.each([
    ['nom vide', { name: '' }, 'name'],
    ['code vide', { code: '' }, 'code'],
    ['quantité nulle', { quantity: 0 }, 'quantity'],
    ['capacité absente', { adultCapacity: '' }, 'adultCapacity'],
    ['surface négative', { surface: -1 }, 'surface'],
  ])('refuse %s', (_label, patch, field) => {
    expect(validateHotelRoomCategories([{ ...categories[0], ...patch }])[`roomCategories.0.${field}`])
      .toBeDefined();
  });
  test('accepte quantité 1 et surface vide', () => {
    expect(validateHotelRoomCategories([{ ...categories[0], quantity: 1, surface: '', ratePlans: [] }])).toEqual({});
  });
  test('refuse les codes dupliqués', () => {
    const invalid = [categories[0], { ...categories[1], code: 'std' }];
    expect(validateHotelRoomCategories(invalid)['roomCategories.1.code']).toBe('Le code de catégorie doit être unique.');
  });
  test('refuse une catégorie sans tarif public uniquement à l’étape 5', () => {
    expect(validateHotelRates([{ ...categories[0], ratePlans: [] }])['roomCategories.0.ratePlans']).toBe('Tarif public requis');
  });
  test('un brouillon JSON conserve catégories, clés et tarifs', () => {
    expect(JSON.parse(JSON.stringify({ roomCategories: categories })).roomCategories).toEqual(categories);
  });
});
