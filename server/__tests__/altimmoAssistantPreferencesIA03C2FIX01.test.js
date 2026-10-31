const { parseRealEstateRequest } = require('../services/altimmoAssistant/ruleParser');
const { searchRealEstateFromText } = require('../services/altimmoAssistant/intelligentSearchService');
const { searchAndRankRealEstateFromText } = require('../services/altimmoAssistant/personalizedSearchService');
const { searchRankAndCompareFromText } = require('../services/altimmoAssistant/comparisonService');

const amenities = (text) => parseRealEstateRequest(text).criteria.amenities;
const parse = (text) => parseRealEstateRequest(text);

describe('IA-03C2-FIX01 — préférences facultatives et obligations', () => {
  test.each([
    // [demande, required, preferred, excluded]
    ['Je cherche une maison de trois chambres. Je préfère un parking.', [], ['parking'], []],
    ['Je cherche une maison de trois chambres avec parking obligatoire.', ['parking'], [], []],
    ["Je souhaite une maison avec parking, mais ce n'est pas indispensable.", [], ['parking'], []],
    ['Je veux une maison avec parking, mais ce n’est pas obligatoire.', [], ['parking'], []],
    ['Je veux absolument une maison avec parking.', ['parking'], [], []],
    ['Je ne veux pas de piscine.', [], [], ['pool']],
    ['Maison avec parking si possible.', [], ['parking'], []],
    ['Maison avec parking et jardin de préférence.', [], ['parking', 'garden'], []],
    ['Maison avec parking, jardin et climatisation.', ['parking', 'garden', 'air_conditioning'], [], []],
    ['Trois chambres obligatoires et parking préféré.', [], ['parking'], []],
    ['Jardin préféré, piscine exclue.', [], ['garden'], ['pool']],
    ['Parking préféré, climatisation obligatoire.', ['air_conditioning'], ['parking'], []],
    ['Je préfère un parking, mais la climatisation est obligatoire.', ['air_conditioning'], ['parking'], []],
    ['Il me faut un parking. Ce serait bien d’avoir un jardin.', ['parking'], ['garden'], []],
    ['Je dois avoir la climatisation et, si disponible, un forage.', ['air_conditioning'], ['borehole'], []],
    ['Surtout pas de piscine, impérativement un gardien.', ['security'], [], ['pool']],
    ['Piscine à exclure, idéalement un balcon.', [], ['terrace'], ['pool']],
  ])('%s', (text, required, preferred, excluded) => {
    expect(amenities(text)).toEqual({ required, preferred, excluded });
  });

  test('une préférence n’absorbe jamais le nombre de chambres', () => {
    const out = parse('Je veux trois chambres et, si possible, un jardin et un parking.');
    expect(out.criteria.bedrooms.min).toBe(3);
    expect(out.criteria.amenities).toEqual({ required: [], preferred: ['parking', 'garden'], excluded: [] });
  });

  test('contrat existant conservé : indispensable, de préférence, si possible, sans', () => {
    expect(amenities('3 chambres, parking indispensable, près d’un marché si possible.').required).toEqual(['parking']);
    expect(amenities('villa avec jardin de préférence').preferred).toEqual(['garden']);
    expect(amenities('Maison avec jardin si possible').preferred).toEqual(['garden']);
    expect(amenities('maison avec piscine et sans climatisation')).toEqual({ required: ['pool'], preferred: [], excluded: ['air_conditioning'] });
  });
});

describe('IA-03C2-FIX01 — préférences multiples', () => {
  test.each([
    ['Je préfère un parking, un jardin et la climatisation.', ['parking', 'garden', 'air_conditioning']],
    ['Je veux une maison de trois chambres et je préfère un parking, un jardin et la climatisation.', ['parking', 'garden', 'air_conditioning']],
    ['Je cherche un appartement avec deux chambres, idéalement un balcon et un parking.', ['parking', 'terrace']],
    ['Maison à louer. Je préfère un jardin. Je préfère aussi la climatisation.', ['garden', 'air_conditioning']],
    ['De préférence un jardin et un parking ; il me faut trois chambres.', ['parking', 'garden']],
    ['JE PRÉFÈRE UN PARKING ET UN JARDIN', ['parking', 'garden']],
    ['je prefere un parking et un jardin', ['parking', 'garden']],
    ['Idéalement clim, garage et wifi', ['parking', 'air_conditioning', 'wifi']],
  ])('%s', (text, preferred) => {
    const out = amenities(text);
    expect(out.preferred).toEqual(preferred);
    expect(out.required).toEqual([]);
  });

  test('« pas nécessaire » rend facultatif, jamais interdit', () => {
    expect(amenities("Je souhaite un parking et un jardin, mais la piscine n'est pas nécessaire."))
      .toEqual({ required: [], preferred: ['parking', 'pool', 'garden'], excluded: [] });
  });

  test('exclusion, obligation et préférence dans la même phrase', () => {
    const out = parse('Je veux une maison avec trois chambres, sans piscine, mais avec un parking de préférence.');
    expect(out.criteria.bedrooms.min).toBe(3);
    expect(out.criteria.amenities).toEqual({ required: [], preferred: ['parking'], excluded: ['pool'] });
  });
});

describe('IA-03C2-FIX01 — alternatives et contradictions', () => {
  test('« parking ou jardin » : alternative conservée, jamais transformée en « et »', () => {
    const out = parse('Je cherche une maison à louer à Talangaï. Je préfère une maison avec parking ou jardin.');
    expect(out.amenityAlternatives).toEqual([{ modality: 'preferred', options: [['parking'], ['garden']] }]);
    expect(out.criteria.amenities.preferred).toEqual([]);
    // IA-03C4 (option A, décision de la direction) : une alternative facultative est classée, plus clarifiée.
    expect(out.status).toBe('recognized');
    const required = parse('Je cherche une maison à louer à Talangaï. Il me faut un parking ou un jardin.');
    expect(required.ambiguities).toContainEqual(expect.objectContaining({ code: 'AMENITY_ALTERNATIVE', field: 'amenities' }));
    expect(required.status).toBe('needs_clarification');
  });

  test('groupes logiques : (parking et jardin) ou balcon', () => {
    const out = parse('Je préfère un parking et un jardin, ou au moins un balcon.');
    expect(out.amenityAlternatives).toEqual([{ modality: 'preferred', options: [['parking', 'garden'], ['terrace']] }]);
    expect(out.criteria.amenities).toEqual({ required: [], preferred: [], excluded: [] });
  });

  test.each([
    'Parking indispensable mais parking exclu.',
    'Je veux absolument un parking, mais je préfère une maison sans parking.',
  ])('contradiction signalée sans arbitrage silencieux : %s', (text) => {
    const out = parse(text);
    expect(out.contradictions).toContainEqual(expect.objectContaining({ code: 'CONFLICTING_AMENITY_MODALITIES', field: 'amenities.parking' }));
    expect(out.status).toBe('needs_clarification');
    expect(out.criteria.amenities).toEqual({ required: [], preferred: [], excluded: [] });
  });

  test('une mention simple suivie d’une préférence explicite n’est pas une contradiction', () => {
    const out = parse('Maison avec parking. Je préfère un parking couvert.');
    expect(out.contradictions).toEqual([]);
    expect(out.criteria.amenities.preferred).toEqual(['parking']);
  });
});

describe('IA-03C2-FIX01 — robustesse', () => {
  test('aucune préférence et critères inconnus', () => {
    expect(parse('Maison à louer à Bacongo, 3 chambres.').criteria.amenities).toEqual({ required: [], preferred: [], excluded: [] });
    expect(parse('Maison à louer à Bacongo, 3 chambres.').amenityAlternatives).toEqual([]);
    expect(amenities('Maison avec jacuzzi et sauna, je préfère un parking.')).toEqual({ required: [], preferred: ['parking'], excluded: [] });
  });

  test('entrées malveillantes : bornées, sans clé forgée ni texte réémis', () => {
    const out = parse('<script>je préfère</script> un parking; $where: sleep(1); tenant=autre; obligatoire {"$gt":""}');
    expect(out.criteria.amenities.preferred).toEqual(['parking']);
    expect(JSON.stringify(out)).not.toMatch(/script|\$where|\$gt|tenant/);
    const started = Date.now();
    const long = parse(`${'je préfère un parking ou un jardin, '.repeat(40)}maison`);
    expect(Date.now() - started).toBeLessThan(500);
    expect(long.issues).toContainEqual(expect.objectContaining({ code: 'INPUT_TRUNCATED' }));
  });
});

describe('IA-03C2-FIX01 — chaîne IA-03B → IA-03C1 → IA-03C2', () => {
  const QUERY = 'Je cherche une maison à louer à Talangaï avec trois chambres, pour 250 000 FCFA maximum par mois. Je préfère un parking, un jardin et la climatisation.';
  const hex = (n) => n.toString(16).padStart(24, '0');
  const listing = (n, amenityList) => ({
    _id: hex(n), id: hex(n), title: `Maison ${n}`, status: 'location', type: 'Maison', price: 200000,
    address: { city: 'Brazzaville', arrondissement: 'Talangaï' }, bedrooms: 3, bathrooms: 2, surface: 120,
    amenities: amenityList, isPublished: true, statusAdmin: 'Validée', availability: 'Disponible', pole: 'Altimmo',
  });
  const listings = [listing(1, ['parking', 'jardin', 'climatisation']), listing(2, ['parking'])];
  const searchDependencies = () => ({ searchProperties: jest.fn(async () => ({ properties: listings, total: listings.length })), searchAccommodations: jest.fn() });

  test('parseur : contraintes obligatoires et trois préférences', () => {
    const out = parse(QUERY);
    expect(out.status).toBe('recognized');
    expect(out.criteria).toMatchObject({
      transaction: 'RENT', propertyTypes: ['Maison'], location: { districts: ['Talangaï'] }, bedrooms: { min: 3 },
      budget: { max: 250000, currency: 'XAF', period: 'MONTH' },
      amenities: { required: [], preferred: ['parking', 'garden', 'air_conditioning'], excluded: [] },
    });
  });

  test('IA-03B : une maison sans jardin reste une correspondance exacte', async () => {
    const out = await searchRealEstateFromText({ query: QUERY, context: { scopeMode: 'PUBLIC' } }, searchDependencies());
    expect(out.results.map((item) => item.id)).toEqual([hex(1), hex(2)]);
    expect(out.candidatesToVerify).toEqual([]);
    expect(out.preferences).toEqual(['parking', 'garden', 'air_conditioning']);
  });

  test('IA-03C1 : chaque préférence contribue, l’inconnu reste neutre, poids inchangés', async () => {
    const out = await searchAndRankRealEstateFromText({ query: QUERY, context: { scopeMode: 'PUBLIC' } }, { searchDependencies: searchDependencies() });
    expect(out.normalizedPreferences).toEqual([
      { kind: 'AMENITY', key: 'parking', weight: 100 }, { kind: 'AMENITY', key: 'garden', weight: 100 }, { kind: 'AMENITY', key: 'air_conditioning', weight: 100 },
    ]);
    const [first, second] = out.rankedResults;
    expect([first.listing.id, first.score, first.confidence]).toEqual([hex(1), 10000, 10000]);
    expect([second.listing.id, second.score, second.confidence]).toEqual([hex(2), 6667, 3333]);
    expect(second.unknownPreferences).toEqual(['garden', 'air_conditioning']);
  });

  test('IA-03C2 : grille, avantages, inconnues et conclusion restituent les préférences', async () => {
    const records = listings.map((l) => ({ id: l.id, listing: l, accommodation: null, rates: {} }));
    const out = await searchRankAndCompareFromText({ query: QUERY, context: { scopeMode: 'PUBLIC' } }, {
      searchDependencies: searchDependencies(), resolvePublicListings: async (ids) => records.filter((r) => ids.includes(r.id)),
    });
    expect(out.status).toBe('success');
    expect(out.criteriaUsed.preferences.map((p) => p.key)).toEqual(['parking', 'garden', 'air_conditioning']);
    expect(out.criteriaUsed.constraints.some((field) => field.startsWith('amenities.'))).toBe(false);
    const row = out.grid.rows.find((r) => r.key === 'need.amenity.garden');
    expect(row.values.map((v) => v.state)).toEqual(['TRUE', 'UNKNOWN']);
    const [a, b] = out.items;
    expect(a.advantages.map((x) => x.text)).toContain('Jardin confirmé, conformément à votre préférence.');
    expect(b.unknowns.map((x) => x.text)).toContain("La présence d'un jardin n'est pas renseignée.");
    expect(b.criteriaToVerify).toEqual(['amenity.garden', 'amenity.air_conditioning']);
    expect(b.constraintStatus).toBe('MATCHING');
    expect(out.tradeoffs.find((t) => t.id === hex(1)).strengths.map((s) => s.criterion)).toEqual(['amenity.garden', 'amenity.air_conditioning']);
    expect(out.conclusion).toMatchObject({ verdict: 'CONDITIONAL_LEAD', leaderId: hex(1) });
  });
});
