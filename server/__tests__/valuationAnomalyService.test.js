const { detectValuationAnomalies, confidenceBreakdown } = require('../services/valuationAnomalyService');

describe('valuationAnomalyService', () => {
  test('détecte les incohérences structurelles critiques', () => {
    const anomalies = detectValuationAnomalies({ estimation: { surface: -1, location: { latitude: 100 }, construction: { depreciationRate: 120 }, documents: [] } });
    expect(anomalies.filter(item => item.level === 'critical').map(item => item.code)).toEqual(expect.arrayContaining(['SURFACE_INVALID', 'LATITUDE_INVALID', 'DEPRECIATION_INVALID']));
  });

  test('explique un score de confiance de manière reproductible', () => {
    const result = confidenceBreakdown({ location: { city: 'Brazzaville', neighborhood: 'Bacongo' }, documents: [{ verified: true }], comparables: [{ included: true, similarity: 80 }], photos: [{}], surface: 100 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.details).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Localisation' }), expect.objectContaining({ label: 'Comparables' })]));
  });
});
