const ValuationCoefficient = require('../models/ValuationCoefficient');
const { calculateComparableSimilarity, directDistanceKm } = require('../services/comparableSimilarityService');
const { renderHtml } = require('../services/valuationReportService');

describe('compléments du laboratoire', () => {
  test('un coefficient versionné refuse une plage incohérente', async () => {
    const coefficient = new ValuationCoefficient({ code: 'TEST_LOC', label: 'Test', category: 'localisation', minValue: 1.2, defaultValue: 1, maxValue: 1.3 });
    await expect(coefficient.validate()).rejects.toThrow('min ≤ défaut ≤ max');
  });

  test('le score de comparable est déterministe et distingue un prix demandé', () => {
    const result = calculateComparableSimilarity({ estimation: { typeBien: 'Terrain nu', location: { city: 'Brazzaville', neighborhood: 'Bacongo' }, land: { surface: 500 } }, comparable: { propertyType: 'Terrain nu', city: 'Brazzaville', neighborhood: 'Bacongo', landSurface: 500, askingPrice: 5000000, date: new Date() } });
    expect(result.score).toBeGreaterThan(70);
    expect(result.suggestedWeight).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toContain('Prix demandé');
  });

  test('la distance directe et la micro-localisation réduisent le poids des références éloignées', () => {
    expect(directDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.19, 1);
    const estimation = { typeBien: 'Terrain nu', location: { city: 'TEST DATA', neighborhood: 'Zone A', latitude: 0, longitude: 0 }, land: { surface: 100 } };
    const base = { propertyType: 'Terrain nu', city: 'TEST DATA', landSurface: 100, concludedPrice: 1, sourceConfidence: 'bon', date: new Date() };
    const near = calculateComparableSimilarity({ estimation, comparable: { ...base, neighborhood: 'Zone A', latitude: 0, longitude: .001 } });
    const far = calculateComparableSimilarity({ estimation, comparable: { ...base, neighborhood: 'Zone B', latitude: 0, longitude: 1 } });
    expect(near.score).toBeGreaterThan(far.score);
    expect(near.suggestedWeight).toBeGreaterThan(far.suggestedWeight);
  });

  test('le rapport HTML utilise le snapshot publié et sa limitation', () => {
    const html = renderHtml({ _id: '507f1f77bcf86cd799439011', nom: 'Client privé', typeBien: 'Terrain nu', location: { city: 'Brazzaville' }, report: { verificationCode: 'ALT-TEST', publishedAt: new Date(), publishedCalculation: { version: 2, confidenceScore: 70, finalResult: { marketValue: { low: 1, recommended: 2, high: 3 } } } } });
    expect(html).toContain('ALT-TEST');
    expect(html).toContain('ne remplace pas automatiquement');
  });
});
