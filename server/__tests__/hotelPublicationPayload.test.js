const { analyzeHotelRoomCategories } = require('../services/accommodation/hotelPublicationPayload');

const categories = [
  { clientKey: 'std', name: 'Chambre Standard', code: 'STD', categoryType: 'standard', quantity: 13, adultCapacity: 2, childCapacity: 0, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000 }] },
  { clientKey: 'ste', name: 'Suite', code: 'STE', categoryType: 'suite', quantity: 5, adultCapacity: 2, childCapacity: 1, beds: 2, ratePlans: [{ rateType: 'public', amount: 85000 }] },
];

describe('analyse du payload hôtelier professionnel', () => {
  test('calcule inventaire, capacité, lits et plage Standard → Premium', () => {
    const result = analyzeHotelRoomCategories(categories);
    expect(result.errors).toEqual([]);
    expect(result.totals).toEqual({ totalRooms: 18, totalCapacity: 41, totalBeds: 23, minNightlyRate: 35000, maxNightlyRate: 85000, currency: 'XAF' });
    expect(result.categories.map((category) => category.displayOrder)).toEqual([0, 1]);
  });

  test.each([
    ['code dupliqué', [{ ...categories[0] }, { ...categories[1], code: 'std' }], 'roomCategories.1.code'],
    ['quantité nulle', [{ ...categories[0], quantity: 0 }], 'roomCategories.0.quantity'],
    ['tarif absent', [{ ...categories[0], ratePlans: [] }], 'roomCategories.0.ratePlans'],
    ['tarif négatif', [{ ...categories[0], ratePlans: [{ rateType: 'public', amount: -1 }] }], 'roomCategories.0.ratePlans.amount'],
  ])('rejette %s', (_label, payload, expectedField) => {
    expect(analyzeHotelRoomCategories(payload).errors).toContain(expectedField);
  });
});
