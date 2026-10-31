const P = require('../services/altimmoAssistant/comparisonPolicy');

const oid = (n) => n.toString(16).padStart(24, '0');
const listing = (n, extra = {}) => ({
  _id: oid(n), id: oid(n), title: `Bien ${n}`, status: 'location', type: 'Maison', price: 200000,
  bedrooms: 3, bathrooms: 2, surface: 120, amenities: [],
  address: { city: 'Brazzaville', arrondissement: 'Talangaï', neighborhood: 'Plateau' },
  isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', ...extra,
});
const stay = (n, extra = {}) => listing(n, {
  status: 'hebergement', type: 'Maison', accommodationType: 'maison_meublee', accommodationId: oid(1000 + n),
  occupancyMode: 'entire_place', furnished: true, capacity: { maxAdults: 4, maxChildren: 2 }, minimumStay: 1, ...extra,
});
const criteria = (patch = {}) => P.sanitizeComparisonCriteria({ transaction: 'RENT', ...patch });
const entry = (item, { crit = criteria(), preferences = [], label = 'Bien A' } = {}) => P.buildComparisonEntry(item, { criteria: crit, preferences, label });
const row = (grid, key) => grid.rows.find((item) => item.key === key);

describe('IA-03C2 — configuration bornée', () => {
  test('5 biens par défaut, limite configurable côté serveur et toujours bornée', () => {
    expect(P.resolveComparisonConfig()).toEqual({ maxListings: 5 });
    expect(P.resolveComparisonConfig({ maxListings: 3 })).toEqual({ maxListings: 3 });
    expect(P.resolveComparisonConfig({ maxListings: 1 })).toEqual({ maxListings: 2 });
    expect(P.resolveComparisonConfig({ maxListings: 10000 })).toEqual({ maxListings: P.ABSOLUTE_MAX_LISTINGS });
    expect(P.resolveComparisonConfig({ maxListings: 'beaucoup' })).toEqual({ maxListings: 5 });
    expect(P.ABSOLUTE_MAX_LISTINGS).toBe(10);
  });
});

describe('IA-03C2 — unités tarifaires', () => {
  test('vente = total, location = mois, hébergement = tarif nocturne RatePlan uniquement', () => {
    expect(P.pricingOf(listing(1, { status: 'vente', price: 30000000 }))).toMatchObject({ state: 'KNOWN', amount: 30000000, currency: 'XAF', period: 'TOTAL', source: 'public_listing.price' });
    expect(P.pricingOf(listing(1))).toMatchObject({ state: 'KNOWN', amount: 200000, currency: 'XAF', period: 'MONTH' });
    expect(P.pricingOf(stay(1, { price: 1, searchPrice: 30000, searchCurrency: 'XAF' }))).toMatchObject({ state: 'KNOWN', amount: 30000, period: 'NIGHT', source: 'rate_plan.nightly' });
    expect(P.pricingOf(stay(1, { price: 30000 }))).toMatchObject({ state: 'UNKNOWN', amount: null, period: 'NIGHT' });
    expect(P.monthlyPricingOf(stay(1, { monthlyPrice: 450000, monthlyCurrency: 'XAF' }))).toMatchObject({ state: 'KNOWN', amount: 450000, period: 'MONTH', source: 'rate_plan.monthly' });
  });

  test('une valeur invalide ou contradictoire devient inconnue avec un signalement', () => {
    expect(P.pricingOf(listing(1, { price: -5 }))).toMatchObject({ state: 'UNKNOWN', issue: 'INVALID_VALUE' });
    expect(P.pricingOf(listing(1, { price: 'gratuit' }))).toMatchObject({ state: 'UNKNOWN', issue: 'INVALID_VALUE' });
    expect(P.pricingOf(stay(1, { searchPrice: 30000, searchCurrency: 'EUR', accommodationCurrency: 'XAF' }))).toMatchObject({ state: 'UNKNOWN', issue: 'CONTRADICTORY_CURRENCY' });
    expect(P.pricingOf(listing(1, { status: undefined }))).toMatchObject({ state: 'UNKNOWN', period: null, issue: 'PERIOD_UNKNOWN' });
  });
});

describe('IA-03C2 — comparabilité', () => {
  const level = (items) => P.assessComparability(items.map((item) => entry(item)));

  test('deux ventes et deux locations sont directement comparables', () => {
    expect(level([listing(1, { status: 'vente', price: 1 }), listing(2, { status: 'vente', price: 2 })]).level).toBe('COMPARABLE');
    expect(level([listing(1), listing(2)]).level).toBe('COMPARABLE');
  });

  test('vente contre location : côte à côte, prix non comparables', () => {
    const out = level([listing(1, { status: 'vente', price: 30000000 }), listing(2)]);
    expect(out.level).toBe('PARTIALLY_COMPARABLE');
    expect(out.reasons).toEqual(expect.arrayContaining(['TRANSACTION_DIFFERS', 'PRICE_PERIOD_DIFFERS']));
    expect(out.dimensions.price.comparable).toBe(false);
    expect(out.dimensions.bedrooms.comparable).toBe(true);
  });

  test('prix nocturne contre prix mensuel : jamais « moins cher » sur le montant affiché', () => {
    const out = level([stay(1, { searchPrice: 25000, searchCurrency: 'XAF' }), listing(2, { price: 200000 })]);
    expect(out.dimensions.price).toMatchObject({ comparable: false, reason: 'PRICE_PERIOD_DIFFERS' });
  });

  test('hôtel contre maison meublée : tarif nocturne comparable, catégories distinctes', () => {
    const hotel = stay(1, { accommodationType: 'hotel', occupancyMode: 'room_based', searchPrice: 40000, searchCurrency: 'XAF' });
    const out = level([hotel, stay(2, { searchPrice: 30000, searchCurrency: 'XAF' })]);
    expect(out.level).toBe('PARTIALLY_COMPARABLE');
    expect(out.reasons).toContain('ACCOMMODATION_CATEGORY_DIFFERS');
    expect(out.dimensions.price.comparable).toBe(true);
    expect(out.dimensions.bedrooms).toMatchObject({ comparable: false, reason: 'ACCOMMODATION_CATEGORY_DIFFERS' });
  });

  test('devises différentes et périodicités inconnues ne sont jamais converties', () => {
    const currencies = level([stay(1, { searchPrice: 50, searchCurrency: 'EUR' }), stay(2, { searchPrice: 30000, searchCurrency: 'XAF' })]);
    expect(currencies.dimensions.price).toMatchObject({ comparable: false, reason: 'CURRENCY_DIFFERS' });
    const periods = level([listing(1, { status: undefined }), listing(2)]);
    expect(periods.dimensions.price).toMatchObject({ comparable: false, reason: 'PERIOD_UNKNOWN' });
    expect(periods.level).toBe('PARTIALLY_COMPARABLE');
  });

  test('NOT_COMPARABLE quand aucune dimension partagée n’est connue', () => {
    const empty = (n) => ({ _id: oid(n), id: oid(n), title: 'Vide', isPublished: true, statusAdmin: 'Validée', availability: 'Disponible' });
    expect(level([empty(1), empty(2)]).level).toBe('NOT_COMPARABLE');
  });
});

describe('IA-03C2 — projection et critères', () => {
  test('la projection de comparaison ne garde que la liste blanche publique et les faits d’hébergement typés', () => {
    const out = P.toComparisonListing({
      ...stay(1), owner: oid(9), tenant: oid(8), commissionRate: 17, latitude: -4.2, longitude: 15.2, documents: ['x.pdf'],
      internalNotes: 'note', bankAccount: { iban: 'CG00' }, kyc: { status: 'ok' }, address: { street: 'Rue privée', city: 'Brazzaville' },
      amenitiesComplete: true, availabilityCheck: { checked: true, available: true },
      capacity: { maxAdults: 4, maxChildren: 2, owner: 'x' }, minimumStay: 'deux', searchPrice: 30000, searchCurrency: 'XAF',
    });
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/owner|tenant|commission|latitude|longitude|documents|internalNotes|iban|kyc|Rue privée|amenitiesComplete|availabilityCheck/);
    expect(out.capacity).toEqual({ maxAdults: 4, maxChildren: 2 });
    expect(out).not.toHaveProperty('minimumStay');
    expect(out.searchPrice).toBe(30000);
  });

  test('les critères sont reconstruits par liste blanche, sans clé forgée', () => {
    const out = P.sanitizeComparisonCriteria({
      transaction: 'RENT', $where: 'sleep(1)', tenant: 'other', propertyTypes: ['Maison', 'Château'],
      location: { city: 'Brazzaville', districts: ['Talangaï', { $ne: null }, 'Inconnu'] },
      budget: { max: 250000, min: -1, currency: 'XAF', period: 'MONTH' }, bedrooms: { min: 3 },
      amenities: { required: ['clim', 'parking'], preferred: ['jacuzzi'], excluded: [{ $gt: '' }] },
      proximity: { required: [{ category: 'market', maxMeters: 1000 }, { category: 'casino', maxMeters: 1 }], preferred: [] },
    });
    expect(out).not.toHaveProperty('$where');
    expect(out).not.toHaveProperty('tenant');
    expect(out.propertyTypes).toEqual(['Maison']);
    expect(out.location.districts).toEqual(['Talangaï']);
    expect(out.budget).toEqual({ min: null, max: 250000, currency: 'XAF', period: 'MONTH' });
    expect(out.amenities).toEqual({ required: ['air_conditioning', 'parking'], preferred: [], excluded: [] });
    expect(out.proximity.required).toEqual([{ category: 'market', maxMeters: 1000 }]);
    expect(out.stay).toEqual({ checkIn: null, checkOut: null, nights: null, adults: null, children: null, rooms: null, stayType: null });
    expect(P.sanitizeComparisonCriteria('nimporte')).toEqual(P.sanitizeComparisonCriteria({}));
  });
});

describe('IA-03C2 — entrée de comparaison', () => {
  test('le budget n’est évalué que dans la même unité tarifaire', () => {
    const crit = criteria({ budget: { max: 250000, currency: 'XAF', period: 'MONTH' } });
    const rent = entry(listing(1, { price: 240000 }), { crit });
    expect(rent.constraintChecks).toContainEqual({ field: 'budget.max', state: 'TRUE' });
    const sale = entry(listing(2, { status: 'vente', price: 30000000 }), { crit });
    expect(sale.constraintChecks).toContainEqual({ field: 'budget.max', state: 'UNKNOWN', reason: 'INCOMPARABLE_PRICE_UNIT' });
    expect(sale.constraintChecks).toContainEqual({ field: 'transaction', state: 'FALSE' });
    expect(sale.constraintStatus).toBe('NOT_MATCHING');
  });

  test('score et confiance IA-03C1 conservés séparément, avec intervalle explicite', () => {
    const out = entry(listing(1, { amenities: ['parking'] }), { preferences: ['parking', 'climatisation'] });
    expect(out.ranking).toMatchObject({ score: 7500, confidence: 5000, scoreRange: { min: 5000, max: 10000 }, source: 'IA-03C1' });
    expect(out.ranking.confirmed).toEqual(['parking']);
    expect(out.ranking.toVerify).toEqual(['air_conditioning']);
    expect(out.ranking.unsatisfied).toEqual([]);
  });

  test('sans préférence explicite, aucune pondération n’est inventée', () => {
    const out = entry(listing(1, { amenities: ['parking'] }));
    expect(out.ranking).toMatchObject({ score: 0, confidence: 0, scoreRange: null, basis: 'NO_PREFERENCES' });
  });
});

describe('IA-03C2 — grille comparative', () => {
  const grid = (items, options = {}) => P.buildComparisonGrid(items.map((item, index) => entry(item, { ...options, label: `Bien ${'ABCDE'[index]}` })), options);

  test('critères communs, valeurs inconnues jamais remplies', () => {
    const out = grid([listing(1), listing(2, { surface: undefined, bathrooms: null })]);
    for (const key of ['offer', 'propertyType', 'location.city', 'location.arrondissement', 'location.neighborhood', 'price', 'surface', 'bedrooms', 'bathrooms', 'amenities.declared', 'availability.public']) {
      expect(row(out, key)).toBeDefined();
    }
    expect(row(out, 'surface').values[1]).toMatchObject({ state: 'UNKNOWN', value: null, display: 'Non renseigné' });
    expect(row(out, 'bathrooms').values[1]).toMatchObject({ state: 'UNKNOWN', value: null });
    expect(row(out, 'price').values[0]).toMatchObject({ state: 'KNOWN', value: { amount: 200000, currency: 'XAF', period: 'MONTH' }, display: '200 000 XAF / mois' });
    expect(row(out, 'availability.public').values[0].display).toBe('Annoncé disponible (non daté)');
  });

  test('ventes et locations ont leurs lignes propres', () => {
    const out = grid([listing(1, { status: 'vente', price: 30000000, constructionType: 'Dur' }), listing(2, { cautionMultiplicateur: 3 })]);
    expect(row(out, 'sale.constructionType').values.map((v) => v.state)).toEqual(['KNOWN', 'NOT_APPLICABLE']);
    expect(row(out, 'rental.deposit').values[1]).toMatchObject({ state: 'KNOWN', value: 3, display: '3 mois de loyer' });
    expect(row(out, 'price').values[0].display).toBe('30 000 000 XAF');
    expect(row(out, 'stay.nightlyRate')).toBeUndefined();
  });

  test('hôtels et meublés : catégorie, capacité, tarifs nocturne/mensuel, séjours court et long', () => {
    const hotel = stay(1, { accommodationType: 'hotel', occupancyMode: 'room_based', searchPrice: 40000, searchCurrency: 'XAF' });
    const meuble = stay(2, { searchPrice: 30000, searchCurrency: 'XAF', monthlyPrice: 450000, monthlyCurrency: 'XAF', maximumStay: 90 });
    const out = grid([hotel, meuble]);
    expect(row(out, 'stay.accommodationType').values.map((v) => v.display)).toEqual(['Hôtel', 'Maison meublée']);
    expect(row(out, 'stay.capacity').values[0].display).toBe('4 adultes, 2 enfants');
    expect(row(out, 'stay.nightlyRate').values.map((v) => v.state)).toEqual(['KNOWN', 'KNOWN']);
    expect(row(out, 'stay.monthlyRate').values.map((v) => v.state)).toEqual(['UNKNOWN', 'KNOWN']);
    expect(row(out, 'stay.shortStay').values.map((v) => v.state)).toEqual(['TRUE', 'TRUE']);
    expect(row(out, 'stay.longStay').values.map((v) => v.state)).toEqual(['UNKNOWN', 'TRUE']);
    expect(row(out, 'stay.datedAvailability').values.map((v) => v.state)).toEqual(['UNKNOWN', 'UNKNOWN']);
  });

  test('les besoins exprimés deviennent des lignes TRUE/FALSE/UNKNOWN distinctes', () => {
    const crit = criteria({ amenities: { required: ['garden'], preferred: [], excluded: [] }, proximity: { required: [{ category: 'market', maxMeters: 1000 }], preferred: [] }, location: { city: 'Brazzaville', radiusMeters: 800 } });
    const items = [listing(1, { amenities: ['parking', 'jardin'] }), listing(2, { amenities: ['jardin'], amenitiesComplete: true }), listing(3)];
    const out = grid(items, { crit, preferences: ['parking'] });
    expect(row(out, 'need.amenity.parking').values.map((v) => v.state)).toEqual(['TRUE', 'FALSE', 'UNKNOWN']);
    expect(row(out, 'need.amenity.garden').values.map((v) => v.state)).toEqual(['TRUE', 'TRUE', 'UNKNOWN']);
    expect(row(out, 'unverifiable.proximity.market')).toMatchObject({ group: 'UNVERIFIABLE', reason: 'POI_CATALOG_UNAVAILABLE' });
    expect(row(out, 'unverifiable.proximity.market').values.every((v) => v.state === 'UNKNOWN')).toBe(true);
    expect(row(out, 'unverifiable.radius').reason).toBe('RADIUS_WITHOUT_REFERENCE_COORDINATES');
  });
});
