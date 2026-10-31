const {
  evaluateRankingCandidate,
  normalizeRankingPreferences,
} = require('../services/altimmoAssistant/rankingPolicy');

const listing = (overrides = {}) => ({
  id: 'p-1', title: 'Maison', status: 'location', price: 220000,
  amenities: ['parking'], amenitiesComplete: true, ...overrides,
});

describe('IA-03C1 — politique de préférences', () => {
  test('classe une préférence équipement en TRUE, FALSE ou UNKNOWN sans confondre inconnu et absent', () => {
    expect(evaluateRankingCandidate(listing(), ['parking']).contributions[0].state).toBe('TRUE');
    expect(evaluateRankingCandidate(listing(), ['garden']).contributions[0].state).toBe('FALSE');
    expect(evaluateRankingCandidate(listing({ amenities: [], amenitiesComplete: false }), ['garden']).contributions[0].state).toBe('UNKNOWN');
  });

  test('applique des points entiers reproductibles et une valeur neutre aux inconnues', () => {
    const result = evaluateRankingCandidate(
      listing({ amenities: ['parking'], amenitiesComplete: false }),
      [{ kind: 'AMENITY', key: 'parking', weight: 200 }, { kind: 'AMENITY', key: 'garden', weight: 100 }],
    );
    expect(result).toMatchObject({ score: 8333, confidence: 6667, earnedPoints: 250, possiblePoints: 300 });
    expect(result.contributions.map(({ state, points }) => ({ state, points }))).toEqual([
      { state: 'TRUE', points: 200 }, { state: 'UNKNOWN', points: 50 },
    ]);
  });

  test('un simple plafond budgétaire ou un prix élevé ne crée aucun avantage de classement', () => {
    const cheap = evaluateRankingCandidate(listing({ id: 'cheap', price: 150000 }), []);
    const expensive = evaluateRankingCandidate(listing({ id: 'expensive', price: 900000 }), []);
    expect(cheap.score).toBe(0);
    expect(expensive.score).toBe(0);
    expect(cheap.contributions).toEqual([]);
  });

  test('évalue une préférence de budget cible seulement lorsqu’elle est explicite et compatible', () => {
    const preference = [{ kind: 'PRICE_TARGET', target: 250000, currency: 'XAF', period: 'MONTH', weight: 100 }];
    expect(evaluateRankingCandidate(listing({ price: 250000 }), preference).contributions[0]).toMatchObject({ state: 'TRUE', points: 100 });
    expect(evaluateRankingCandidate(listing({ price: 200000 }), preference).contributions[0]).toMatchObject({ state: 'FALSE', points: 0 });
    expect(evaluateRankingCandidate(listing({ status: 'hebergement', price: 250000 }), preference).contributions[0]).toMatchObject({ state: 'UNKNOWN', points: 50 });
  });

  test('refuse les poids, types de préférence et clés non autorisés', () => {
    expect(normalizeRankingPreferences([
      { kind: 'AMENITY', key: 'parking', weight: 999999 },
      { kind: 'PRIVATE_FIELD', key: 'commission', weight: 100 },
      { kind: 'AMENITY', key: '$where', weight: 100 },
    ])).toEqual([{ kind: 'AMENITY', key: 'parking', weight: 500 }]);
  });

  test('ne compare pas directement le prix nocturne et le loyer mensuel', () => {
    const result = evaluateRankingCandidate(
      listing({ status: 'hebergement', price: 30000 }),
      [{ kind: 'PRICE_TARGET', target: 30000, currency: 'XAF', period: 'MONTH' }],
    );
    expect(result.contributions[0].state).toBe('UNKNOWN');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INCOMPATIBLE_PRICE_PERIOD' })]));
  });
});
