import { buildPropertyQueryParams, DEFAULT_PROPERTY_FILTERS, PRICE_MIN, PRICE_MAX } from '../propertyQueryParams';

// Audit filtrage Altimmo — construction de requête partagée (auparavant dupliquée dans
// ListeAnnoncesScreen.jsx ET CarteScreen.jsx, avec un `availability` hardcodé divergent).
// Nomenclature canonique identique au web/backend : offerType/propertyType/city/
// arrondissement/minPrice/maxPrice.

describe('propertyQueryParams — buildPropertyQueryParams', () => {
  test('filtres par défaut ("tous"/"Toutes"/"Tous") → aucun paramètre de filtre', () => {
    const qs = buildPropertyQueryParams(DEFAULT_PROPERTY_FILTERS, { page: 1, limit: 15 });
    const params = new URLSearchParams(qs);
    expect(params.get('offerType')).toBeNull();
    expect(params.get('propertyType')).toBeNull();
    expect(params.get('city')).toBeNull();
    expect(params.get('arrondissement')).toBeNull();
    expect(params.get('minPrice')).toBeNull();
    expect(params.get('maxPrice')).toBeNull();
    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('15');
  });

  test('chaque filtre seul', () => {
    const base = { ...DEFAULT_PROPERTY_FILTERS };
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, offerType: 'hebergement' })).get('offerType')).toBe('hebergement');
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, propertyType: 'Villa' })).get('propertyType')).toBe('Villa');
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, city: 'Brazzaville' })).get('city')).toBe('Brazzaville');
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, arrondissement: 'Bacongo' })).get('arrondissement')).toBe('Bacongo');
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, priceRange: [1000, PRICE_MAX] })).get('minPrice')).toBe('1000');
    expect(new URLSearchParams(buildPropertyQueryParams({ ...base, priceRange: [PRICE_MIN, 900000] })).get('maxPrice')).toBe('900000');
  });

  test('plusieurs filtres combinés', () => {
    const params = new URLSearchParams(buildPropertyQueryParams({
      offerType: 'location', propertyType: 'Studio', city: 'Brazzaville', arrondissement: 'Moungali',
      priceRange: [100000, 300000],
    }, { page: 2, limit: 15 }));
    expect(Object.fromEntries(params.entries())).toEqual({
      page: '2', limit: '15', offerType: 'location', propertyType: 'Studio',
      city: 'Brazzaville', arrondissement: 'Moungali', minPrice: '100000', maxPrice: '300000',
    });
  });

  test('n’envoie jamais availability/statusAdmin (correctif audit : dead weight côté client, imposé par le backend)', () => {
    const params = new URLSearchParams(buildPropertyQueryParams(DEFAULT_PROPERTY_FILTERS, { page: 1, limit: 200 }));
    expect(params.get('availability')).toBeNull();
    expect(params.get('statusAdmin')).toBeNull();
  });

  test('la même fonction produit les mêmes paramètres pour la liste (limit=15) et la carte (limit=200), seule la pagination diffère', () => {
    const filters = { offerType: 'vente', propertyType: 'tous', city: 'Toutes', arrondissement: 'Tous', priceRange: [PRICE_MIN, PRICE_MAX] };
    const listParams = new URLSearchParams(buildPropertyQueryParams(filters, { page: 1, limit: 15 }));
    const mapParams = new URLSearchParams(buildPropertyQueryParams(filters, { limit: 200 }));
    expect(listParams.get('offerType')).toBe(mapParams.get('offerType'));
    expect(listParams.get('limit')).toBe('15');
    expect(mapParams.get('limit')).toBe('200');
    expect(mapParams.get('page')).toBeNull();
  });

  describe('correctif architecture recherche Altimmo (2026-07-25) — propertyType/accommodationType mutuellement exclusifs', () => {
    test('offerType=hebergement + accommodationType → accommodationType envoyé, propertyType jamais', () => {
      const params = new URLSearchParams(buildPropertyQueryParams({
        ...DEFAULT_PROPERTY_FILTERS, offerType: 'hebergement', accommodationType: 'villa_meublee', propertyType: 'Villa',
      }));
      expect(params.get('accommodationType')).toBe('villa_meublee');
      expect(params.get('propertyType')).toBeNull();
    });

    test('offerType=vente + propertyType → propertyType envoyé, accommodationType jamais', () => {
      const params = new URLSearchParams(buildPropertyQueryParams({
        ...DEFAULT_PROPERTY_FILTERS, offerType: 'vente', propertyType: 'Villa', accommodationType: 'hotel',
      }));
      expect(params.get('propertyType')).toBe('Villa');
      expect(params.get('accommodationType')).toBeNull();
    });
  });
});
