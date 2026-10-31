const { searchAndRankRealEstateFromText } = require('../services/altimmoAssistant/personalizedSearchService');
const { searchRealEstateCandidatesFromText, resolveCandidateConfig, collectCandidates } = require('../services/altimmoAssistant/intelligentSearchService');
const { rankRealEstateResults } = require('../services/altimmoAssistant/rankingService');
const { searchRankAndCompareFromText, compareRealEstate, COMPARISON_MODE } = require('../services/altimmoAssistant/comparisonService');

const hex = (n) => n.toString(16).padStart(24, '0');
const PREFS = 'Je cherche une maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère un parking, un jardin et la climatisation.';
const NO_PREFS = 'Je cherche une maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois.';
const day = (n) => new Date(Date.UTC(2026, 9, 1) - n * 3600000).toISOString();
// n = 1 est la plus récente ; plus n est grand, plus l'annonce est ancienne.
const listing = (n, extra = {}) => ({
  _id: hex(n), id: hex(n), title: `Maison ${n}`, status: 'location', type: 'Maison', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Talangaï' }, bedrooms: 3, bathrooms: 1, surface: 100,
  amenities: n % 3 === 0 ? ['parking'] : [], createdAt: day(n),
  isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', pole: 'Altimmo', ...extra,
});
const catalog = (count, patch = () => ({})) => Array.from({ length: count }, (_, i) => listing(i + 1, patch(i + 1)));
const BEST = 25; // page 3 dans l'ordre chronologique (positions 21–30)
const withBest = () => catalog(30, (n) => (n === BEST ? { amenities: ['parking', 'jardin', 'climatisation'] } : {}));

/** Source interne par lots : curseur = index, total exact au premier lot. */
function scanSource(items, { batchSize, onBatch } = {}) {
  const calls = [];
  const scanCandidates = jest.fn(async (request, { cursor: rawCursor = null, batchSize: size = 50 } = {}) => {
    const cursor = rawCursor || 0; // premier lot : curseur null
    calls.push({ request, cursor, size });
    const effective = batchSize || size;
    const batch = items.slice(cursor, cursor + effective);
    if (onBatch) await onBatch(calls.length, items);
    const next = cursor + effective < items.length ? cursor + effective : null;
    return { items: batch, nextCursor: next, ...(cursor === 0 ? { total: items.length } : {}) };
  });
  return { scanCandidates, calls };
}
const deps = (items, options) => ({ searchDependencies: scanSource(items, options) });
const rank = (query, items, extra = {}, dependencies = deps(items)) => searchAndRankRealEstateFromText({ query, context: { scopeMode: 'PUBLIC' }, ...extra }, dependencies);
const ids = (items) => items.map((item) => item.listing.id);

describe('IA-03C3 — défaut principal : classement avant pagination', () => {
  test('le meilleur bien, situé en page 3 chronologique, devient premier', async () => {
    const out = await rank(PREFS, withBest(), { pagination: { page: 1, limit: 10 } });
    expect(out.rankingStatus).toBe('ranked');
    expect(out.rankedResults[0].listing.id).toBe(hex(BEST));
    expect(out.rankedResults[0]).toMatchObject({ position: 1, score: 10000, confidence: 10000 });
    expect(out.rankingOrder).toBe('RELEVANCE');
  });

  test('les pages prolongent un classement global unique, sans doublon', async () => {
    const items = withBest();
    const pages = [];
    for (const page of [1, 2, 3]) pages.push(await rank(PREFS, items, { pagination: { page, limit: 10 } }));
    const all = pages.flatMap((p) => p.rankedResults);
    expect(all).toHaveLength(30);
    expect(new Set(ids(all)).size).toBe(30);
    expect(all.map((item) => item.position)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    const global = rankRealEstateResults({ searchResult: { status: 'success', preferences: ['parking', 'garden', 'air_conditioning'], results: items, candidatesToVerify: [] } });
    expect(ids(all)).toEqual(ids(global.rankedResults));
    expect(all.map((item) => item.score)).toEqual(global.rankedResults.map((item) => item.score));
    expect(pages[0].pagination).toEqual({ page: 1, limit: 10, pages: 3 });
    expect(pages[2].rankedResults.at(-1).position).toBe(30);
  });

  test('page hors limites vide et tailles de page différentes cohérentes', async () => {
    const items = withBest();
    const empty = await rank(PREFS, items, { pagination: { page: 4, limit: 10 } });
    expect(empty.rankedResults).toEqual([]);
    expect(empty.pagination).toEqual({ page: 4, limit: 10, pages: 3 });
    const seven = [];
    for (const page of [1, 2, 3, 4, 5]) seven.push(...(await rank(PREFS, items, { pagination: { page, limit: 7 } })).rankedResults);
    const ten = [];
    for (const page of [1, 2, 3]) ten.push(...(await rank(PREFS, items, { pagination: { page, limit: 10 } })).rankedResults);
    expect(ids(seven)).toEqual(ids(ten));
  });

  test('correspondances exactes et candidats à vérifier restent séparés', async () => {
    const query = 'Maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois, parking obligatoire. Je préfère un jardin.';
    const items = [
      listing(1, { amenities: ['parking'] }),
      listing(2, { amenities: ['jardin'] }), // parking inconnu : à vérifier, mais meilleur score de préférence
      listing(3, { amenities: ['parking', 'jardin'] }),
    ];
    const out = await rank(query, items);
    expect(ids(out.rankedResults)).toEqual([hex(3), hex(1)]);
    expect(ids(out.rankedCandidatesToVerify)).toEqual([hex(2)]);
    expect(out.rankedCandidatesToVerify[0].unknownCriteria).toEqual([{ field: 'amenities.required.parking', state: 'UNKNOWN' }]);
    expect(out.total).toBe(2);
    expect(out.verificationTotal).toBe(1);
  });
});

describe('IA-03C3 — politique sans préférence', () => {
  test('aucune préférence : ordre chronologique déterministe, identifiant en départage', async () => {
    const items = catalog(12);
    items[4] = { ...items[4], createdAt: items[5].createdAt }; // dates identiques : départage par identifiant
    const out = await rank(NO_PREFS, [...items].reverse(), { pagination: { page: 1, limit: 50 } });
    expect(out.rankingOrder).toBe('CHRONOLOGICAL');
    expect(ids(out.rankedResults)).toEqual(items.map((item) => item.id));
    expect(out.rankedResults.every((item) => item.score === 0 && item.confidence === 0)).toBe(true);
  });

  test('préférences toutes inconnues : repli chronologique signalé, pas de recommandation certaine', async () => {
    const out = await rank('Maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère le wifi.', catalog(12).reverse(), { pagination: { page: 1, limit: 50 } });
    expect(out.rankingOrder).toBe('CHRONOLOGICAL_FALLBACK');
    expect(ids(out.rankedResults)).toEqual(catalog(12).map((item) => item.id));
    expect(out.rankingWarnings.map((w) => w.code)).toContain('RANKING_NOT_DISCRIMINANT');
  });

  test('préférence exploitable : la récence ne domine pas la pertinence', async () => {
    const items = catalog(20, (n) => (n === 20 ? { amenities: ['jardin'] } : { amenities: [] }));
    const out = await rank('Maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère un jardin.', items);
    expect(out.rankingOrder).toBe('RELEVANCE');
    expect(out.rankedResults[0].listing.id).toBe(hex(20));
  });
});

describe('IA-03C3 — plafond et couverture', () => {
  test('plafond 1 000 par défaut, configurable côté serveur, borné', () => {
    expect(resolveCandidateConfig()).toEqual({ maxCandidates: 1000, batchSize: 100, maxScanned: 2000 });
    expect(resolveCandidateConfig({ maxCandidates: 300, batchSize: 20 })).toEqual({ maxCandidates: 300, batchSize: 20, maxScanned: 600 });
    expect(resolveCandidateConfig({ maxCandidates: 1e9, batchSize: 1e9 })).toEqual({ maxCandidates: 1000, batchSize: 250, maxScanned: 2000 });
    expect(resolveCandidateConfig({ maxCandidates: 'tout', batchSize: -4 })).toEqual({ maxCandidates: 1000, batchSize: 100, maxScanned: 2000 });
  });

  test.each([
    [10, 10, true], [50, 50, true], [250, 250, true], [300, 300, true], [500, 500, true],
    [1000, 1000, true], [1001, 1000, false], [1500, 1000, false],
  ])('catalogue de %i annonces : %i classées, couverture complète = %s', async (size, ranked, complete) => {
    const out = await rank(PREFS, catalog(size), { pagination: { page: 1, limit: 5 } });
    expect(out.coverage).toMatchObject({ evaluated: ranked, scanned: ranked, mongoMatchedTotal: size, complete, admissibleTotalExact: complete, limit: 1000 });
    expect(out.rankingCoverage).toMatchObject({ ranked, complete, limit: 1000 });
    expect(out.total).toBe(ranked);
    if (!complete) expect(out.warnings.map((w) => w.code)).toContain('CATALOG_COVERAGE_LIMITED');
  });

  test('total Mongo exact distinct du total admissible : 5 000 potentiels, 1 000 évalués', async () => {
    const items = catalog(5000, (n) => (n % 2 ? { bedrooms: 1 } : {})); // la moitié échoue en mémoire
    const out = await rank(PREFS, items, { pagination: { page: 1, limit: 5 } });
    expect(out.coverage).toMatchObject({ mongoMatchedTotal: 5000, mongoTotalExact: true, evaluated: 1000, admissible: 500, complete: false, admissibleTotalExact: false });
    expect(out.total).toBe(500);
  });

  test('lecture bornée : une source qui ne s’épuise pas s’arrête au plafond de documents parcourus', async () => {
    const same = catalog(50);
    const scanCandidates = jest.fn(async (request, { cursor = 0 } = {}) => ({ items: same, nextCursor: cursor + 1, total: 999999 }));
    const out = await rank(PREFS, [], {}, { searchDependencies: { scanCandidates } });
    expect(scanCandidates.mock.calls.length).toBeLessThanOrEqual(41);
    expect(out.coverage).toMatchObject({ evaluated: 50, complete: false });
    expect(out.coverage.scanned).toBeLessThanOrEqual(2000);
    expect(out.warnings.map((w) => w.code)).toContain('SCAN_LIMIT_REACHED');
  });

  test('le client ne peut pas élargir le plafond ni la taille de page', async () => {
    const source = scanSource(catalog(1200));
    const out = await searchAndRankRealEstateFromText({
      query: PREFS, context: { scopeMode: 'PUBLIC', maxCandidates: 1e6 }, maxCandidates: 1e6, pagination: { page: 1, limit: 100000 },
    }, { searchDependencies: source });
    expect(out.coverage.evaluated).toBe(1000);
    expect(out.rankedResults).toHaveLength(50);
    expect(Math.max(...source.calls.map((c) => c.size))).toBeLessThanOrEqual(250);
  });

  test('la configuration serveur réduit le plafond', async () => {
    const out = await rank(PREFS, catalog(400), {}, { ...deps(catalog(400)), config: { maxCandidates: 300 } });
    expect(out.coverage).toMatchObject({ evaluated: 300, limit: 300, complete: false });
  });
});

describe('IA-03C3 — contrat interne et sécurité', () => {
  test('contrat interne : candidats complets non paginés, projetés, avec couverture', async () => {
    const out = await searchRealEstateCandidatesFromText({ query: PREFS, context: { scopeMode: 'PUBLIC' } }, scanSource(withBest()));
    expect(out.status).toBe('success');
    expect(out.matches).toHaveLength(30);
    expect(out.candidatesToVerify).toEqual([]);
    expect(out.matches[0].id).toBe(hex(1)); // ordre chronologique conservé au niveau interne
    expect(out.matches[0]).not.toHaveProperty('owner');
    expect(out.preferences).toEqual(['parking', 'garden', 'air_conditioning']);
    expect(out).not.toHaveProperty('results');
  });

  test('UNRESOLVED : aucun appel de source ; scopes résolus identiques', async () => {
    const source = scanSource(withBest());
    const out = await searchAndRankRealEstateFromText({ query: PREFS, context: { scopeMode: 'UNRESOLVED' } }, { searchDependencies: source });
    expect(out.rankingStatus).toBe('not_ranked');
    expect(source.scanCandidates).not.toHaveBeenCalled();
    const results = [];
    for (const scopeMode of ['PUBLIC', 'TENANT', 'PLATFORM']) results.push(ids((await searchAndRankRealEstateFromText({ query: PREFS, context: { scopeMode, tenantId: 'forgé' } }, deps(withBest()))).rankedResults));
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  test('défense en profondeur et champs privés : une source fautive ne fait rien passer', async () => {
    const items = [
      listing(1, { owner: 'OWNER_SECRET', tenant: 'TENANT_SECRET', commissionRate: 9, latitude: 1 }),
      listing(2, { isPublished: false }), listing(3, { statusAdmin: 'En attente' }), listing(4, { availability: 'Loué' }),
    ];
    const out = await rank(PREFS, items);
    expect(ids(out.rankedResults)).toEqual([hex(1)]);
    expect(JSON.stringify(out)).not.toMatch(/OWNER_SECRET|TENANT_SECRET|commissionRate|latitude/);
  });

  test('doublons d’une source : une seule occurrence classée', async () => {
    const items = [...catalog(10), ...catalog(10)];
    const out = await rank(PREFS, items, { pagination: { page: 1, limit: 50 } });
    expect(out.rankedResults).toHaveLength(10);
    expect(out.coverage).toMatchObject({ evaluated: 10, scanned: 20 });
  });

  test('compatibilité : collectCandidates conserve sa signature historique', async () => {
    const searchProperties = jest.fn(async () => ({ properties: catalog(3), total: 3 }));
    const out = await collectCandidates([{ offerType: 'location' }], { searchProperties, searchAccommodations: jest.fn() });
    expect(out.candidates).toHaveLength(3);
    expect(out.sourceTotal).toBe(3);
  });
});

describe('IA-03C3 — intégration IA-03C2', () => {
  const resolver = (items) => ({
    resolvePublicListings: async (requested) => items.filter((l) => requested.includes(l.id)).map((l) => ({ id: l.id, listing: l, accommodation: null, rates: {} })),
  });

  test('comparaison automatique : le meilleur bien d’une ancienne page est comparé en premier', async () => {
    const items = withBest();
    const out = await searchRankAndCompareFromText({ query: `${PREFS} Compare les trois meilleures propositions.`, context: { scopeMode: 'PUBLIC' } }, {
      searchDependencies: scanSource(items), ...resolver(items),
    });
    expect(out.status).toBe('success');
    expect(out.comparedIds).toHaveLength(3);
    expect(out.comparedIds[0]).toBe(hex(BEST));
    expect(out.items[0]).toMatchObject({ score: 10000, confidence: 10000, sourcePosition: 1 });
  });

  test('couverture partielle conservée jusqu’à la conclusion', async () => {
    const items = catalog(1200, (n) => (n === 1100 ? { amenities: ['parking', 'jardin', 'climatisation'] } : {}));
    const out = await searchRankAndCompareFromText({ query: PREFS, context: { scopeMode: 'PUBLIC' } }, { searchDependencies: scanSource(items), ...resolver(items) });
    expect(out.coverage).toMatchObject({ complete: false, limit: 1000, evaluated: 1000 });
    expect(out.comparedIds).not.toContain(hex(1100)); // hors des 1 000 évalués : jamais présenté comme le meilleur de tout le catalogue
    expect(out.conclusion.text).toMatch(/parmi les candidats évalués/);
  });

  test('comparaison manuelle inchangée : indépendante du plafond', async () => {
    const items = catalog(2);
    const out = await compareRealEstate({ mode: COMPARISON_MODE.SELECTED, propertyIds: [hex(1), hex(2)], context: { scopeMode: 'PUBLIC' } }, resolver(items));
    expect(out.coverage).toMatchObject({ mode: 'INDIVIDUAL_RESOLUTION', windowDependent: false });
  });
});
