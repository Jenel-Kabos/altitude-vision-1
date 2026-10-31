const { compareRealEstate, searchRankAndCompareFromText, requestedComparisonCount, COMPARISON_MODE } = require('../services/altimmoAssistant/comparisonService');
const { rankRealEstateResults } = require('../services/altimmoAssistant/rankingService');
const { emptyCriteria } = require('../services/altimmoAssistant/criteria');

const hex = (n) => n.toString(16).padStart(24, '0');
const A = hex(1); const B = hex(2); const C = hex(3); const D = hex(4); const E = hex(5); const F = hex(6);
const listing = (id, overrides = {}) => ({
  _id: id, id, title: `Maison ${id.slice(-1)}`, status: 'location', type: 'Maison', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Talangaï', neighborhood: 'Plateau' },
  bedrooms: 3, bathrooms: 2, surface: 120, amenities: [],
  isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', pole: 'Altimmo', ...overrides,
});
const record = (l, extra = {}) => ({ id: l.id, listing: l, accommodation: null, rates: {}, ...extra });

function fakeResolver(records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const calls = [];
  const resolvePublicListings = jest.fn(async (ids) => {
    calls.push(ids);
    return ids.map((id) => byId.get(id)).filter(Boolean);
  });
  return { resolvePublicListings, calls };
}
const rentCriteria = (patch = {}) => {
  const c = emptyCriteria();
  c.transaction = 'RENT'; c.propertyTypes = ['Maison'];
  c.location.city = 'Brazzaville'; c.location.districts = ['Talangaï'];
  c.budget = { min: null, max: 250000, currency: 'XAF', period: 'MONTH' };
  c.bedrooms.min = 3;
  return Object.assign(c, patch);
};
// Montants au format de rankingExplanation : séparateur de milliers insécable.
const nb = (text) => { let out = text; while (/(\d) (\d{3})/.test(out)) out = out.replace(/(\d) (\d{3})/, '$1\u00a0$2'); return out; };
const selected = (ids, extra = {}) => ({ mode: COMPARISON_MODE.SELECTED, propertyIds: ids, context: { scopeMode: 'PUBLIC' }, ...extra });

describe('IA-03C2 — comparaison simple et bornes', () => {
  test('deux maisons, trois appartements, cinq biens', async () => {
    const two = fakeResolver([record(listing(A)), record(listing(B))]);
    expect((await compareRealEstate(selected([A, B]), two)).comparedIds).toEqual([A, B]);
    const apartments = [A, B, C].map((id) => record(listing(id, { type: 'Appartement' })));
    const three = await compareRealEstate(selected([A, B, C]), fakeResolver(apartments));
    expect(three.status).toBe('success');
    expect(three.items).toHaveLength(3);
    const five = await compareRealEstate(selected([A, B, C, D, E]), fakeResolver([A, B, C, D, E].map((id) => record(listing(id)))));
    expect(five.items).toHaveLength(5);
    expect(five.limits.maxListings).toBe(5);
  });

  test('aucun bien, un seul bien et dépassement sont refusés sans lecture', async () => {
    const deps = fakeResolver([]);
    for (const [ids, code] of [[[], 'EMPTY_SELECTION'], [[A], 'SELECTION_TOO_SMALL'], [[A, B, C, D, E, F], 'TOO_MANY_LISTINGS'], ['abc', 'INVALID_SELECTION']]) {
      const out = await compareRealEstate(selected(ids), deps);
      expect(out.status).toBe('invalid');
      expect(out.errors.map((e) => e.code)).toContain(code);
      expect(out.items).toEqual([]);
    }
    expect(deps.resolvePublicListings).not.toHaveBeenCalled();
  });

  test('la limite est configurable côté serveur, bornée, jamais par le contexte client', async () => {
    const deps = { ...fakeResolver([A, B, C, D, E, F].map((id) => record(listing(id)))) };
    const forged = await compareRealEstate(selected([A, B, C, D, E, F], { context: { scopeMode: 'PUBLIC', maxListings: 50 }, maxListings: 50, config: { maxListings: 50 } }), deps);
    expect(forged.status).toBe('invalid');
    const configured = await compareRealEstate(selected([A, B, C, D, E, F]), { ...deps, config: { maxListings: 6 } });
    expect(configured.status).toBe('success');
    const unbounded = await compareRealEstate(selected([A, B, C]), { ...deps, config: { maxListings: 1000 } });
    expect(unbounded.limits.maxListings).toBe(10);
  });
});

describe('IA-03C2 — grille comparative immobilière', () => {
  test('prix, superficie, chambres, salles de bains, localisation et équipements multiples', async () => {
    const deps = fakeResolver([
      record(listing(A, { price: 200000, surface: 100, amenities: ['parking', 'jardin'] })),
      record(listing(B, { price: 240000, surface: 150, bedrooms: 4, amenities: ['climatisation'] })),
    ]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking', 'climatisation', 'jardin'] }), deps);
    const row = (key) => out.grid.rows.find((r) => r.key === key);
    expect(row('price').values.map((c) => c.display)).toEqual([nb('200 000 XAF / mois'), nb('240 000 XAF / mois')]);
    expect(row('surface').values.map((c) => c.value)).toEqual([100, 150]);
    expect(row('bedrooms').values.map((c) => c.value)).toEqual([3, 4]);
    expect(row('bathrooms').values.map((c) => c.value)).toEqual([2, 2]);
    expect(row('location.neighborhood').values[0].display).toBe('Plateau');
    expect(row('location.arrondissement').values[0].display).toBe('Talangaï');
    expect(row('location.city').values[0].display).toBe('Brazzaville');
    expect(row('need.amenity.parking').values.map((c) => c.state)).toEqual(['TRUE', 'UNKNOWN']);
    expect(row('need.amenity.air_conditioning').values.map((c) => c.state)).toEqual(['UNKNOWN', 'TRUE']);
    expect(row('need.amenity.garden').values.map((c) => c.state)).toEqual(['TRUE', 'UNKNOWN']);
    expect(row('amenities.declared').values[0].value).toEqual(['parking', 'garden']);
  });

  test('donnée absente = cellule UNKNOWN, jamais une valeur inventée', async () => {
    const deps = fakeResolver([record(listing(A, { surface: undefined, bathrooms: null })), record(listing(B))]);
    const out = await compareRealEstate(selected([A, B]), deps);
    const surface = out.grid.rows.find((r) => r.key === 'surface').values[0];
    expect(surface).toMatchObject({ state: 'UNKNOWN', value: null, display: 'Non renseigné' });
    expect(out.grid.rows.find((r) => r.key === 'bathrooms').values[0].state).toBe('UNKNOWN');
  });

  test('données contradictoires ou invalides : inconnues avec avertissement', async () => {
    const deps = fakeResolver([record(listing(A, { bedrooms: -2, surface: 'abc' })), record(listing(B))]);
    const out = await compareRealEstate(selected([A, B]), deps);
    expect(out.grid.rows.find((r) => r.key === 'bedrooms').values[0].state).toBe('UNKNOWN');
    expect(out.grid.rows.find((r) => r.key === 'surface').values[0].state).toBe('UNKNOWN');
    expect(out.warnings.map((w) => w.code)).toContain('DATA_INCONSISTENT');
  });

  test('hôtel : catégorie, capacité, tarif nocturne vérifié, disponibilité datée non vérifiée', async () => {
    const hotel = record(listing(A, { status: 'hebergement', type: 'Appartement', accommodationType: 'hotel', price: 1 }), {
      accommodation: { accommodationType: 'hotel', capacity: { maxAdults: 2, maxChildren: 1 }, minimumStay: 1 },
      rates: { nightly: { amount: 35000, currency: 'XAF' } },
    });
    const furnished = record(listing(B, { status: 'hebergement', accommodationType: 'maison_meublee', price: 2 }), {
      accommodation: { accommodationType: 'maison_meublee', capacity: { maxAdults: 6, maxChildren: 2 }, minimumStay: 3, maximumStay: 90 },
      rates: { nightly: { amount: 30000, currency: 'XAF' }, monthly: { amount: 650000, currency: 'XAF' } },
    });
    const out = await compareRealEstate(selected([A, B]), fakeResolver([hotel, furnished]));
    const row = (key) => out.grid.rows.find((r) => r.key === key);
    expect(row('category').values.map((c) => c.value)).toEqual(['HOTEL', 'FURNISHED']);
    expect(row('stay.accommodationType').values.map((c) => c.display)).toEqual(['Hôtel', 'Maison meublée']);
    expect(row('stay.nightlyRate').values.map((c) => c.display)).toEqual([nb('35 000 XAF / nuit'), nb('30 000 XAF / nuit')]);
    expect(row('stay.monthlyRate').values.map((c) => c.state)).toEqual(['UNKNOWN', 'KNOWN']);
    expect(row('stay.capacity').values[1].display).toBe('6 adultes, 2 enfants');
    expect(row('stay.minimumStay').values.map((c) => c.value)).toEqual([1, 3]);
    expect(row('stay.datedAvailability').values.every((c) => c.state === 'UNKNOWN')).toBe(true);
    // Property.price n'apparaît jamais comme tarif d'un hébergement.
    expect(JSON.stringify(row('price'))).not.toMatch(/"amount":(1|2)\b/);
    expect(out.items[0].listing).not.toHaveProperty('price');
    expect(out.comparability.level).toBe('PARTIALLY_COMPARABLE');
  });
});

describe('IA-03C2 — comparabilité dans le service', () => {
  test('vente contre location : aucune comparaison de prix ni compromis tarifaire', async () => {
    const deps = fakeResolver([record(listing(A, { status: 'vente', price: 30000000 })), record(listing(B, { price: 200000 }))]);
    const out = await compareRealEstate(selected([A, B]), deps);
    expect(out.comparability.level).toBe('PARTIALLY_COMPARABLE');
    const codes = out.tradeoffs.flatMap((t) => [...t.strengths, ...t.weaknesses].map((s) => s.code));
    expect(codes).not.toContain('PRICE_LOWEST');
    expect(codes).not.toContain('PRICE_HIGHEST');
  });

  test('NOT_COMPARABLE interdit toute recommandation', async () => {
    const deps = fakeResolver([
      record(listing(A, { status: 'hebergement', accommodationType: 'hotel', surface: undefined, bedrooms: undefined, bathrooms: undefined }), { accommodation: { accommodationType: 'hotel' } }),
      record(listing(B, { status: 'vente', price: undefined, surface: undefined, bedrooms: undefined, bathrooms: undefined })),
    ]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking'] }), deps);
    expect(out.comparability.level).toBe('NOT_COMPARABLE');
    expect(out.conclusion.verdict).toBe('NOT_COMPARABLE');
    expect(out.conclusion.recommendedId).toBeNull();
  });

  test('budget mensuel contre hébergement nocturne : inconnu, jamais conforme', async () => {
    const deps = fakeResolver([
      record(listing(A, { status: 'hebergement', accommodationType: 'maison_meublee' }), { accommodation: { accommodationType: 'maison_meublee' }, rates: { nightly: { amount: 10000, currency: 'XAF' } } }),
      record(listing(B)),
    ]);
    const out = await compareRealEstate(selected([A, B], { criteria: rentCriteria() }), deps);
    const lodgingItem = out.items.find((i) => i.id === A);
    expect(lodgingItem.criteriaToVerify).toContain('budget.max');
    expect(lodgingItem.confirmedCriteria).not.toContain('budget.max');
    expect(lodgingItem.unmetCriteria).toContain('transaction');
  });
});

describe('IA-03C2 — avantages, inconvénients et inconnues', () => {
  test('avantage vérifié, inconvénient vérifié et critère inconnu', async () => {
    const deps = fakeResolver([
      record(listing(A, { amenities: ['parking'], price: 200000 })),
      record(listing(B, { bedrooms: 2, price: 300000, address: { city: 'Brazzaville', arrondissement: 'Bacongo' } })),
    ]);
    const out = await compareRealEstate(selected([A, B], { criteria: rentCriteria(), preferences: ['parking'] }), deps);
    const [a, b] = out.items;
    expect(a.advantages.map((x) => x.text)).toEqual(expect.arrayContaining([
      'Parking confirmé, conformément à votre préférence.',
      nb('Prix de 200 000 XAF par mois, dans votre budget maximum de 250 000 XAF par mois.'),
      '3 chambres, conformément à votre minimum de 3.',
    ]));
    expect(b.disadvantages.map((x) => x.text)).toEqual(expect.arrayContaining([
      nb('Prix de 300 000 XAF par mois, supérieur à votre budget maximum de 250 000 XAF par mois.'),
      '2 chambres, en dessous de votre minimum de 3.',
      'Situé à Bacongo, hors des arrondissements demandés.',
    ]));
    expect(b.unknowns.map((x) => x.text)).toContain("La présence d'un parking n'est pas renseignée.");
    expect(b.disadvantages.map((x) => x.text).join(' ')).not.toMatch(/parking/i);
  });

  test('équipement exclu présent = inconvénient vérifié', async () => {
    const criteria = rentCriteria(); criteria.amenities.excluded = ['pool'];
    const deps = fakeResolver([record(listing(A, { amenities: ['piscine'] })), record(listing(B))]);
    const out = await compareRealEstate(selected([A, B], { criteria }), deps);
    expect(out.items[0].disadvantages.map((x) => x.text)).toContain('Ce bien dispose d\'une piscine, que vous souhaitez éviter.');
    expect(out.items[1].unknowns.map((x) => x.text)).toContain("La présence d'une piscine n'est pas renseignée.");
  });

  test('préférence absente : aucun avantage inventé', async () => {
    const out = await compareRealEstate(selected([A, B]), fakeResolver([record(listing(A, { amenities: ['parking'] })), record(listing(B))]));
    expect(out.items.every((i) => i.advantages.length === 0 && i.disadvantages.length === 0)).toBe(true);
    expect(out.items[0].summary).toBe('Aucun critère exprimé : seules les caractéristiques publiées sont présentées.');
    expect(out.conclusion.verdict).toBe('NO_PREFERENCES');
  });

  test('plusieurs avantages, plusieurs inconvénients et aucun avantage démontrable', async () => {
    const deps = fakeResolver([
      record(listing(A, { amenities: ['parking', 'climatisation', 'jardin'] })),
      record(listing(B, { bedrooms: 1, price: 400000, address: { city: 'Brazzaville', arrondissement: 'Bacongo' }, type: 'Villa', amenities: [] })),
    ]);
    const criteria = rentCriteria();
    const out = await compareRealEstate(selected([A, B], { criteria, preferences: ['parking', 'climatisation', 'jardin'] }), deps);
    expect(out.items[0].advantages.length).toBeGreaterThanOrEqual(6);
    expect(out.items[1].disadvantages.length).toBeGreaterThanOrEqual(4);
    const none = await compareRealEstate(selected([A, B], { preferences: ['wifi'] }), fakeResolver([record(listing(A)), record(listing(B))]));
    expect(none.items[0].advantages).toEqual([]);
    expect(none.items[0].summary).toBe('Aucun avantage vérifiable au regard de vos critères.');
  });

  test('proximité et rayon : présents dans la grille, toujours non vérifiés', async () => {
    const criteria = rentCriteria(); criteria.proximity.preferred = [{ category: 'market', maxMeters: 1500 }];
    const out = await compareRealEstate(selected([A, B], { criteria }), fakeResolver([record(listing(A)), record(listing(B))]));
    const row = out.grid.rows.find((r) => r.key === 'unverifiable.proximity.market');
    expect(row.values.every((c) => c.state === 'UNKNOWN')).toBe(true);
    expect(out.items[0].unknowns.map((u) => u.text)).toContain("La proximité d'un marché n'est pas vérifiable : aucun catalogue de points d'intérêt validé.");
    // Aucune distance ni durée inventée pour le marché.
    expect(out.items[0].unknowns.find((u) => u.criterion === 'proximity.market').text).not.toMatch(/\d/);
    expect(row.values.map((c) => c.display)).toEqual(['Non vérifiable', 'Non vérifiable']);
  });
});

describe('IA-03C2 — compromis', () => {
  test('moins cher mais moins équipé / plus cher mais mieux équipé', async () => {
    const deps = fakeResolver([record(listing(A, { price: 180000 })), record(listing(B, { price: 240000, amenities: ['parking'] }))]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking'] }), deps);
    const a = out.tradeoffs.find((t) => t.id === A); const b = out.tradeoffs.find((t) => t.id === B);
    expect(a.strengths.map((s) => s.code)).toContain('PRICE_LOWEST');
    expect(a.toVerify.map((s) => s.criterion)).toContain('amenity.parking');
    expect(a.weaknesses.map((s) => s.criterion)).not.toContain('amenity.parking');
    expect(b.strengths.map((s) => s.criterion)).toContain('amenity.parking');
    expect(b.weaknesses.map((s) => s.code)).toContain('PRICE_HIGHEST');
    expect(a.text).toBe(nb('« Maison 1 » : prix le plus bas (180 000 XAF par mois), mais parking à vérifier.'));
    expect(b.text).toBe(nb('« Maison 2 » : parking confirmé, mais prix le plus élevé (240 000 XAF par mois).'));
    expect(out.hasTradeoffs).toBe(true);
  });

  test('plus grand mais plus coûteux : la taille est descriptive, jamais « meilleure »', async () => {
    const deps = fakeResolver([record(listing(A, { price: 300000, surface: 150 })), record(listing(B, { price: 200000, surface: 100 }))]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking'] }), deps);
    const a = out.tradeoffs.find((t) => t.id === A);
    expect(a.neutral.map((s) => s.code)).toContain('SURFACE_LARGEST');
    expect(a.strengths.map((s) => s.code)).not.toContain('SURFACE_LARGEST');
    expect(out.conclusion.recommendedId).not.toBe(A);
    expect(JSON.stringify(out.conclusion)).not.toMatch(/meilleur|supérieur/);
  });

  test('même prix et équipements différents', async () => {
    const deps = fakeResolver([record(listing(A, { amenities: ['parking'] })), record(listing(B, { amenities: ['jardin'] }))]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking', 'jardin'] }), deps);
    expect(out.tradeoffs.every((t) => !t.strengths.some((s) => s.code.startsWith('PRICE_')))).toBe(true);
    expect(out.hasTradeoffs).toBe(true);
    expect(out.conclusion.verdict).toBe('TIE');
    expect(out.conclusion.tiedIds).toEqual([A, B]);
  });

  test('données insuffisantes : aucun compromis inventé', async () => {
    const deps = fakeResolver([
      record(listing(A, { status: 'vente', price: undefined, surface: undefined })),
      record(listing(B, { price: undefined, surface: undefined })),
    ]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking'] }), deps);
    expect(out.hasTradeoffs).toBe(false);
    expect(out.tradeoffSummary).toBe("Les données vérifiées ne permettent pas d'identifier de compromis entre ces biens.");
  });
});

describe('IA-03C2 — score, confiance et conclusion', () => {
  test('gagnant justifié, robuste aux inconnues et cohérent avec IA-03C1', async () => {
    const deps = fakeResolver([
      record(listing(A, { amenities: ['parking', 'climatisation'] })),
      record(listing(B, { amenities: [] })),
      record(listing(C, { amenities: ['parking'] })),
    ]);
    // A : 2 confirmées ; B : 2 inconnues (meilleur cas 10000) — l'écart n'est pas robuste.
    const conditional = await compareRealEstate(selected([A, B, C], { preferences: ['parking', 'climatisation'] }), deps);
    expect(conditional.conclusion.verdict).toBe('CONDITIONAL_LEAD');
    expect(conditional.conclusion.leaderId).toBe(A);
    // B et C échouent sur une contrainte vérifiée (chambres, budget) : A est le seul bien admissible.
    const criteria = rentCriteria(); const strict = fakeResolver([
      record(listing(A, { amenities: ['parking', 'climatisation'] })),
      record(listing(B, { bedrooms: 1 })),
      record(listing(C, { amenities: ['parking'], price: 400000 })),
    ]);
    const out = await compareRealEstate(selected([A, B, C], { criteria, preferences: ['parking', 'climatisation'] }), strict);
    expect(out.conclusion.verdict).toBe('RECOMMENDED');
    expect(out.conclusion.recommendedId).toBe(A);
    expect(out.conclusion.text).toMatch(/^Parmi les 3 biens comparés, « Maison 1 » correspond le mieux aux préférences vérifiables que vous avez exprimées\./);
    const ranking = rankRealEstateResults({ searchResult: { status: 'success', results: [listing(A, { amenities: ['parking', 'climatisation'] }), listing(B, { bedrooms: 1 }), listing(C, { amenities: ['parking'], price: 400000 })], candidatesToVerify: [] }, preferences: ['parking', 'climatisation'] });
    const byId = Object.fromEntries(ranking.rankedResults.map((r) => [r.listing.id, r]));
    for (const it of out.items) {
      expect(it.score).toBe(byId[it.id].score);
      expect(it.confidence).toBe(byId[it.id].confidence);
      expect(it.scoreSource).toBe('IA-03C1');
    }
  });

  test('score élevé avec faible confiance dépasse un bien mieux documenté : jamais certain', async () => {
    // A : parking TRUE, prix cible TRUE, 3 inconnues → 7000 / confiance 4000.
    // B : parking et clim TRUE, prix cible FALSE, 2 inconnues → 6000 / confiance 6000.
    const preferences = ['parking', 'climatisation', 'wifi', 'piscine', { kind: 'PRICE_TARGET', target: 210000, currency: 'XAF', period: 'MONTH', weight: 100 }];
    const deps = fakeResolver([
      record(listing(A, { amenities: ['parking'], price: 210000 })),
      record(listing(B, { amenities: ['parking', 'climatisation'], price: 999999 })),
    ]);
    const out = await compareRealEstate(selected([A, B], { preferences }), deps);
    const a = out.items.find((i) => i.id === A); const b = out.items.find((i) => i.id === B);
    expect([a.score, a.confidence, b.score, b.confidence]).toEqual([7000, 4000, 6000, 6000]);
    expect(a.confidenceLevel).toBe('LOW');
    expect(b.confidenceLevel).toBe('MEDIUM');
    expect(a.criteriaToVerify).toEqual(['amenity.air_conditioning', 'amenity.wifi', 'amenity.pool']);
    expect(a.confirmedCriteria).toEqual(['amenity.parking', 'price_target']);
    expect(b.unmetCriteria).toEqual(['price_target']);
    expect(out.conclusion).toMatchObject({ verdict: 'CONDITIONAL_LEAD', leaderId: A, recommendedId: null });
    expect(out.conclusion.text).toMatch(/n'est pas une recommandation certaine/);
    expect(out.scoreNote).toBe("Le score mesure la correspondance aux préférences exprimées ; ce n'est pas une probabilité de satisfaction.");
  });

  test('aucun signal fiable : conclusion d’insuffisance explicite', async () => {
    const out = await compareRealEstate(selected([A, B], { preferences: ['wifi'] }), fakeResolver([record(listing(A)), record(listing(B))]));
    expect(out.conclusion.verdict).toBe('INSUFFICIENT_DATA');
    expect(out.conclusion.text).toBe('Les informations disponibles ne permettent pas de déterminer de manière fiable laquelle de ces annonces répond le mieux à vos préférences.');
  });

  test('aucun bien admissible ou seul bien admissible', async () => {
    const criteria = rentCriteria();
    const none = await compareRealEstate(selected([A, B], { criteria, preferences: ['parking'] }), fakeResolver([record(listing(A, { bedrooms: 1 })), record(listing(B, { price: 900000 }))]));
    expect(none.conclusion.verdict).toBe('NO_ELIGIBLE');
    const only = await compareRealEstate(selected([A, B], { criteria }), fakeResolver([record(listing(A)), record(listing(B, { price: 900000 }))]));
    expect(only.conclusion).toMatchObject({ verdict: 'RECOMMENDED', recommendedId: A, basis: 'CONSTRAINTS' });
  });
});

describe('IA-03C2 — mode A : résultats classés IA-03B/IA-03C1', () => {
  const ranked = (listings, verify = [], extra = {}) => rankRealEstateResults({
    searchResult: {
      status: 'success', intent: 'RENT', interpretedCriteria: rentCriteria(), preferences: ['parking'],
      results: listings, candidatesToVerify: verify.map((l) => ({ listing: l, unknownCriteria: [{ field: 'amenities.required.parking', state: 'UNKNOWN' }] })),
      coverage: { evaluated: 250, sourceTotal: 900, complete: false, limit: 250 }, warnings: [], ...extra,
    },
  });

  test('compare les N premiers dans l’ordre IA-03C1 et conserve la couverture', async () => {
    const ls = [listing(A), listing(B, { amenities: ['parking'] }), listing(C), listing(D)];
    const deps = fakeResolver(ls.map((l) => record(l)));
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: ranked(ls), count: 3, context: { scopeMode: 'TENANT' } }, deps);
    expect(out.status).toBe('success');
    expect(out.comparedIds).toEqual([B, A, C]);
    expect(out.items.map((i) => i.sourcePosition)).toEqual([1, 2, 3]);
    expect(out.coverage).toMatchObject({ complete: false, limit: 250, evaluated: 250, sourceTotal: 900 });
    expect(out.warnings.map((w) => w.code)).toContain('CATALOG_COVERAGE_LIMITED');
    expect(out.conclusion.text).toMatch(/parmi les candidats évalués/);
    expect(out.conclusion.text).not.toMatch(/de tout Altimmo/);
  });

  test('les candidats à vérifier complètent la sélection après les correspondances exactes', async () => {
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: ranked([listing(A)], [listing(B, { amenities: [] })]), count: 3, context: { scopeMode: 'PUBLIC' } }, fakeResolver([record(listing(A)), record(listing(B))]));
    expect(out.items.map((i) => i.matchStatus)).toEqual(['MATCH', 'TO_VERIFY']);
  });

  test('dépassement du nombre demandé : borné avec avertissement', async () => {
    const ls = [A, B, C, D, E, F].map((id) => listing(id));
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: ranked(ls), count: 9, context: { scopeMode: 'PUBLIC' } }, fakeResolver(ls.map((l) => record(l))));
    expect(out.items).toHaveLength(5);
    expect(out.warnings.map((w) => w.code)).toContain('COMPARISON_LIMIT_APPLIED');
  });

  test('un bien devenu indisponible entre recherche et comparaison est écarté', async () => {
    const ls = [listing(A), listing(B), listing(C)];
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: ranked(ls), count: 3, context: { scopeMode: 'PUBLIC' } }, fakeResolver([record(ls[0]), record(ls[2])]));
    expect(out.comparedIds).toEqual([A, C]);
    expect(out.warnings.map((w) => w.code)).toContain('LISTING_NO_LONGER_AVAILABLE');
  });

  test('scores forgés dans le classement : recalculés par IA-03C1', async () => {
    const r = ranked([listing(A), listing(B)]);
    r.rankedResults[0].score = 10000; r.rankedResults[0].confidence = 10000;
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: r, count: 2, context: { scopeMode: 'PUBLIC' } }, fakeResolver([record(listing(A)), record(listing(B))]));
    expect(out.items.every((i) => i.score === 5000 && i.confidence === 0)).toBe(true);
    expect(out.warnings.map((w) => w.code)).toContain('RANKING_RECOMPUTED');
  });

  test('un classement non réussi n’est jamais comparé', async () => {
    const deps = fakeResolver([]);
    const out = await compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult: { status: 'needs_clarification', rankingStatus: 'not_ranked', clarificationQuestions: ['Achat ou location ?'] }, context: { scopeMode: 'PUBLIC' } }, deps);
    expect(out.status).toBe('not_compared');
    expect(out.clarificationQuestions).toEqual(['Achat ou location ?']);
    expect(deps.resolvePublicListings).not.toHaveBeenCalled();
  });
});

describe('IA-03C2 — comparaison manuelle sécurisée', () => {
  test('identifiants inaccessibles : réponse uniforme sans révéler l’existence', async () => {
    // B : privé / dépublié / supprimé / autre tenant non public — le résolveur ne le renvoie pas.
    const out = await compareRealEstate(selected([A, B, C]), fakeResolver([record(listing(A)), record(listing(C))]));
    expect(out.status).toBe('success');
    expect(out.unavailable).toEqual([{ id: B, code: 'LISTING_UNAVAILABLE' }]);
    const allMissing = await compareRealEstate(selected([D, E]), fakeResolver([]));
    expect(allMissing.status).toBe('insufficient');
    expect(allMissing.unavailable.map((u) => u.code)).toEqual(['LISTING_UNAVAILABLE', 'LISTING_UNAVAILABLE']);
    expect(JSON.stringify(allMissing)).not.toMatch(/priv|supprim|tenant|non publi/i);
  });

  test('défense en profondeur : un résolveur fautif ne fait pas passer une annonce non publique', async () => {
    const leaky = fakeResolver([
      record(listing(A)), record(listing(B, { isPublished: false })), record(listing(C, { statusAdmin: 'En attente' })), record(listing(D, { availability: 'Loué' })),
      record(listing(E, { pole: 'Altcom' })),
    ]);
    const out = await compareRealEstate(selected([A, B, C, D, E]), leaky);
    expect(out.comparedIds).toEqual([A]);
    expect(out.status).toBe('insufficient');
    expect(out.unavailable.map((u) => u.id)).toEqual([B, C, D, E]);
  });

  test('identifiants dupliqués et malformés', async () => {
    const deps = fakeResolver([record(listing(A)), record(listing(B))]);
    const dup = await compareRealEstate(selected([A, A, B]), deps);
    expect(dup.comparedIds).toEqual([A, B]);
    expect(dup.warnings.map((w) => w.code)).toContain('DUPLICATE_LISTING_ID');
    for (const bad of [{ $ne: null }, '1; drop', `${A}x`, '<script>', 42, null]) {
      const out = await compareRealEstate(selected([A, bad]), deps);
      expect(out.status).toBe('invalid');
      expect(out.errors).toEqual([{ code: 'INVALID_LISTING_ID', index: 1 }]);
      expect(JSON.stringify(out)).not.toContain('drop');
    }
  });

  test('la sélection manuelle ne dépend pas de la fenêtre des 250 candidats', async () => {
    const deps = fakeResolver([record(listing(A)), record(listing(B))]);
    const out = await compareRealEstate(selected([A, B]), deps);
    expect(deps.calls).toEqual([[A, B]]);
    expect(out.coverage).toMatchObject({ mode: 'INDIVIDUAL_RESOLUTION', windowDependent: false });
  });

  test('objets Property envoyés par le client ignorés', async () => {
    const deps = fakeResolver([record(listing(A)), record(listing(B))]);
    const out = await compareRealEstate(selected([A, B], { listings: [listing(A, { price: 1, amenities: ['parking'] })], properties: [listing(B)] }), deps);
    expect(out.items[0].price.amount).toBe(200000);
  });
});

describe('IA-03C2 — sécurité multi-tenant et confidentialité', () => {
  test('UNRESOLVED et scope inconnu : fail-closed sans lecture', async () => {
    for (const scopeMode of ['UNRESOLVED', 'ROOT', undefined, null]) {
      const deps = fakeResolver([record(listing(A)), record(listing(B))]);
      const out = await compareRealEstate(selected([A, B], { context: { scopeMode } }), deps);
      expect(out.status).toBe('forbidden');
      expect(deps.resolvePublicListings).not.toHaveBeenCalled();
    }
  });

  test('PUBLIC, TENANT et PLATFORM appliquent la même visibilité marketplace', async () => {
    const outs = [];
    for (const scopeMode of ['PUBLIC', 'TENANT', 'PLATFORM']) {
      const deps = fakeResolver([record(listing(A)), record(listing(B))]);
      const out = await compareRealEstate(selected([A, B], { context: { scopeMode, tenantId: 'forged', platform: true } }), deps);
      outs.push(out.comparedIds);
      expect(deps.calls).toEqual([[A, B]]);
    }
    expect(outs).toEqual([[A, B], [A, B], [A, B]]);
  });

  test('aucune donnée privée, même imbriquée, dans le résultat ou les explications', async () => {
    const secret = {
      tenant: 'TENANT_SECRET', owner: { name: 'OWNER_SECRET', phone: '+242000' }, commissionRate: 17, mandate: 'MANDAT_SECRET',
      documents: ['https://x.test/kyc.pdf'], bankAccount: 'IBAN_SECRET', kyc: { status: 'KYC_SECRET' }, internalNotes: 'NOTE_SECRET',
      latitude: -4.2, longitude: 15.3, address: { street: 'RUE_SECRETE', city: 'Brazzaville', arrondissement: 'Talangaï' },
    };
    const deps = fakeResolver([
      record(listing(A, secret), { accommodation: { accommodationType: 'hotel', ownerNotes: 'ACC_SECRET', payoutAccount: 'IBAN2' }, rates: { nightly: { amount: 1, currency: 'XAF', internal: 'RATE_SECRET' } } }),
      record(listing(B, secret)),
    ]);
    const out = await compareRealEstate(selected([A, B], { preferences: ['parking'] }), deps);
    const json = JSON.stringify(out);
    for (const s of ['TENANT_SECRET', 'OWNER_SECRET', '+242000', 'MANDAT_SECRET', 'kyc.pdf', 'IBAN', 'KYC_SECRET', 'NOTE_SECRET', 'RUE_SECRETE', 'ACC_SECRET', 'RATE_SECRET', 'commissionRate', 'latitude']) {
      expect(json).not.toContain(s);
    }
  });

  test('injections dans critères et préférences : écartées', async () => {
    const deps = fakeResolver([record(listing(A)), record(listing(B))]);
    const criteria = { ...rentCriteria(), budget: { max: { $gt: 0 }, currency: 'XAF', period: 'MONTH' }, location: { city: { $regex: '.*' }, districts: ['Talangaï', { $ne: 1 }] }, $where: 'sleep(1)' };
    const out = await compareRealEstate(selected([A, B], { criteria, preferences: [{ kind: 'AMENITY', key: '$where' }, 'parking', { kind: 'SCRIPT', key: 'x' }] }), deps);
    expect(out.status).toBe('success');
    expect(out.criteriaUsed.preferences.map((p) => p.key)).toEqual(['parking']);
    expect(JSON.stringify(out)).not.toMatch(/\$where|\$gt|\$regex|\$ne/);
  });

  test('erreur de source : message générique, aucun détail interne', async () => {
    const deps = { resolvePublicListings: jest.fn(async () => { throw new Error('MongoServerError: mongodb://admin:pwd@10.0.0.1 tenant=SECRET'); }) };
    const out = await compareRealEstate(selected([A, B]), deps);
    expect(out.status).toBe('error');
    expect(out.errors).toEqual([{ code: 'COMPARISON_SOURCE_UNAVAILABLE' }]);
    expect(JSON.stringify(out)).not.toMatch(/mongodb|pwd|SECRET|10\.0/);
  });

  test('mode inconnu refusé', async () => {
    const out = await compareRealEstate({ mode: 'ALL', context: { scopeMode: 'PUBLIC' } }, fakeResolver([]));
    expect(out.status).toBe('invalid');
    expect(out.errors).toEqual([{ code: 'INVALID_COMPARISON_MODE' }]);
  });
});

describe('IA-03C2 — composition IA-03A → IA-03B → IA-03C1 → IA-03C2', () => {
  test('« Compare les trois meilleures propositions » : 3 candidats classés', async () => {
    expect(requestedComparisonCount('Compare les trois meilleures propositions.')).toBe(3);
    expect(requestedComparisonCount('compare les 2 meilleurs biens')).toBe(2);
    expect(requestedComparisonCount('maison à louer')).toBeNull();
    const ls = [listing(A, { amenities: ['parking', 'climatisation'] }), listing(B, { amenities: ['parking'] }), listing(C), listing(D)];
    const searchProperties = jest.fn(async () => ({ properties: ls, total: ls.length }));
    const deps = { searchDependencies: { searchProperties, searchAccommodations: jest.fn() }, ...fakeResolver(ls.map((l) => record(l))) };
    const out = await searchRankAndCompareFromText({
      query: 'Je cherche une maison à louer de trois chambres à Talangaï, avec un budget maximum de 250 000 FCFA par mois, de préférence avec parking. Compare les trois meilleures propositions.',
      context: { scopeMode: 'PUBLIC' },
    }, deps);
    expect(out.status).toBe('success');
    expect(out.items).toHaveLength(3);
    expect(out.comparedIds[0]).toBe(A);
  });

  test('demande ambiguë (sans transaction) : clarification, aucune comparaison inventée', async () => {
    const deps = { searchDependencies: { searchProperties: jest.fn(), searchAccommodations: jest.fn() }, ...fakeResolver([]) };
    const out = await searchRankAndCompareFromText({
      query: 'Je cherche une maison de trois chambres à Talangaï, avec un budget maximum de 250 000 FCFA. Je préfère un parking et la climatisation. Compare les trois meilleures propositions.',
      context: { scopeMode: 'PUBLIC' },
    }, deps);
    expect(out.status).toBe('not_compared');
    expect(out.clarificationQuestions.length).toBeGreaterThan(0);
    expect(deps.searchDependencies.searchProperties).not.toHaveBeenCalled();
    expect(deps.resolvePublicListings).not.toHaveBeenCalled();
  });
});
