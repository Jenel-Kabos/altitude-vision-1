import { describe, expect, test } from 'vitest';
import {
  buildHotelPublicationPayload, getHotelCategoryTotals, validateHotelCategories,
} from '../utils/hotelPublication';

const categories = [
  { clientKey: 'std', name: 'Standard', code: 'std', categoryType: 'standard', quantity: 13, adultCapacity: 2, childCapacity: 0, beds: 1, surface: '', amenities: {}, ratePlans: [{ rateType: 'public', amount: '35000', currency: 'XAF' }] },
  { clientKey: 'ste', name: 'Suite', code: 'ste', categoryType: 'suite', quantity: 5, adultCapacity: 2, childCapacity: 1, beds: 2, surface: 40, amenities: {}, ratePlans: [{ rateType: 'public', amount: '85000', currency: 'XAF' }] },
];

const form = {
  publicationRequestId: 'web-request-1', accommodationType: 'hotel', name: 'Altitude Hôtel', description: 'Description',
  starRating: 4, phone: '+242060000000', email: '', website: '', address: { city: 'Brazzaville', arrondissement: 'Poto-Poto', street: 'Avenue A' },
  latitude: -4.266, longitude: 15.283, surface: 1, checkInTime: '14:00', checkOutTime: '11:00', houseRules: [], hotelServices: {}, roomCategories: categories,
};

describe('publication hôtelière Web — contrat Mobile de référence', () => {
  test('calcule les mêmes agrégats pour 13 Standard et 5 Suites', () => {
    expect(getHotelCategoryTotals(categories)).toEqual({ totalRooms: 18, totalCapacity: 41, totalBeds: 23, minNightlyRate: 35000, maxNightlyRate: 85000, currency: 'XAF' });
  });

  test('produit le payload sémantique attendu par le service Mobile', () => {
    const payload = buildHotelPublicationPayload(form);
    expect(validateHotelCategories(categories)).toEqual({});
    expect(payload).toMatchObject({
      publicationRequestId: 'web-request-1', publicationKind: 'hotel_establishment',
      property: { titre: 'Altitude Hôtel', prix: 35000, type: 'Commerce', categorie: 'hebergement' },
      accommodation: { accommodationType: 'hotel', capacity: { maxAdults: 41, maxChildren: 0 }, hotel: { name: 'Altitude Hôtel' } },
    });
    expect(payload.roomCategories.map(({ code, quantity, ratePlans }) => ({ code, quantity, ratePlans }))).toEqual([
      { code: 'STD', quantity: 13, ratePlans: [{ rateType: 'public', amount: 35000, currency: 'XAF' }] },
      { code: 'STE', quantity: 5, ratePlans: [{ rateType: 'public', amount: 85000, currency: 'XAF' }] },
    ]);
  });
});
