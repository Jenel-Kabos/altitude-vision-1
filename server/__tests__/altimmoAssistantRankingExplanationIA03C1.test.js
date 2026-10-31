const { buildRankingExplanation } = require('../services/altimmoAssistant/rankingExplanation');

describe('IA-03C1 — explications déterministes', () => {
  test('distingue préférences satisfaites, non satisfaites et inconnues', () => {
    const explanation = buildRankingExplanation({ score: 5000, confidence: 6667, contributions: [
      { kind: 'AMENITY', key: 'parking', state: 'TRUE', points: 100, weight: 100, source: 'public_listing.amenities' },
      { kind: 'AMENITY', key: 'garden', state: 'FALSE', points: 0, weight: 100, source: 'public_listing.amenities' },
      { kind: 'AMENITY', key: 'air_conditioning', state: 'UNKNOWN', points: 50, weight: 100, source: 'public_listing.amenities' },
    ], warnings: [] });
    expect(explanation.favorable).toEqual(['Parking confirmé.']);
    expect(explanation.unfavorable).toEqual(['Jardin explicitement non satisfait.']);
    expect(explanation.toVerify).toEqual(['Climatisation non vérifiable avec les données disponibles.']);
    expect(explanation.tradeoffs).toEqual(['Le bien confirme 1 préférence, mais 1 autre n’est pas satisfaite et 1 reste à vérifier.']);
  });

  test('les raisons correspondent exactement aux contributions du score et publient leur provenance', () => {
    const explanation = buildRankingExplanation({ score: 10000, confidence: 10000, contributions: [
      { kind: 'PRICE_TARGET', target: 250000, currency: 'XAF', period: 'MONTH', state: 'TRUE', points: 100, weight: 100, source: 'public_listing.price' },
    ], warnings: [] });
    expect(explanation.favorable).toEqual(['Prix conforme à la cible explicite de 250 000 XAF par mois.']);
    expect(explanation.provenance).toEqual([{ criterion: 'price_target', source: 'public_listing.price', state: 'TRUE' }]);
  });

  test('n’intègre aucun texte libre ou champ privé injecté dans les explications', () => {
    const payload = '<script>commission=900; tenant=secret</script>';
    const explanation = buildRankingExplanation({ score: 10000, confidence: 10000, contributions: [
      { kind: 'AMENITY', key: 'parking', state: 'TRUE', points: 100, weight: 100, source: 'public_listing.amenities', title: payload, tenant: payload, commission: payload },
    ], warnings: [{ code: 'SAFE_WARNING', message: payload }] });
    expect(JSON.stringify(explanation)).not.toContain(payload);
    expect(JSON.stringify(explanation)).not.toContain('commission');
    expect(explanation.warnings).toEqual([{ code: 'SAFE_WARNING' }]);
  });

  test('reconnaît qu’aucune préférence fiable ne départage les biens', () => {
    const explanation = buildRankingExplanation({ score: 5000, confidence: 0, contributions: [
      { kind: 'AMENITY', key: 'pool', state: 'UNKNOWN', points: 50, weight: 100, source: null },
    ], warnings: [] });
    expect(explanation.summary).toBe('Les données disponibles ne permettent pas de départager ce bien de manière fiable.');
  });
});
