const { searchAndRankRealEstateFromText } = require('../services/altimmoAssistant/personalizedSearchService');

const successfulSearch = () => ({
  status: 'success', intent: 'RENT', preferences: ['parking'],
  results: [{
    _id: 'p-1', id: 'p-1', title: 'Maison', status: 'location', amenities: ['parking'], price: 200000,
    isPublished: true, statusAdmin: 'Validée', availability: 'Disponible',
  }],
  candidatesToVerify: [], total: 1, verificationTotal: 0,
  pagination: { page: 1, limit: 10, pages: 1 },
  coverage: { evaluated: 1, sourceTotal: 1, complete: true, limit: 250 },
  warnings: [{ code: 'IA03B_WARNING', message: 'Conservé' }],
});

describe('IA-03C1 — composition recherche puis classement', () => {
  test('classe le résultat réel du service IA-03B sans seconde lecture de source', async () => {
    let calls = 0;
    const out = await searchAndRankRealEstateFromText(
      { query: 'maison avec parking', context: { scopeMode: 'PUBLIC' } },
      { searchRealEstateFromText: async () => { calls += 1; return successfulSearch(); } },
    );
    expect(calls).toBe(1);
    expect(out.rankingStatus).toBe('ranked');
    expect(out.rankedResults[0]).toMatchObject({ position: 1, score: 10000 });
    expect(out.warnings).toEqual([{ code: 'IA03B_WARNING', message: 'Conservé' }]);
  });

  test('conserve le fail-closed IA-03B et ne fabrique aucun classement', async () => {
    const out = await searchAndRankRealEstateFromText(
      { query: 'maison', context: { scopeMode: 'UNRESOLVED' } },
      { searchRealEstateFromText: async () => ({ ...successfulSearch(), status: 'forbidden', results: [] }) },
    );
    expect(out.rankingStatus).toBe('not_ranked');
    expect(out.rankedResults).toEqual([]);
  });

  test('une préférence de classement supplémentaire passe par la liste blanche', async () => {
    const out = await searchAndRankRealEstateFromText(
      {
        query: 'maison', context: { scopeMode: 'PUBLIC' },
        rankingPreferences: [{ kind: 'AMENITY', key: 'parking', weight: 200 }, { kind: 'PRIVATE_FIELD', key: 'tenant' }],
      },
      { searchRealEstateFromText: async () => successfulSearch() },
    );
    expect(out.normalizedPreferences).toEqual([{ kind: 'AMENITY', key: 'parking', weight: 200 }]);
  });
});
