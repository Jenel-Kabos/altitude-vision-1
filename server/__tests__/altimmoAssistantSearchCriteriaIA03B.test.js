const {
  buildAllowedSearchRequests,
  evaluateListingConstraints,
} = require('../services/altimmoAssistant/searchCriteriaAdapter');
const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');

const criteria = (text) => parseRealEstateRequest(text).criteria;

describe('IA-03B — adaptateur de critères fermé', () => {
  test('traduit uniquement les critères Property autorisés', () => {
    const parsed = criteria('Maison à louer à Talangaï, 3 chambres, 2 salles de bain, au moins 120 m², maximum 250 000 FCFA par mois');
    parsed.tenant = { $ne: null };
    parsed.owner = 'secret';
    parsed.fields = 'owner documents';
    const built = buildAllowedSearchRequests(parsed);
    expect(built.requests).toEqual([{
      offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Talangaï',
      maxPrice: '250000', minBedrooms: '3', minBathrooms: '2', minSurface: '120', sort: '-createdAt', page: '1', limit: '50',
    }]);
    expect(JSON.stringify(built.requests)).not.toMatch(/tenant|owner|fields|\$ne/);
  });

  test('sépare une requête par type canonique sans accepter de catégorie forgée', () => {
    const parsed = criteria('Je cherche une maison ou une villa à vendre à Brazzaville');
    parsed.propertyTypes.push({ $gt: '' }, 'TypeInterne');
    const built = buildAllowedSearchRequests(parsed);
    expect(built.requests.map((x) => x.propertyType)).toEqual(['Maison', 'Villa']);
  });

  test('refuse la comparaison d’un loyer avec une période par nuit', () => {
    const parsed = criteria('Maison à louer à Brazzaville, maximum 25 000 FCFA par nuit');
    parsed.transaction = 'RENT';
    const built = buildAllowedSearchRequests(parsed);
    expect(built.requests[0]).not.toHaveProperty('maxPrice');
    expect(built.blockingIssues).toContainEqual(expect.objectContaining({ code: 'INCOMPATIBLE_BUDGET_PERIOD' }));
  });

  test('marque proximité et rayon comme non vérifiables sans catalogue POI', () => {
    const built = buildAllowedSearchRequests(criteria('Maison à louer à moins de 2 km d’un marché à Brazzaville'));
    expect(built.unverifiableCriteria.map((x) => x.field)).toEqual(expect.arrayContaining(['proximity', 'location.radiusMeters']));
  });

  test('rejette une contrainte obligatoire connue fausse', () => {
    const result = evaluateListingConstraints(
      { type: 'Maison', status: 'location', price: 200000, bedrooms: 2, amenities: ['parking'], amenitiesComplete: true },
      criteria('Maison à louer, 3 chambres, parking obligatoire'),
    );
    expect(result.classification).toBe('REJECT');
    expect(result.checks).toContainEqual(expect.objectContaining({ field: 'bedrooms.min', state: 'FALSE' }));
  });

  test('classe un équipement requis absent d’une source incomplète en UNKNOWN', () => {
    const result = evaluateListingConstraints(
      { type: 'Maison', status: 'location', amenities: [] },
      criteria('Maison à louer avec parking obligatoire'),
    );
    expect(result.classification).toBe('VERIFY');
    expect(result.checks).toContainEqual(expect.objectContaining({ field: 'amenities.required.parking', state: 'UNKNOWN' }));
  });

  test('respecte une exclusion seulement avec preuve d’absence', () => {
    const parsed = criteria('Villa sans piscine');
    expect(evaluateListingConstraints({ type: 'Villa', amenities: ['piscine'], amenitiesComplete: true }, parsed).classification).toBe('REJECT');
    expect(evaluateListingConstraints({ type: 'Villa', amenities: [], amenitiesComplete: true }, parsed).classification).toBe('MATCH');
    expect(evaluateListingConstraints({ type: 'Villa', amenities: [] }, parsed).classification).toBe('VERIFY');
  });

  test('ne filtre ni ne score les préférences pendant IA-03B', () => {
    const parsed = criteria('Maison à louer avec jardin si possible');
    const result = evaluateListingConstraints({ type: 'Maison', status: 'location', amenities: [] }, parsed);
    expect(result.classification).toBe('MATCH');
    expect(result.preferences).toEqual(['garden']);
  });

  test('une disponibilité datée non branchée reste UNKNOWN', () => {
    const parsed = parseRealEstateRequest('Hôtel à Brazzaville du 10/11/2026 au 13/11/2026').criteria;
    const result = evaluateListingConstraints({ status: 'hebergement', accommodationType: 'hotel' }, parsed);
    expect(result.classification).toBe('VERIFY');
    expect(result.checks).toContainEqual(expect.objectContaining({ field: 'stay.availability', state: 'UNKNOWN' }));
  });

  test('rejette un rayon hors limite serveur', () => {
    const parsed = criteria('Maison à louer à moins de 2 km d’un marché à Brazzaville');
    parsed.location.radiusMeters = 500001;
    const built = buildAllowedSearchRequests(parsed);
    expect(built.blockingIssues).toContainEqual(expect.objectContaining({ code: 'INVALID_RADIUS' }));
  });

  test('évalue la capacité d’un meublé entier et garde celle d’un hôtel inconnue', () => {
    const parsed = criteria('Maison meublée à Brazzaville pour un court séjour pour 4 adultes et 2 enfants');
    expect(evaluateListingConstraints({
      status: 'hebergement', accommodationType: 'maison_meublee', address: { city: 'Brazzaville' }, capacity: { maxAdults: 2, maxChildren: 2 },
    }, parsed).classification).toBe('REJECT');
    expect(evaluateListingConstraints({
      status: 'hebergement', accommodationType: 'maison_meublee', address: { city: 'Brazzaville' }, capacity: { maxAdults: 4, maxChildren: 2 },
    }, parsed).classification).toBe('MATCH');
    const hotel = { status: 'hebergement', accommodationType: 'hotel', address: { city: 'Brazzaville' } };
    const hotelCriteria = criteria('Hôtel à Brazzaville pour 2 adultes et 1 chambre');
    const result = evaluateListingConstraints(hotel, hotelCriteria);
    expect(result.classification).toBe('VERIFY');
    expect(result.checks).toContainEqual(expect.objectContaining({ field: 'stay.capacity', state: 'UNKNOWN' }));
  });

  test('n’affirme un budget hébergement que sur un tarif nocturne vérifié', () => {
    const parsed = criteria('Hôtel à Brazzaville maximum 30 000 FCFA par nuit');
    const base = { status: 'hebergement', accommodationType: 'hotel', address: { city: 'Brazzaville' } };
    expect(evaluateListingConstraints({ ...base, price: 10000 }, parsed).classification).toBe('VERIFY');
    expect(evaluateListingConstraints({ ...base, searchPrice: 25000, searchCurrency: 'XAF' }, parsed).classification).toBe('MATCH');
    expect(evaluateListingConstraints({ ...base, searchPrice: 35000, searchCurrency: 'XAF' }, parsed).classification).toBe('REJECT');
  });
});
