const { validatePayloadShape } = require('../services/accommodation/mobileAccommodationPublicationService');

const payload = () => ({
  publicationKind: 'hotel_establishment',
  property: { titre: 'Altitude Hôtel', description: 'Confortable', type: 'Commerce', ville: 'Brazzaville', arrondissement: 'Poto-Poto', superficie: 1, prix: 35000, photos: ['photo.jpg'] },
  accommodation: { accommodationType: 'hotel', capacity: { maxAdults: 2 }, checkInTime: '14:00', checkOutTime: '11:00', hotel: { name: 'Altitude Hôtel', description: 'Confortable', phone: '+242060000000', hotelServices: { wifi: true } } },
  roomCategories: [{ name: 'Standard', code: 'STD', categoryType: 'standard', quantity: 1, adultCapacity: 2, childCapacity: 0, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000, currency: 'XAF' }] }],
});

describe('validation bloquante du payload hôtel', () => {
  test('refuse avant écriture avec un 422 structuré', () => {
    const invalid = payload(); invalid.accommodation.hotel.phone = ''; invalid.property.photos = [];
    expect(() => validatePayloadShape(invalid)).toThrow(expect.objectContaining({
      statusCode: 422, code: 'HOTEL_INCOMPLETE',
      extra: expect.objectContaining({ missingFields: expect.arrayContaining([
        expect.objectContaining({ field: 'accommodation.hotel.phone', label: 'Téléphone' }),
        expect.objectContaining({ field: 'property.photos', label: 'Photos' }),
      ]) }),
    }));
  });

  test('accepte un hôtel complet', () => expect(() => validatePayloadShape(payload())).not.toThrow());
});
