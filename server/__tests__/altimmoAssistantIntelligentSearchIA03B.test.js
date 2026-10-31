const { searchRealEstateFromText } = require('../services/altimmoAssistant/intelligentSearchService');

const listing = (id, overrides = {}) => ({
  _id: String(id).padStart(24, '0'), title: `Maison ${id}`, type: 'Maison', status: 'location', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Talangaï' }, bedrooms: 3, bathrooms: 2, surface: 120,
  amenities: ['parking'], amenitiesComplete: true, isPublished: true, statusAdmin: 'Validée', availability: 'Disponible',
  createdAt: new Date(2026, 0, Math.min(Number(id) + 1, 28)).toISOString(), owner: 'private-owner', documents: ['secret'],
  ...overrides,
});

function sourceFrom(items) {
  const calls = [];
  const search = async (request) => {
    calls.push(request);
    const page = Number(request.page); const limit = Number(request.limit); const start = (page - 1) * limit;
    return { properties: items.slice(start, start + limit), total: items.length, page, limit };
  };
  return { calls, searchProperties: search, searchAccommodations: search };
}

const request = (query, dependencies, extra = {}) => searchRealEstateFromText({
  query, context: { scopeMode: 'PUBLIC' }, pagination: { page: 1, limit: 10 }, ...extra,
}, dependencies);

describe('IA-03B — orchestrateur de recherche immobilière', () => {
  test('retourne seulement les annonces réelles satisfaisant toutes les contraintes', async () => {
    const source = sourceFrom([
      listing(1), listing(2, { bedrooms: 2 }), listing(3, { availability: 'Retiré' }),
    ]);
    const out = await request('Maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois', source);
    expect(out.results.map((x) => x.title)).toEqual(['Maison 1']);
    expect(out.total).toBe(1);
    expect(out.candidatesToVerify).toEqual([]);
    expect(out.results[0]).not.toHaveProperty('owner');
    expect(out.results[0]).not.toHaveProperty('documents');
  });

  test('ne relâche aucune contrainte quand aucun bien ne correspond', async () => {
    const out = await request('Maison à louer à Brazzaville, maximum 10 000 FCFA par mois', sourceFrom([listing(1)]));
    expect(out.results).toEqual([]);
    expect(out.total).toBe(0);
    expect(out.warnings).toContainEqual(expect.objectContaining({ code: 'NO_EXACT_MATCH' }));
  });

  test('bloque les ambiguïtés avant toute lecture de catalogue', async () => {
    const source = sourceFrom([listing(1)]);
    const out = await request('un appartement à louer ou une maison à acheter', source);
    expect(out.status).toBe('needs_clarification');
    expect(source.calls).toHaveLength(0);
    expect(out.results).toEqual([]);
  });

  test('UNRESOLVED échoue fermé avant toute recherche', async () => {
    const source = sourceFrom([listing(1)]);
    const out = await searchRealEstateFromText({ query: 'Maison à louer à Brazzaville', context: { scopeMode: 'UNRESOLVED' } }, source);
    expect(out.status).toBe('forbidden');
    expect(out.warnings).toContainEqual(expect.objectContaining({ code: 'UNRESOLVED_CONTEXT' }));
    expect(source.calls).toHaveLength(0);
  });

  test.each(['PUBLIC', 'TENANT', 'PLATFORM'])('%s conserve uniquement la visibilité publique', async (scopeMode) => {
    const source = sourceFrom([listing(1), listing(2, { isPublished: false }), listing(3, { statusAdmin: 'En attente' })]);
    const out = await searchRealEstateFromText({ query: 'Maison à louer à Brazzaville', context: { scopeMode } }, source);
    expect(out.results.map((x) => x.title)).toEqual(['Maison 1']);
  });

  test('sépare un hébergement à dates non vérifiées des correspondances exactes', async () => {
    const hotel = listing(1, { title: 'Hôtel réel', type: 'Commerce', status: 'hebergement', accommodationType: 'hotel' });
    const source = sourceFrom([hotel]);
    const out = await request('Hôtel à Brazzaville du 10/11/2026 au 13/11/2026', source);
    expect(out.results).toEqual([]);
    expect(out.candidatesToVerify.map((x) => x.listing.title)).toEqual(['Hôtel réel']);
    expect(out.unverifiableCriteria).toContainEqual(expect.objectContaining({ field: 'stay.availability' }));
  });

  test('trie aussi les candidats à vérifier de façon stable', async () => {
    const older = listing(1, { title: 'Ancien hôtel', status: 'hebergement', type: 'Commerce', accommodationType: 'hotel', createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = listing(2, { title: 'Nouvel hôtel', status: 'hebergement', type: 'Commerce', accommodationType: 'hotel', createdAt: '2026-02-01T00:00:00.000Z' });
    const out = await request('Hôtel à Brazzaville du 10/11/2026 au 13/11/2026', sourceFrom([older, newer]));
    expect(out.candidatesToVerify.map((item) => item.listing.title)).toEqual(['Nouvel hôtel', 'Ancien hôtel']);
  });

  test('borne les candidats à vérifier à la pagination publique', async () => {
    const hotels = Array.from({ length: 60 }, (_, index) => listing(index + 1, {
      status: 'hebergement', type: 'Commerce', accommodationType: 'hotel',
    }));
    const out = await searchRealEstateFromText({
      query: 'Hôtel à Brazzaville du 10/11/2026 au 13/11/2026', context: { scopeMode: 'PUBLIC' },
      pagination: { page: 1, limit: 1000 },
    }, sourceFrom(hotels));
    expect(out.candidatesToVerify).toHaveLength(50);
    expect(out.verificationTotal).toBe(60);
  });

  test('conserve les préférences sans classement personnalisé', async () => {
    const out = await request('Maison à louer à Brazzaville avec jardin si possible', sourceFrom([listing(1), listing(2)]));
    expect(out.results).toHaveLength(2);
    expect(out.preferences).toEqual(expect.arrayContaining(['garden']));
    expect(out.results.map((x) => x.title)).toEqual(['Maison 2', 'Maison 1']);
  });

  test.each([0, 1, 49, 50, 51, 100, 250, 251, 500, 1000])('mesure honnêtement la couverture de %i candidats', async (size) => {
    const items = Array.from({ length: size }, (_, index) => listing(index + 1));
    const source = sourceFrom(items);
    const out = await request('Maison à louer à Brazzaville', source);
    expect(out.coverage.evaluated).toBe(Math.min(size, 250));
    expect(out.coverage.sourceTotal).toBe(size);
    expect(out.coverage.complete).toBe(size <= 250);
    expect(source.calls.length).toBe(Math.max(1, Math.min(Math.ceil(size / 50), 5)));
  });

  test('applique les contraintes avant une pagination stable sans doublon', async () => {
    const items = Array.from({ length: 65 }, (_, index) => listing(index + 1, { bedrooms: index % 2 ? 2 : 3 }));
    items.push(items[0]);
    const source = sourceFrom(items);
    const page1 = await request('Maison à louer à Brazzaville, 3 chambres', source, { pagination: { page: 1, limit: 10 } });
    const page2 = await request('Maison à louer à Brazzaville, 3 chambres', sourceFrom(items), { pagination: { page: 2, limit: 10 } });
    expect(page1.results).toHaveLength(10);
    expect(page2.results).toHaveLength(10);
    expect(new Set([...page1.results, ...page2.results].map((x) => x.id)).size).toBe(20);
    expect(page1.total).toBe(33);
  });

  test('n’accepte aucun paramètre de filtre ou projection fourni hors texte', async () => {
    const source = sourceFrom([listing(1)]);
    await searchRealEstateFromText({
      query: 'Maison à louer à Brazzaville', context: { scopeMode: 'PUBLIC', tenant: 'forged' },
      pagination: { page: 1, limit: 10 }, fields: 'owner documents', filters: { $where: 'evil' },
    }, source);
    expect(JSON.stringify(source.calls)).not.toMatch(/tenant|owner|fields|\$where/);
  });
});
