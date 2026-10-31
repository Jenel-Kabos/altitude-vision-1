const { validateAssistantOutput, CONTRACT_VERSION } = require('../services/altimmoAssistant/assistantContract');
const gateway = require('../services/altimmoAssistant/assistantGateway');
const { searchAndRankRealEstateFromText } = require('../services/altimmoAssistant/personalizedSearchService');
const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');
const { evaluateRankingCandidate, normalizeRankingPreferences } = require('../services/altimmoAssistant/rankingPolicy');
const { COMPARISON_MODE } = require('../services/altimmoAssistant/comparisonService');

const hex = (n) => n.toString(16).padStart(24, '0');
const day = (n) => new Date(Date.UTC(2026, 9, 1) - n * 3600000).toISOString();
const listing = (n, extra = {}) => ({
  _id: hex(n), id: hex(n), title: `Maison ${n}`, description: 'Annonce publique.', status: 'location', type: 'Maison', price: 200000,
  address: { city: 'Brazzaville', arrondissement: 'Talangaï', neighborhood: 'Plateau' }, bedrooms: 3, bathrooms: 1, surface: 100,
  amenities: [], images: ['https://example.test/a.jpg'], createdAt: day(n), reviews: [{ rating: 4, comment: 'Bien', createdAt: day(1) }],
  isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', pole: 'Altimmo', ...extra,
});
const catalog = (count, patch = () => ({})) => Array.from({ length: count }, (_, i) => listing(i + 1, patch(i + 1)));
function scanSource(getItems) {
  return {
    scanCandidates: jest.fn(async (request, { cursor = null, batchSize = 100 } = {}) => {
      const items = getItems(); const start = cursor || 0;
      return { items: items.slice(start, start + batchSize), nextCursor: start + batchSize < items.length ? start + batchSize : null, ...(start === 0 ? { total: items.length } : {}) };
    }),
  };
}
const PREFS = 'Je cherche une maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère un parking, un jardin et la climatisation.';
const ctx = { scopeMode: 'PUBLIC' };
const resolver = (items) => ({
  resolvePublicListings: async (ids) => items.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, listing: l, accommodation: null, rates: {} })),
});

describe('IA-03C4 — schéma versionné et garde de sortie', () => {
  test('les sorties réelles des trois niveaux respectent le contrat', async () => {
    const items = catalog(15, (n) => ({ amenities: n % 2 ? ['parking'] : ['jardin', 'climatisation'] }));
    const search = await gateway.searchRealEstate({ query: PREFS, context: ctx }, scanSource(() => items));
    const ranked = await gateway.searchAndRankRealEstate({ query: PREFS, context: ctx }, { searchDependencies: scanSource(() => items) });
    const compared = await gateway.searchRankAndCompare({ query: PREFS, context: ctx }, { searchDependencies: scanSource(() => items), ...resolver(items) });
    const manual = await gateway.compareRealEstate({ mode: COMPARISON_MODE.SELECTED, propertyIds: [hex(1), hex(2)], context: ctx }, resolver(items));
    for (const [kind, out] of [['search', search], ['ranking', ranked], ['comparison', compared], ['comparison', manual]]) {
      expect(validateAssistantOutput(kind, out)).toEqual({ valid: true, violations: [] });
      expect(out.status).toBe('success');
      expect(out.contractVersion).toBe(CONTRACT_VERSION);
    }
  });

  test('les sorties d’échec (forbidden, needs_clarification, invalid) respectent aussi le contrat', async () => {
    const forbidden = await gateway.searchAndRankRealEstate({ query: PREFS, context: { scopeMode: 'UNRESOLVED' } }, { searchDependencies: scanSource(() => []) });
    const unclear = await gateway.searchRealEstate({ query: 'je cherche un logement sympa', context: ctx }, scanSource(() => []));
    const invalid = await gateway.compareRealEstate({ mode: COMPARISON_MODE.SELECTED, propertyIds: ['x'], context: ctx }, resolver([]));
    expect(validateAssistantOutput('ranking', forbidden).valid).toBe(true);
    expect(validateAssistantOutput('search', unclear).valid).toBe(true);
    expect(validateAssistantOutput('comparison', invalid).valid).toBe(true);
  });

  test.each([
    ['profondeur 1 : annonce', (out) => { out.results[0].owner = { name: 'OWNER_SECRET' }; }, 'search'],
    ['profondeur 2 : adresse', (out) => { out.results[0].address.street = 'RUE_SECRETE'; }, 'search'],
    ['profondeur 3 : provenance d’explication', (out) => { out.rankedResults[0].explanation.provenance[0].tenant = 'TENANT_SECRET'; }, 'ranking'],
    ['profondeur 3 : cellule de grille', (out) => { out.grid.rows[0].values[0].commissionRate = 12; }, 'comparison'],
    ['profondeur 2 : annonce comparée', (out) => { out.items[0].listing.latitude = -4.2; }, 'comparison'],
    ['racine', (out) => { out.internalNotes = 'NOTE_SECRET'; }, 'ranking'],
  ])('champ privé injecté (%s) : rejeté avec une erreur générique', async (label, inject, kind) => {
    const items = catalog(6, (n) => ({ amenities: n === 2 ? ['parking'] : [] }));
    const produce = {
      search: (deps) => gateway.searchRealEstate({ query: PREFS, context: ctx }, deps),
      ranking: (deps) => gateway.searchAndRankRealEstate({ query: PREFS, context: ctx }, { searchDependencies: deps }),
      comparison: (deps) => gateway.searchRankAndCompare({ query: PREFS, context: ctx }, { searchDependencies: deps, ...resolver(items) }),
    }[kind];
    const underlying = {
      search: require('../services/altimmoAssistant/intelligentSearchService'),
      ranking: require('../services/altimmoAssistant/personalizedSearchService'),
      comparison: require('../services/altimmoAssistant/comparisonService'),
    }[kind];
    const method = { search: 'searchRealEstateFromText', ranking: 'searchAndRankRealEstateFromText', comparison: 'searchRankAndCompareFromText' }[kind];
    const original = underlying[method];
    const spy = jest.spyOn(underlying, method).mockImplementation(async (...args) => { const out = await original(...args); inject(out); return out; });
    const out = await produce(scanSource(() => items));
    spy.mockRestore();
    expect(out).toEqual({ status: 'error', contractVersion: CONTRACT_VERSION, errors: [{ code: 'OUTPUT_CONTRACT_VIOLATION' }] });
    expect(JSON.stringify(out)).not.toMatch(/SECRET|commission|latitude|owner|tenant|street/);
  });

  test('type incorrect ou tableau surdimensionné : rejetés', () => {
    expect(validateAssistantOutput('search', { status: 'success', results: 'pas un tableau' }).valid).toBe(false);
    expect(validateAssistantOutput('ranking', { status: 'success', rankedResults: new Array(51).fill({}) }).valid).toBe(false);
    expect(validateAssistantOutput('unknown-kind', {}).valid).toBe(false);
  });
});

describe('IA-03C4 — pagination signalée', () => {
  const rank = (extra, getItems) => searchAndRankRealEstateFromText({ query: PREFS, context: ctx, ...extra }, { searchDependencies: scanSource(getItems) });

  test('jeton de continuation : la page suivante prolonge le même classement', async () => {
    const items = catalog(25, (n) => ({ amenities: n % 4 === 0 ? ['parking', 'jardin'] : [] }));
    const first = await rank({ pagination: { page: 1, limit: 10 } }, () => items);
    expect(typeof first.nextPageToken).toBe('string');
    const viaToken = await rank({ pageToken: first.nextPageToken }, () => items);
    const viaPage = await rank({ pagination: { page: 2, limit: 10 } }, () => items);
    expect(viaToken.rankedResults.map((i) => i.listing.id)).toEqual(viaPage.rankedResults.map((i) => i.listing.id));
    expect(viaToken.pagination).toEqual({ page: 2, limit: 10, pages: 3 });
    expect(viaToken.rankingWarnings.map((w) => w.code)).not.toContain('RANKING_CHANGED');
    const last = await rank({ pageToken: viaToken.nextPageToken }, () => items);
    expect(last.rankedResults).toHaveLength(5);
    expect(last.nextPageToken).toBeNull();
  });

  test('catalogue modifié entre deux pages : RANKING_CHANGED signalé, jamais silencieux', async () => {
    let items = catalog(25);
    const first = await rank({ pagination: { page: 1, limit: 10 } }, () => items);
    items = [listing(99, { amenities: ['parking', 'jardin', 'climatisation'] }), ...items];
    const next = await rank({ pageToken: first.nextPageToken }, () => items);
    expect(next.rankingWarnings.map((w) => w.code)).toContain('RANKING_CHANGED');
    expect(next.pagination.page).toBe(2);
  });

  test('jeton d’une autre demande, malformé ou surdimensionné : ignoré et signalé', async () => {
    const items = catalog(25);
    const other = await searchAndRankRealEstateFromText({ query: 'Je cherche une maison à louer à Bacongo, maximum 300 000 FCFA par mois.', context: ctx, pagination: { page: 1, limit: 10 } }, { searchDependencies: scanSource(() => items.map((l) => ({ ...l, address: { city: 'Brazzaville', arrondissement: 'Bacongo' } }))) });
    const mismatch = await rank({ pageToken: other.nextPageToken }, () => items);
    expect(mismatch.rankingWarnings.map((w) => w.code)).toContain('PAGE_TOKEN_MISMATCH');
    expect(mismatch.pagination.page).toBe(1);
    for (const bad of ['!!!', 'x'.repeat(5000), Buffer.from('{"v":1,"o":-5}').toString('base64url'), { $gt: '' }]) {
      const out = await rank({ pageToken: bad }, () => items);
      expect(out.rankingWarnings.map((w) => w.code)).toContain('INVALID_PAGE_TOKEN');
      expect(out.pagination.page).toBe(1);
    }
  });

  test('jeton forgé : position et taille bornées, aucun contournement', async () => {
    const items = catalog(25);
    const first = await rank({ pagination: { page: 1, limit: 10 } }, () => items);
    const decoded = JSON.parse(Buffer.from(first.nextPageToken, 'base64url').toString('utf8'));
    const forged = Buffer.from(JSON.stringify({ ...decoded, o: 100000, l: 100000 })).toString('base64url');
    const out = await rank({ pageToken: forged }, () => items);
    expect(out.rankedResults.length).toBeLessThanOrEqual(50);
    expect(out.coverage.evaluated).toBe(25);
  });
});

describe('IA-03C4 — option A : alternatives d’équipements facultatives', () => {
  test('parseur : alternative facultative reconnue sans clarification ; alternative obligatoire toujours ambiguë', () => {
    const preferred = parseRealEstateRequest('Je cherche une maison à louer à Talangaï. Je préfère une maison avec parking ou jardin.');
    expect(preferred.status).toBe('recognized');
    expect(preferred.ambiguities).toEqual([]);
    expect(preferred.amenityAlternatives).toEqual([{ modality: 'preferred', options: [['parking'], ['garden']] }]);
    expect(preferred.criteria.amenities.preferred).toEqual([]);
    const required = parseRealEstateRequest('Je cherche une maison à louer à Talangaï. Il me faut un parking ou un jardin.');
    expect(required.status).toBe('needs_clarification');
    expect(required.ambiguities).toContainEqual(expect.objectContaining({ code: 'AMENITY_ALTERNATIVE' }));
  });

  test('politique : une seule contribution de poids 100, TRUE si une option est confirmée', () => {
    const [group] = normalizeRankingPreferences([{ kind: 'AMENITY_ANY', options: [['parking', 'jardin'], ['balcon']] }]);
    expect(group).toEqual({ kind: 'AMENITY_ANY', key: 'parking+garden|terrace', options: [['parking', 'garden'], ['terrace']], weight: 100 });
    const state = (amenities, extra = {}) => evaluateRankingCandidate({ status: 'location', amenities, ...extra }, [group]).contributions[0].state;
    expect(state(['parking', 'jardin'])).toBe('TRUE');
    expect(state(['balcon'])).toBe('TRUE');
    expect(state(['parking'])).toBe('UNKNOWN'); // jardin inconnu : option 1 non prouvée, jamais « satisfaite »
    expect(state(['parking'], { amenitiesComplete: true })).toBe('FALSE');
    expect(state([], { amenitiesComplete: true })).toBe('FALSE');
    const scored = evaluateRankingCandidate({ status: 'location', amenities: ['balcon'] }, [group]);
    expect([scored.score, scored.confidence, scored.contributions.length]).toEqual([10000, 10000, 1]);
  });

  test('préférence alternative malformée ou forgée : écartée', () => {
    expect(normalizeRankingPreferences([
      { kind: 'AMENITY_ANY', options: 'parking' }, { kind: 'AMENITY_ANY', options: [['$where']] },
      { kind: 'AMENITY_ANY', options: [['parking']] }, // une seule option : pas une alternative
      { kind: 'AMENITY_ANY', options: Array.from({ length: 9 }, () => ['parking']) },
    ])).toEqual([]);
  });

  test('chaîne : « parking ou jardin » recherché sans clarification, classé et comparé', async () => {
    const query = 'Je cherche une maison à louer à Talangaï, 3 chambres, maximum 250 000 FCFA par mois. Je préfère un parking ou un jardin.';
    const items = [listing(1), listing(2, { amenities: ['jardin'] }), listing(3, { amenities: ['parking', 'jardin'] })];
    const ranked = await searchAndRankRealEstateFromText({ query, context: ctx, pagination: { page: 1, limit: 10 } }, { searchDependencies: scanSource(() => items) });
    expect(ranked.rankingStatus).toBe('ranked');
    expect(ranked.normalizedPreferences).toEqual([{ kind: 'AMENITY_ANY', key: 'parking|garden', options: [['parking'], ['garden']], weight: 100 }]);
    expect(ranked.rankedResults.map((i) => [i.listing.id, i.score])).toEqual([[hex(2), 10000], [hex(3), 10000], [hex(1), 5000]]);
    expect(ranked.rankedResults[0].explanation.favorable).toEqual(['Option confirmée parmi : parking ou jardin.']);
    const compared = await gateway.searchRankAndCompare({ query, context: ctx }, { searchDependencies: scanSource(() => items), ...resolver(items) });
    expect(compared.status).toBe('success');
    const row = compared.grid.rows.find((r) => r.key === 'need.amenity_any.parking|garden');
    expect(row.values.map((v) => v.state)).toEqual(['TRUE', 'TRUE', 'UNKNOWN']);
    expect(compared.items[0].advantages.map((a) => a.text)).toContain('Au moins une de vos options est confirmée (parking ou jardin), conformément à votre préférence.');
    expect(compared.items[2].unknowns.map((a) => a.text)).toContain('Vos options (parking ou jardin) ne sont pas renseignées.');
  });
});
