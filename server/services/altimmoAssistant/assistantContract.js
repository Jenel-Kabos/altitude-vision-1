// IA-03C4 — Contrat de sortie versionné de l'assistant. Liste blanche fermée : toute clé non
// déclarée, à n'importe quelle profondeur, est une violation. Aucune dépendance externe.

const CONTRACT_VERSION = 'IA-03C4.1';
const MAX_VIOLATIONS = 20;
const MAX_PAGE = 50;

// ── Types élémentaires ─────────────────────────────────────────────────────
const T = Object.freeze({
  string: { t: 'string' }, number: { t: 'number' }, integer: { t: 'integer' }, boolean: { t: 'boolean' },
  id: { t: 'id' }, date: { t: 'date' }, scalar: { t: 'scalar' }, scalarMap: { t: 'scalarMap' },
});
const nullable = (of) => ({ t: 'nullable', of });
const arr = (items, max = 1000) => ({ t: 'array', items, max });
const obj = (fields) => ({ t: 'object', fields });
const oneOf = (values) => ({ t: 'enum', values });
const anyOf = (...options) => ({ t: 'anyOf', options });

const str = T.string; const num = T.number; const int = T.integer; const bool = T.boolean;
const strList = arr(str);
const notice = obj({ code: str, field: str, message: str });
const state = oneOf(['TRUE', 'FALSE', 'UNKNOWN']);
const constraintCheck = obj({ field: str, state, reason: str });
const range = obj({ min: nullable(num), max: nullable(num) });

const criteria = nullable(obj({
  transaction: nullable(str), propertyTypes: strList, accommodationTypes: strList,
  location: obj({
    country: nullable(str), city: nullable(str), districts: strList, preferredDistricts: strList,
    neighborhood: nullable(str), zone: nullable(str), radiusMeters: nullable(num),
  }),
  budget: obj({ min: nullable(num), max: nullable(num), currency: nullable(str), period: nullable(str) }),
  bedrooms: range, bathrooms: range, surface: range, floors: range,
  amenities: obj({ required: strList, preferred: strList, excluded: strList }),
  proximity: obj({ required: arr(obj({ category: str, maxMeters: num })), preferred: arr(obj({ category: str, maxMeters: num })) }),
  stay: obj({
    checkIn: nullable(str), checkOut: nullable(str), nights: nullable(num), adults: nullable(num),
    children: nullable(num), rooms: nullable(num), stayType: nullable(str),
  }),
}));

// Projection publique IA-02 (publicListingService.toPublicListing) — jamais propriétaire, tenant, documents, coordonnées.
const publicListing = obj({
  _id: T.id, id: T.id, title: str, description: str, pole: str, type: str, status: str, price: num, honoraires: num,
  fraisVisite: num, images: arr(T.scalar), bedrooms: T.scalar, bathrooms: T.scalar, surface: T.scalar, livingRooms: T.scalar,
  kitchens: T.scalar, constructionType: str, amenities: arr(T.scalar), availability: str, cautionMultiplicateur: num,
  profilsLocataireRecherches: arr(T.scalar), documentsRequis: arr(T.scalar), isPublished: bool, statusAdmin: str,
  recommande: bool, views: num, shares: num, createdAt: T.date, updatedAt: T.date, accommodationType: str,
  accommodationId: T.id, hotel: nullable(T.id), hotelServices: T.scalarMap,
  address: obj({ neighborhood: str, arrondissement: str, city: str }),
  likesCount: num, likedByMe: bool,
  reviews: arr(obj({ rating: nullable(num), comment: str, createdAt: nullable(T.date) })),
});

const preference = obj({
  kind: oneOf(['AMENITY', 'PRICE_TARGET', 'AMENITY_ANY']), key: str, weight: num,
  target: num, currency: str, period: str, options: arr(strList, 4),
});

const coverage = obj({
  evaluated: num, sourceTotal: num, complete: bool, limit: num,
  mongoMatchedTotal: num, mongoTotalExact: bool, scanned: num, readCalls: num, admissible: num, toVerify: num,
  admissibleTotalExact: bool, batchSize: num, maxScanned: num,
});

const searchCommon = {
  status: oneOf(['success', 'forbidden', 'invalid', 'needs_clarification']), intent: nullable(str), interpretedCriteria: criteria,
  appliedCriteria: strList, unverifiableCriteria: arr(notice), unsupportedCriteria: arr(notice), ambiguities: arr(notice),
  clarificationQuestions: strList, preferences: strList, preferenceAlternatives: arr(obj({ options: arr(strList, 4) }), 10),
  total: num, verificationTotal: num, pagination: obj({ page: int, limit: int, pages: int }), coverage, warnings: arr(notice),
  contractVersion: str,
};

const searchResult = obj({
  ...searchCommon,
  results: arr(publicListing, MAX_PAGE),
  candidatesToVerify: arr(obj({ listing: publicListing, unknownCriteria: arr(constraintCheck) }), MAX_PAGE),
});

const rankedItem = obj({
  listing: publicListing, position: int, score: int, confidence: int,
  satisfiedPreferences: strList, unsatisfiedPreferences: strList, unknownPreferences: strList,
  unknownCriteria: arr(constraintCheck),
  explanation: obj({
    summary: str, favorable: strList, unfavorable: strList, toVerify: strList, tradeoffs: strList,
    provenance: arr(obj({ criterion: str, source: nullable(str), state })), warnings: arr(obj({ code: str })),
  }),
});

const rankingResult = obj({
  ...searchCommon,
  rankingStatus: oneOf(['ranked', 'not_ranked']), rankingOrder: oneOf(['RELEVANCE', 'CHRONOLOGICAL', 'CHRONOLOGICAL_FALLBACK']),
  rankedResults: arr(rankedItem, MAX_PAGE), rankedCandidatesToVerify: arr(rankedItem, MAX_PAGE),
  rankingWarnings: arr(notice), normalizedPreferences: arr(preference, 50), nextPageToken: nullable(str),
  rankingCoverage: obj({ evaluated: num, ranked: num, complete: bool, limit: num, sourceCoverage: nullable(coverage) }),
});

// IA-03C2 — comparaison
const priceFact = obj({ state: str, amount: nullable(num), currency: nullable(str), period: nullable(str), source: nullable(str), issue: nullable(str) });
const flatValue = anyOf(T.scalar, arr(T.scalar, 50), T.scalarMap);
const statement = obj({ code: str, criterion: str, state, text: str, source: nullable(str) });
const distinction = obj({ code: str, dimension: str, criterion: str, value: flatValue });
const comparisonListing = obj({
  id: str, title: str, status: str, type: str, constructionType: str, availability: str,
  address: obj({ neighborhood: str, arrondissement: str, city: str }), price: num, bedrooms: num, bathrooms: num, surface: num,
  livingRooms: num, cautionMultiplicateur: num, amenities: strList, image: str, accommodationType: str, occupancyMode: str,
  furnished: bool, capacity: obj({ maxAdults: int, maxChildren: int }), minimumStay: int, maximumStay: int,
  searchPrice: num, searchCurrency: str, monthlyPrice: num, monthlyCurrency: str, accommodationCurrency: str,
});
const comparisonItem = obj({
  id: str, label: str, position: int, sourcePosition: nullable(int), matchStatus: str, category: str, listing: comparisonListing,
  price: priceFact, monthlyPrice: priceFact, score: int, confidence: int, confidenceLevel: str, scoreRange: nullable(obj({ min: int, max: int })),
  scoreSource: str, scoreBasis: str, confirmedCriteria: strList, unmetCriteria: strList, criteriaToVerify: strList,
  constraintStatus: str, advantages: arr(statement), disadvantages: arr(statement), unknowns: arr(statement), summary: str,
  provenance: arr(obj({ criterion: str, state, source: nullable(str) })),
});
const dimension = obj({ comparable: bool, reason: str, groups: arr(obj({ period: str, currency: str, ids: strList })) });
const comparisonResult = obj({
  version: str, status: oneOf(['success', 'forbidden', 'invalid', 'not_compared', 'insufficient', 'error']), mode: nullable(str),
  comparedIds: arr(str, 10), items: arr(comparisonItem, 10), unavailable: arr(obj({ id: str, code: str }), 50),
  criteriaUsed: obj({ constraints: strList, preferences: arr(preference, 50), unverifiable: arr(obj({ key: str, reason: str })) }),
  grid: obj({ rows: arr(obj({ group: str, key: str, label: str, criterion: str, reason: str, values: arr(obj({ state: str, value: flatValue, display: str }), 10) }), 300) }),
  comparability: nullable(obj({ level: str, reasons: strList, dimensions: obj({ price: dimension, surface: dimension, bedrooms: dimension, bathrooms: dimension }) })),
  tradeoffs: arr(obj({ id: str, strengths: arr(distinction), weaknesses: arr(distinction), neutral: arr(distinction), toVerify: arr(distinction), text: str }), 10),
  hasTradeoffs: bool, tradeoffSummary: nullable(str),
  conclusion: nullable(obj({ verdict: str, basis: nullable(str), leaderId: nullable(str), recommendedId: nullable(str), tiedIds: strList, conditions: strList, text: str })),
  scoreNote: str,
  coverage: nullable(obj({ mode: str, windowDependent: bool, complete: nullable(bool), evaluated: nullable(num), sourceTotal: nullable(num), limit: nullable(num) })),
  limits: obj({ maxListings: int, requested: int }), errors: arr(obj({ code: str, index: int })), warnings: arr(notice),
  clarificationQuestions: strList, upstreamStatus: nullable(str), contractVersion: str,
});

const SCHEMAS = Object.freeze({ search: searchResult, ranking: rankingResult, comparison: comparisonResult });

// ── Validation ────────────────────────────────────────────────────────────
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const isScalar = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const isObjectId = (value) => value && typeof value === 'object' && value._bsontype === 'ObjectId';

function validateNode(schema, value, path, violations) {
  if (violations.length >= MAX_VIOLATIONS) return;
  const fail = () => violations.push(path || '$');
  switch (schema.t) {
    case 'string': if (typeof value !== 'string') fail(); return;
    case 'number': if (typeof value !== 'number' || !Number.isFinite(value)) fail(); return;
    case 'integer': if (!Number.isSafeInteger(value)) fail(); return;
    case 'boolean': if (typeof value !== 'boolean') fail(); return;
    case 'id': if (typeof value !== 'string' && !isObjectId(value)) fail(); return;
    case 'date': if (typeof value !== 'string' && !(value instanceof Date)) fail(); return;
    case 'scalar': if (!isScalar(value)) fail(); return;
    case 'scalarMap':
      if (!isPlainObject(value)) { fail(); return; }
      for (const [key, item] of Object.entries(value)) if (!isScalar(item)) violations.push(`${path}.${key}`);
      return;
    case 'enum': if (!schema.values.includes(value)) fail(); return;
    case 'nullable': if (value !== null) validateNode(schema.of, value, path, violations); return;
    case 'anyOf': {
      if (!schema.options.some((option) => { const local = []; validateNode(option, value, path, local); return !local.length; })) fail();
      return;
    }
    case 'array':
      if (!Array.isArray(value) || value.length > schema.max) { fail(); return; }
      value.forEach((item, index) => validateNode(schema.items, item, `${path}[${index}]`, violations));
      return;
    case 'object':
      if (!isPlainObject(value)) { fail(); return; }
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        if (!Object.hasOwn(schema.fields, key)) { violations.push(`${path}.${key}`); continue; }
        validateNode(schema.fields[key], item, `${path}.${key}`, violations);
      }
      return;
    default: fail();
  }
}

/**
 * @param {'search'|'ranking'|'comparison'} kind
 * @returns {{valid:boolean, violations:string[]}} chemins en violation (usage interne et tests, jamais renvoyés au client)
 */
function validateAssistantOutput(kind, value) {
  const schema = SCHEMAS[kind];
  if (!schema) return { valid: false, violations: ['$kind'] };
  const violations = [];
  validateNode(schema, value, '$', violations);
  return { valid: violations.length === 0, violations };
}

/** Garde de frontière : sortie conforme + version, sinon erreur générique sans aucun détail. */
function guardAssistantOutput(kind, value) {
  const stamped = value && typeof value === 'object' ? { ...value, contractVersion: CONTRACT_VERSION } : value;
  return validateAssistantOutput(kind, stamped).valid
    ? stamped
    : { status: 'error', contractVersion: CONTRACT_VERSION, errors: [{ code: 'OUTPUT_CONTRACT_VIOLATION' }] };
}

module.exports = { CONTRACT_VERSION, SCHEMAS, validateAssistantOutput, guardAssistantOutput };
