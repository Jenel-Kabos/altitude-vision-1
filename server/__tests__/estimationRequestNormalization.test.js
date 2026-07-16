const { normalizeEstimationRequest, calculateCompleteness } = require('../services/estimationRequestNormalizationService');

const legacy = { typeBien: 'Terrain', transaction: 'vente', adresse: 'TEST DATA ADDRESS', surface: 100, nom: 'TEST DATA CLIENT', email: 'test@example.com' };
const wizard = { publicFormVersion: 2, valuationPurpose: 'Vente', typeBien: 'Maison', transaction: 'vente', adresse: 'TEST DATA AREA, TEST DATA CITY', surface: 120, location: { country: 'TEST DATA COUNTRY', city: 'TEST DATA CITY', district: 'TEST DATA DISTRICT', neighborhood: 'TEST DATA AREA', latitude: -4, longitude: 15 }, land: { surface: 300, unit: 'm²' }, construction: { builtSurface: 120, condition: 'Bon', constructionYear: 2020 }, rooms: { bedrooms: 3 }, equipment: ['TEST DATA EQUIPMENT'], declaredValues: { desiredPrice: 1000 }, contact: { lastName: 'TEST DATA CLIENT', firstName: 'TEST', phone: '+242 000 000 000', email: 'test@example.com' } };

describe('normalisation des demandes publiques — TEST DATA', () => {
  test('accepte l’ancien payload sans rendre le téléphone historique obligatoire', () => {
    const result = normalizeEstimationRequest(legacy);
    expect(result).toMatchObject({ typeBien: 'Terrain', source: 'LEGACY_PUBLIC_FORM', publicFormVersion: 1, statut: 'En attente', staffViewedAt: null });
  });

  test('normalise le wizard directement vers les structures du laboratoire', () => {
    const result = normalizeEstimationRequest(wizard, { userId: '507f1f77bcf86cd799439011' });
    expect(result).toMatchObject({ source: 'PUBLIC_FORM', requesterUser: '507f1f77bcf86cd799439011', location: { city: 'TEST DATA CITY' }, land: { surface: 300 }, construction: { builtSurface: 120 }, rooms: { bedrooms: 3 }, declaredValues: { desiredPrice: 1000 } });
    expect(result.workflowHistory[0].to).toBe('En attente'); expect(result.completenessScore).toBeGreaterThan(50);
  });

  test('ignore les champs internes interdits', () => {
    const result = normalizeEstimationRequest({ ...wizard, statut: 'Rapport publié', staffViewedAt: new Date(), validatedBy: 'bad', currentCalculation: 'bad', workflowHistory: [{ to: 'Rapport publié' }], expertValueAdjustment: { adjustedValue: 1 } });
    expect(result.statut).toBe('En attente'); expect(result.staffViewedAt).toBeNull(); expect(result).not.toHaveProperty('validatedBy'); expect(result).not.toHaveProperty('currentCalculation'); expect(result.workflowHistory).toHaveLength(1);
  });

  test('un terrain nu ne requiert pas de construction pour sa complétude', () => {
    const result = normalizeEstimationRequest({ ...wizard, typeBien: 'Terrain nu', surface: 300, construction: {}, rooms: {} });
    expect(result.missingInformation).not.toContain('construction'); expect(result.missingInformation).not.toContain('composition');
  });

  test('refuse les coordonnées, surfaces et contacts invalides', () => {
    expect(() => normalizeEstimationRequest({ ...wizard, surface: 0 })).toThrow(/surface positive/);
    expect(() => normalizeEstimationRequest({ ...wizard, location: { ...wizard.location, latitude: 100 } })).toThrow(/Latitude/);
    expect(() => normalizeEstimationRequest({ ...wizard, contact: { ...wizard.contact, email: 'bad' } })).toThrow(/obligatoires/);
  });

  test('le score retourne sections faibles et informations manquantes', () => {
    const score = calculateCompleteness({ typeBien: 'Maison', nom: '', email: '', telephone: '', location: {}, surface: 1, construction: {}, rooms: {}, documents: [], photos: [], declaredValues: {} });
    expect(score.score).toBeLessThan(50); expect(score.weakSections).toEqual(score.missingInformation);
  });
});
