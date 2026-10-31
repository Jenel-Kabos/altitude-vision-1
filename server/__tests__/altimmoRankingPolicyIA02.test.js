const {
  AMENITY_STATE,
  classifyAmenity,
  scoreAmenityPreference,
  selectCandidateWindow,
} = require('../services/altimmoRankingPolicyService');

describe('IA-02 — politique de données inconnues', () => {
  test.each([
    [['Parking'], 'Parking', true, AMENITY_STATE.TRUE],
    [[], 'Parking', true, AMENITY_STATE.FALSE],
    [[], 'Parking', false, AMENITY_STATE.UNKNOWN],
    [null, 'Parking', false, AMENITY_STATE.UNKNOWN],
    [undefined, 'Climatisation', false, AMENITY_STATE.UNKNOWN],
  ])('équipements %p, complétude %s et préférence %s donnent %s', (amenities, requested, isComplete, expected) => {
    expect(classifyAmenity(amenities, requested, { isComplete })).toBe(expected);
  });

  test('une préférence inconnue est neutre et distincte d’une absence confirmée', () => {
    expect(scoreAmenityPreference(AMENITY_STATE.TRUE)).toEqual({ score: 1, confidence: 1 });
    expect(scoreAmenityPreference(AMENITY_STATE.FALSE)).toEqual({ score: 0, confidence: 1 });
    expect(scoreAmenityPreference(AMENITY_STATE.UNKNOWN)).toEqual({ score: 0.5, confidence: 0 });
  });
});

describe('IA-02 — fenêtre de candidats', () => {
  const listing = (id, { mandatory = true, preliminary = 0 } = {}) => ({ id, mandatory, preliminary });

  test.each([0, 1, 49, 50, 51, 100])('conserve les meilleurs après contraintes pour %i candidats', (count) => {
    const listings = Array.from({ length: count }, (_, i) => listing(`p-${i}`, { preliminary: i }));
    const selected = selectCandidateWindow(listings, {
      mandatoryMatch: (item) => item.mandatory,
      preliminaryScore: (item) => item.preliminary,
    });
    expect(selected).toHaveLength(count);
    if (count) expect(selected[0].id).toBe(`p-${count - 1}`);
  });

  test('un meilleur bien ancien au-delà de la cinquantième insertion reste sélectionnable', () => {
    const listings = Array.from({ length: 100 }, (_, i) => listing(`p-${i}`, { preliminary: i === 99 ? 1000 : i }));
    const selected = selectCandidateWindow(listings, {
      mandatoryMatch: (item) => item.mandatory,
      preliminaryScore: (item) => item.preliminary,
    });
    expect(selected[0].id).toBe('p-99');
    expect(selected.some((item) => item.id === 'p-99')).toBe(true);
  });

  test('élimine les contraintes obligatoires avant tout classement', () => {
    const selected = selectCandidateWindow([
      listing('très-noté-mais-inéligible', { mandatory: false, preliminary: 1000 }),
      listing('éligible', { preliminary: 1 }),
    ], {
      mandatoryMatch: (item) => item.mandatory,
      preliminaryScore: (item) => item.preliminary,
    });
    expect(selected.map((item) => item.id)).toEqual(['éligible']);
  });

  test('borne plusieurs centaines de candidats après tri, sans reprendre l’ordre d’insertion', () => {
    const listings = Array.from({ length: 400 }, (_, i) => listing(`p-${i}`, { preliminary: i }));
    const selected = selectCandidateWindow(listings, {
      mandatoryMatch: (item) => item.mandatory,
      preliminaryScore: (item) => item.preliminary,
    });
    expect(selected).toHaveLength(250);
    expect(selected[0].id).toBe('p-399');
    expect(selected.at(-1).id).toBe('p-150');
  });
});
