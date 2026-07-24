const { buildPropertyMongoFilter, buildExactCiRegexFilter } = require('../services/propertyFilterService');

describe('propertyFilterService — buildExactCiRegexFilter', () => {
  test('valeur absente → undefined', () => {
    expect(buildExactCiRegexFilter(undefined)).toBeUndefined();
    expect(buildExactCiRegexFilter('')).toBeUndefined();
  });
  test('pseudo-valeurs "tous"/"toutes"/"all" (insensible casse) → undefined', () => {
    expect(buildExactCiRegexFilter('Tous')).toBeUndefined();
    expect(buildExactCiRegexFilter('TOUTES')).toBeUndefined();
    expect(buildExactCiRegexFilter('all')).toBeUndefined();
  });
  test('valeur réelle → regex ancrée, insensible à la casse, échappée', () => {
    const result = buildExactCiRegexFilter('Brazzaville');
    expect(result.$regex.source).toBe('^Brazzaville$');
    expect(result.$regex.flags).toBe('i');
    expect('brazzaville').toMatch(result.$regex);
  });
  test('métacaractères regex échappés (pas d’injection de motif)', () => {
    const result = buildExactCiRegexFilter('Ma.Ville(1)');
    expect(result.$regex.source).toBe('^Ma\\.Ville\\(1\\)$');
    expect('Ma.Ville(1)').toMatch(result.$regex);
    expect('MaXVille11').not.toMatch(result.$regex);
  });
});

describe('propertyFilterService — buildPropertyMongoFilter (nomenclature canonique)', () => {
  test('offerType canonique → status', () => {
    const { mongoFilter, remainingQuery } = buildPropertyMongoFilter({ offerType: 'vente' });
    expect(mongoFilter.status).toBe('vente');
    expect(remainingQuery.offerType).toBeUndefined();
  });

  test('alias legacy status/transaction/listingType → offerType → status', () => {
    expect(buildPropertyMongoFilter({ status: 'location' }).mongoFilter.status).toBe('location');
    expect(buildPropertyMongoFilter({ transaction: 'hebergement' }).mongoFilter.status).toBe('hebergement');
    expect(buildPropertyMongoFilter({ listingType: 'vente' }).mongoFilter.status).toBe('vente');
  });

  test('offerType invalide (valeur inconnue) → ignoré silencieusement, aucune exception', () => {
    const { mongoFilter } = buildPropertyMongoFilter({ offerType: 'n-importe-quoi' });
    expect(mongoFilter.status).toBeUndefined();
  });

  test('propertyType canonique + alias legacy `type`, insensible à la casse', () => {
    expect(buildPropertyMongoFilter({ propertyType: 'Villa' }).mongoFilter.type).toBe('Villa');
    expect(buildPropertyMongoFilter({ type: 'villa' }).mongoFilter.type).toBe('Villa');
  });

  test('city canonique + alias legacy `ville` → address.city (regex exacte insensible casse)', () => {
    const r1 = buildPropertyMongoFilter({ city: 'Pointe-Noire' });
    expect(r1.mongoFilter['address.city'].$regex.source).toBe('^Pointe-Noire$');
    const r2 = buildPropertyMongoFilter({ ville: 'Dolisie' });
    expect(r2.mongoFilter['address.city'].$regex.source).toBe('^Dolisie$');
  });

  test('arrondissement → address.arrondissement', () => {
    const { mongoFilter } = buildPropertyMongoFilter({ arrondissement: 'Bacongo' });
    expect(mongoFilter['address.arrondissement'].$regex.source).toBe('^Bacongo$');
  });

  test('minPrice/maxPrice canoniques → price.$gte/$lte', () => {
    const { mongoFilter } = buildPropertyMongoFilter({ minPrice: '1000', maxPrice: '5000' });
    expect(mongoFilter.price).toEqual({ $gte: 1000, $lte: 5000 });
  });

  test('alias legacy price[gte]/price[lte] (qs bracket notation) → minPrice/maxPrice', () => {
    const { mongoFilter } = buildPropertyMongoFilter({ price: { gte: '2000', lte: '9000' } });
    expect(mongoFilter.price).toEqual({ $gte: 2000, $lte: 9000 });
  });

  test('prix invalide (non numérique) → ignoré, aucune exception', () => {
    const { mongoFilter } = buildPropertyMongoFilter({ minPrice: 'abc' });
    expect(mongoFilter.price).toBeUndefined();
  });

  test('plusieurs filtres combinés', () => {
    const { mongoFilter, remainingQuery } = buildPropertyMongoFilter({
      offerType: 'location', propertyType: 'Studio', city: 'Brazzaville', arrondissement: 'Moungali',
      minPrice: '100000', maxPrice: '300000', search: 'lumineux', sort: '-createdAt', page: '2', limit: '20',
    });
    expect(mongoFilter).toEqual({
      status: 'location',
      type: 'Studio',
      'address.city': { $regex: expect.any(RegExp) },
      'address.arrondissement': { $regex: expect.any(RegExp) },
      price: { $gte: 100000, $lte: 300000 },
    });
    // Paramètres non gérés directement (search/sort/page/limit) restent intacts pour APIFeatures.
    expect(remainingQuery).toEqual({ search: 'lumineux', sort: '-createdAt', page: '2', limit: '20' });
  });

  test('aucun paramètre fourni → filtre vide, remainingQuery vide', () => {
    const { mongoFilter, remainingQuery } = buildPropertyMongoFilter({});
    expect(mongoFilter).toEqual({});
    expect(remainingQuery).toEqual({});
  });
});
