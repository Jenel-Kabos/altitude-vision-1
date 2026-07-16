const valuation = require('../services/propertyValuationService');

const marketReference = { minPricePerSqm: 30000, averagePricePerSqm: 40000, maxPricePerSqm: 50000 };
const constructionReference = { costMinPerSqm: 250000, costAveragePerSqm: 300000, costMaxPerSqm: 350000 };

describe('propertyValuationService', () => {
  test('calcule un terrain de 500m² à 40 000 XAF/m² avant ajustements', () => {
    const result = valuation.calculateLandValue({ landSurface: 500, reference: marketReference });
    expect(result.beforeCorrection.recommended).toBe(20000000);
    expect(result.result).toEqual({ low: 15000000, recommended: 20000000, high: 25000000, currency: 'XAF' });
  });

  test('calcule le coût de remplacement et la vétusté', () => {
    const result = valuation.calculateReplacementCost({ builtSurface: 100, reference: constructionReference, depreciationRate: 20 });
    expect(result.beforeDepreciation.recommended).toBe(30000000);
    expect(result.result.recommended).toBe(24000000);
  });

  test('conserve toujours une fourchette ordonnée', () => {
    const finalRange = valuation.calculateFinalRange([
      { result: { low: 10, recommended: 20, high: 30 } },
      { result: { low: 20, recommended: 30, high: 40 } },
    ]);
    expect(finalRange.low).toBeLessThanOrEqual(finalRange.recommended);
    expect(finalRange.recommended).toBeLessThanOrEqual(finalRange.high);
  });

  test('pondère les comparables par leur poids', () => {
    const result = valuation.calculateComparableValue([
      { pricePerSqm: 100000, surface: 100, weight: 3 },
      { pricePerSqm: 50000, surface: 100, weight: 1 },
    ]);
    expect(result.weightedPricePerSqm).toBe(87500);
    expect(result.result.recommended).toBe(8750000);
  });

  test('ignore systématiquement les comparables exclus', () => {
    const result = valuation.calculateComparableValue([
      { pricePerSqm: 100000, surface: 100, weight: 1, included: true },
      { pricePerSqm: 900000, surface: 100, weight: 1, included: false },
    ]);
    expect(result.comparableCount).toBe(1);
    expect(result.weightedPricePerSqm).toBe(100000);
  });

  test('capitalise le revenu locatif annuel net sans division par zéro', () => {
    const result = valuation.calculateIncomeValue({ annualNetIncome: 12000000, capitalizationRate: 0.1 });
    expect(result.result.recommended).toBe(120000000);
    expect(() => valuation.calculateIncomeValue({ annualNetIncome: 1, capitalizationRate: 0 })).toThrow('taux de capitalisation');
  });

  test('baisse le score de confiance lorsque les données sont absentes', () => {
    const complete = valuation.calculateConfidenceScore({ location: { city: 'Brazzaville', neighborhood: 'Bacongo' }, references: [{}], documents: [{ verified: true }], photos: [{}], physicalVisit: true, requiredFields: ['type', 'surface'] });
    const incomplete = valuation.calculateConfidenceScore({ location: {}, requiredFields: ['', ''] });
    expect(complete.score).toBeGreaterThan(incomplete.score);
    expect(incomplete.warnings).not.toHaveLength(0);
  });

  test.each([
    ['surface négative', () => valuation.calculateLandValue({ landSurface: -1, reference: marketReference })],
    ['prix incohérent', () => valuation.calculateLandValue({ landSurface: 1, reference: { ...marketReference, averagePricePerSqm: 0 } })],
    ['vétusté invalide', () => valuation.calculateReplacementCost({ builtSurface: 1, reference: constructionReference, depreciationRate: 101 })],
  ])('%s retourne une erreur contrôlée', (_name, run) => expect(run).toThrow());
});
