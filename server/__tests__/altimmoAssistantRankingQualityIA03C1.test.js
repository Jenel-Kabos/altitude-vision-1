const { performance } = require('perf_hooks');
const { rankRealEstateResults } = require('../services/altimmoAssistant/rankingService');

const candidate = (id, amenities) => ({
  _id: id, id, title: `Bien ${id}`, status: 'location', price: 200000,
  amenities, isPublished: true, statusAdmin: 'Validée', availability: 'Disponible',
});
const input = (results, complete = true) => ({
  status: 'success', intent: 'RENT', preferences: ['parking', 'garden'], results, candidatesToVerify: [],
  total: results.length, verificationTotal: 0, pagination: { page: 1, limit: 50, pages: Math.ceil(results.length / 50) },
  coverage: { evaluated: Math.min(results.length, 250), sourceTotal: results.length, complete, limit: 250 },
  warnings: complete ? [] : [{ code: 'CATALOG_COVERAGE_LIMITED', message: 'Fenêtre bornée.' }],
});

describe('IA-03C1 — corpus qualité contrôlé', () => {
  test('le classement attendu privilégie deux préférences confirmées puis une puis aucune', () => {
    const out = rankRealEstateResults({ searchResult: input([
      candidate('none', []), candidate('both', ['parking', 'garden']), candidate('one', ['parking']),
    ]) });
    expect(out.rankedResults.map((item) => [item.listing.id, item.score])).toEqual([
      ['both', 10000], ['one', 7500], ['none', 5000],
    ]);
    expect(out.rankedResults.flatMap((item) => item.explanation.provenance).every((fact) =>
      fact.source === 'public_listing.amenities' && ['TRUE', 'UNKNOWN'].includes(fact.state))).toBe(true);
  });

  test.each([10, 50, 100, 250])('reste stable et linéaire sur %i candidats évalués', (count) => {
    const candidates = Array.from({ length: count }, (_, index) => candidate(`p-${String(index).padStart(3, '0')}`, index % 3 === 0 ? ['parking', 'garden'] : index % 3 === 1 ? ['parking'] : []));
    const start = performance.now();
    const first = rankRealEstateResults({ searchResult: input(candidates) });
    const elapsedMs = performance.now() - start;
    const second = rankRealEstateResults({ searchResult: input([...candidates].reverse()) });
    expect(second.rankedResults.map((item) => item.listing.id)).toEqual(first.rankedResults.map((item) => item.listing.id));
    expect(first.rankedResults).toHaveLength(count);
    expect(elapsedMs).toBeLessThan(1000);
  });

  test('plus de 250 candidats conserve la limite et l’avertissement de couverture partielle', () => {
    const candidates = Array.from({ length: 300 }, (_, index) => candidate(`p-${index}`, ['parking']));
    const out = rankRealEstateResults({ searchResult: input(candidates, false) });
    expect(out.rankedResults).toHaveLength(250);
    expect(out.rankingCoverage.complete).toBe(false);
    expect(out.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CATALOG_COVERAGE_LIMITED' })]));
    expect(out.rankingWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'RANKING_WINDOW_TRUNCATED' })]));
  });

  test.each(['PUBLIC', 'TENANT', 'PLATFORM'])('conserve la même projection publique en contexte %s', (scopeMode) => {
    const out = rankRealEstateResults({ searchResult: input([candidate('p-1', ['parking'])]), context: { scopeMode } });
    expect(out.rankingStatus).toBe('ranked');
    expect(out.rankedResults[0].listing).not.toHaveProperty('tenant');
  });
});
