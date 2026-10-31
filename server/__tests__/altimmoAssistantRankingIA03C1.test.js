const { rankRealEstateResults } = require('../services/altimmoAssistant/rankingService');

const property = (id, amenities = [], extra = {}) => ({
  _id: id, id, title: `Bien ${id}`, status: 'location', price: 200000,
  amenities, isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', ...extra,
});
const searchResult = (overrides = {}) => ({
  status: 'success', intent: 'RENT', preferences: ['parking'],
  results: [property('a', ['parking']), property('b', [])],
  candidatesToVerify: [{ listing: property('v', []), unknownCriteria: [{ field: 'stay.availability', state: 'UNKNOWN' }] }],
  total: 2, verificationTotal: 1, pagination: { page: 1, limit: 10, pages: 1 },
  coverage: { evaluated: 3, sourceTotal: 3, complete: true, limit: 250 },
  warnings: [{ code: 'ORIGINAL_WARNING', message: 'Conservé' }], ambiguities: [], unverifiableCriteria: [],
  ...overrides,
});

describe('IA-03C1 — contrat de classement', () => {
  test('classe séparément les correspondances exactes et les candidats à vérifier', () => {
    const out = rankRealEstateResults({ searchResult: searchResult() });
    expect(out.rankedResults.map((item) => item.listing.id)).toEqual(['a', 'b']);
    expect(out.rankedResults.map((item) => item.position)).toEqual([1, 2]);
    expect(out.rankedCandidatesToVerify).toHaveLength(1);
    expect(out.rankedCandidatesToVerify[0].unknownCriteria).toEqual([{ field: 'stay.availability', state: 'UNKNOWN' }]);
  });

  test('conserve les avertissements, ambiguïtés, pagination et couverture IA-03B', () => {
    const input = searchResult({ ambiguities: [{ code: 'A' }], unverifiableCriteria: [{ field: 'proximity' }] });
    const out = rankRealEstateResults({ searchResult: input });
    expect(out.warnings).toEqual(input.warnings);
    expect(out.ambiguities).toEqual(input.ambiguities);
    expect(out.unverifiableCriteria).toEqual(input.unverifiableCriteria);
    expect(out.pagination).toEqual(input.pagination);
    expect(out.coverage).toEqual(input.coverage);
  });

  test('reste stable quand l’ordre d’entrée change et départage par identifiant, jamais par prix ou récence', () => {
    const candidates = [
      property('z', [], { price: 1, createdAt: '2030-01-01' }),
      property('a', [], { price: 999999, createdAt: '2020-01-01' }),
    ];
    const first = rankRealEstateResults({ searchResult: searchResult({ preferences: [], results: candidates, candidatesToVerify: [] }) });
    const second = rankRealEstateResults({ searchResult: searchResult({ preferences: [], results: [...candidates].reverse(), candidatesToVerify: [] }) });
    expect(first.rankedResults.map((item) => item.listing.id)).toEqual(['a', 'z']);
    expect(second.rankedResults.map((item) => item.listing.id)).toEqual(['a', 'z']);
    expect(first.rankedResults.every((item) => item.score === 0)).toBe(true);
  });

  test('échoue fermé pour UNRESOLVED ou tout résultat IA-03B non réussi', () => {
    for (const status of ['forbidden', 'invalid', 'needs_clarification']) {
      const out = rankRealEstateResults({ searchResult: searchResult({ status }), context: { scopeMode: status === 'forbidden' ? 'UNRESOLVED' : 'PUBLIC' } });
      expect(out.rankingStatus).toBe('not_ranked');
      expect(out.rankedResults).toEqual([]);
    }
  });

  test('refuse les identifiants absents ou dupliqués de façon déterministe', () => {
    const out = rankRealEstateResults({ searchResult: searchResult({ results: [property('a'), property('a'), { title: 'sans id' }], candidatesToVerify: [] }) });
    expect(out.rankedResults).toHaveLength(1);
    expect(out.rankingWarnings.map((item) => item.code)).toEqual(['DUPLICATE_CANDIDATE_ID', 'MISSING_CANDIDATE_ID']);
  });

  test('écarte en défense profonde un bien non publié, non validé ou indisponible', () => {
    const out = rankRealEstateResults({ searchResult: searchResult({
      results: [
        property('private', [], { isPublished: false }),
        property('pending', [], { statusAdmin: 'En attente' }),
        property('removed', [], { availability: 'Retiré' }),
        property('public'),
      ],
      candidatesToVerify: [],
    }) });
    expect(out.rankedResults.map((item) => item.listing.id)).toEqual(['public']);
    expect(out.rankingWarnings.filter((item) => item.code === 'INELIGIBLE_CANDIDATE')).toHaveLength(3);
  });

  test('reprojette les biens et ne propage ni tenant, propriétaire, commission, documents internes ou contenu injecté dans les explications', () => {
    const malicious = property('safe', ['parking'], {
      tenant: 'tenant-secret', owner: { email: 'owner@example.test' }, commission: 99,
      internalNotes: '<script>alert(1)</script>', banking: { iban: 'secret' },
    });
    const out = rankRealEstateResults({ searchResult: searchResult({ results: [malicious], candidatesToVerify: [] }) });
    const serialized = JSON.stringify(out.rankedResults[0]);
    expect(serialized).not.toContain('tenant-secret');
    expect(serialized).not.toContain('owner@example.test');
    expect(serialized).not.toContain('commission');
    expect(serialized).not.toContain('<script>');
  });

  test('reconstruit les critères inconnus au lieu de propager des données imbriquées injectées', () => {
    const out = rankRealEstateResults({ searchResult: searchResult({
      results: [],
      candidatesToVerify: [{
        listing: property('v'),
        unknownCriteria: [
          { field: 'stay.availability', state: 'UNKNOWN', tenant: 'secret', nested: { ownerEmail: 'owner@example.test' } },
          { field: '<script>alert(1)</script>', state: 'UNKNOWN' },
        ],
      }],
    }) });
    expect(out.rankedCandidatesToVerify[0].unknownCriteria).toEqual([{ field: 'stay.availability', state: 'UNKNOWN' }]);
    expect(JSON.stringify(out.rankedCandidatesToVerify)).not.toContain('owner@example.test');
  });

  test.each([0, 10, 50, 100, 250, 251])('classe %i candidats sans dépasser la fenêtre IA-03B', (count) => {
    const results = Array.from({ length: count }, (_, index) => property(`p-${String(index).padStart(3, '0')}`, index % 2 ? ['parking'] : []));
    const out = rankRealEstateResults({ searchResult: searchResult({ results, candidatesToVerify: [], coverage: { evaluated: count, sourceTotal: count, complete: count <= 250, limit: 250 } }) });
    expect(out.rankedResults).toHaveLength(Math.min(count, 250));
    expect(out.rankingCoverage).toMatchObject({ evaluated: Math.min(count, 250), complete: count <= 250 });
    if (count > 250) expect(out.rankingWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'RANKING_WINDOW_TRUNCATED' })]));
  });
});
