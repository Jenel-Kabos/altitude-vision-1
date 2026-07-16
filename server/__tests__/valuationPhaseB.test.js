const { buildMarketHistoryPipeline, finalizeMarketHistory } = require('../services/valuationMarketAnalyticsService');
const { calculateComparableSimilarity, directDistanceKm } = require('../services/comparableSimilarityService');
const Estimation = require('../models/Estimation');
const { validateComparableInput } = require('../controllers/estimationController');

describe('Phase B du laboratoire — TEST DATA', () => {
  test('l’agrégation marché sépare le type de prix et borne les filtres', () => {
    const pipeline = buildMarketHistoryPipeline({ period: 'month', filters: { city: 'TEST DATA CITY', priceType: 'demande' } });
    expect(pipeline[0].$match).toMatchObject({ active: true, city: 'TEST DATA CITY', priceType: 'demande' });
    expect(pipeline.find(stage => stage.$group).$group._id.priceType).toBe('$priceType');
  });

  test.each(['month', 'quarter', 'year'])('construit une agrégation %s', period => {
    expect(buildMarketHistoryPipeline({ period, filters: { transactionType: 'vente' } })).toEqual(expect.arrayContaining([expect.objectContaining({ $group: expect.any(Object) })]));
  });

  test('une tendance insuffisante ne produit aucune variation', () => {
    const series = finalizeMarketHistory([{ _id: { period: '2026-01', priceType: 'demande' }, average: 10, minimum: 8, maximum: 12, sampleSize: 2, referenceCount: 1, confidenceAverage: 2, dispersion: 1 }]);
    expect(series[0]).toMatchObject({ insufficientData: true, variation: null, sampleSize: 2 });
  });

  test('une variation suffisante évite la division par zéro', () => {
    const rows = [{ _id: { period: '2026-01', priceType: 'conclu' }, average: 0, sampleSize: 3 }, { _id: { period: '2026-02', priceType: 'conclu' }, average: 12, sampleSize: 3 }];
    expect(finalizeMarketHistory(rows)[1].variation).toBeNull();
  });

  test('distance absente ou valide reste déterministe', () => {
    expect(directDistanceKm({}, {})).toBeNull();
    expect(directDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    const result = calculateComparableSimilarity({ estimation: { typeBien: 'Terrain', surface: 100, location: { city: 'TEST DATA CITY' } }, comparable: { propertyType: 'Terrain', landSurface: 100, city: 'TEST DATA CITY', priceType: 'demande', sourceConfidence: 'moyen', date: new Date() } });
    expect(result.explanation).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 'fiabilité de la source', level: 'réduit' })]));
  });

  test('le modèle conserve le calcul et marque séparément ses entrées modifiées', () => {
    const estimation = new Estimation({ typeBien: 'Terrain', adresse: 'TEST DATA', surface: 100, nom: 'TEST DATA', email: 'test@example.com', currentCalculation: '507f1f77bcf86cd799439013', calculationInputUpdatedAt: new Date('2026-01-01') });
    expect(estimation.currentCalculation.toString()).toBe('507f1f77bcf86cd799439013'); expect(estimation.calculationInputUpdatedAt).toBeInstanceOf(Date);
  });

  test('le contrat de modification refuse exclusion, poids et coordonnées invalides', () => {
    const valid = { source: 'TEST DATA', sourceType: 'reference_manuelle', priceType: 'demande', askingPrice: 10, landSurface: 2, date: '2026-01-01', weight: .5, included: true };
    expect(validateComparableInput(valid)).toBeNull();
    expect(validateComparableInput({ ...valid, included: false })).toContain('justification');
    expect(validateComparableInput({ ...valid, weight: 2 })).toContain('poids');
    expect(validateComparableInput({ ...valid, latitude: 91 })).toContain('latitude');
    expect(validateComparableInput({ ...valid, askingPrice: 0 })).toContain('prix');
  });
});
