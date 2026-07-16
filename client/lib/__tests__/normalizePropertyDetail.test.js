import { formatCurrencyXAF, normalizePropertyDetail, propertyDetailError } from '../utils/normalizePropertyDetail';

describe('normalizePropertyDetail — TEST DATA', () => {
  test('normalise le payload du bien concerné avec propriétaire supprimé', () => {
    const property = normalizePropertyDetail({
      _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA HOUSE', owner: null,
      images: ['https://example.com/test.jpg'], address: { city: 'TEST DATA CITY' },
      amenities: ['Parking'], price: 300000, surface: 316, status: 'LOCATION',
    });
    expect(property).toMatchObject({ owner: null, title: 'TEST DATA HOUSE', price: 300000, status: 'location' });
    expect(property.images).toHaveLength(1);
    expect(property.address).toMatchObject({ city: 'TEST DATA CITY', street: '', arrondissement: '' });
  });

  test('stabilise les champs historiques incomplets sans inventer de données métier', () => {
    const property = normalizePropertyDetail({
      id: 'TEST-DATA-OLD', images: 'invalid', amenities: null, address: 'old address',
      price: 'not-a-number', surface: Infinity, owner: 'deleted', createdAt: 'invalid',
    });
    expect(property).toMatchObject({
      _id: 'TEST-DATA-OLD', title: 'Bien immobilier', images: [], amenities: [],
      price: null, surface: null, owner: null, coordinates: null, createdAt: null,
    });
  });

  test.each([
    [null, 'Prix sur demande'],
    [undefined, 'Prix sur demande'],
    [Number.NaN, 'Prix sur demande'],
    [Infinity, 'Prix sur demande'],
  ])('formate %s sans exception', (value, expected) => {
    expect(formatCurrencyXAF(value)).toBe(expected);
  });

  test('formate un prix XAF valide', () => {
    expect(formatCurrencyXAF(300000)).toMatch(/300[\s  ]?000/);
  });

  test.each([
    [404, 'not_found'], [403, 'forbidden'], [500, 'server'], [null, 'network'],
  ])('distingue l’erreur HTTP %s', (status, kind) => {
    const error = status ? { response: { status } } : { request: {} };
    expect(propertyDetailError(error).kind).toBe(kind);
  });
});
