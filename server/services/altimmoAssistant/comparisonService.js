const { normalizeRankingPreferences } = require('./rankingPolicy');
const P = require('./comparisonPolicy');

const VERSION = 'IA-03C2.1';
const COMPARISON_MODE = Object.freeze({ RANKED: 'RANKED_RESULTS', SELECTED: 'SELECTED_LISTINGS' });
const ALLOWED_SCOPE_MODES = Object.freeze(['PUBLIC', 'TENANT', 'PLATFORM']);
const LISTING_ID = /^[0-9a-f]{24}$/i;
const MAX_RAW_IDS = 50;
const DEFAULT_RANKED_COUNT = 3;
const SCORE_NOTE = "Le score mesure la correspondance aux préférences exprimées ; ce n'est pas une probabilité de satisfaction.";
const UPSTREAM_STATUSES = Object.freeze(['success', 'forbidden', 'invalid', 'needs_clarification']);
const NUMBER_WORDS = Object.freeze({ deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 });

const warning = (code, message) => ({ code, message });
const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function defaultResolver() {
  // Chargement tardif : les tests unitaires injectent un résolveur sans initialiser Mongoose.
  return require('./comparisonSource').resolvePublicListings;
}

function emptyResult(status, mode, config, extra = {}) {
  return {
    version: VERSION, status, mode: Object.values(COMPARISON_MODE).includes(mode) ? mode : null,
    comparedIds: [], items: [], unavailable: [], criteriaUsed: { constraints: [], preferences: [], unverifiable: [] },
    grid: { rows: [] }, comparability: null, tradeoffs: [], hasTradeoffs: false, tradeoffSummary: null, conclusion: null,
    scoreNote: SCORE_NOTE, coverage: null, limits: { maxListings: config.maxListings }, errors: [], warnings: [], clarificationQuestions: [],
    ...extra,
  };
}

/** Nombre demandé dans « compare les trois meilleures propositions » ; null si absent. */
function requestedComparisonCount(text) {
  const match = /compar\w*\s+(?:les\s+|mes\s+|ces\s+)?(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:meilleur|premier|premiere|proposition|bien|annonce)/.exec(fold(text));
  if (!match) return null;
  return NUMBER_WORDS[match[1]] || Number(match[1]);
}

function selectedIds(rawIds, config) {
  if (!Array.isArray(rawIds)) return { errors: [{ code: 'INVALID_SELECTION' }] };
  if (!rawIds.length) return { errors: [{ code: 'EMPTY_SELECTION' }] };
  if (rawIds.length > MAX_RAW_IDS) return { errors: [{ code: 'TOO_MANY_LISTINGS' }] };
  // L'erreur ne renvoie que la position : aucune valeur fournie par le client n'est réémise.
  const malformed = rawIds.map((id, index) => (typeof id === 'string' && LISTING_ID.test(id) ? null : { code: 'INVALID_LISTING_ID', index })).filter(Boolean);
  if (malformed.length) return { errors: malformed };
  const ids = [...new Set(rawIds.map((id) => id.toLowerCase()))];
  const warnings = ids.length < rawIds.length ? [warning('DUPLICATE_LISTING_ID', 'Un identifiant dupliqué a été ignoré.')] : [];
  if (ids.length < P.MIN_LISTINGS) return { errors: [{ code: 'SELECTION_TOO_SMALL' }], warnings };
  if (ids.length > config.maxListings) return { errors: [{ code: 'TOO_MANY_LISTINGS' }], warnings };
  return { ids: ids.map((id) => ({ id, matchStatus: 'SELECTED', sourcePosition: null })), warnings, errors: [] };
}

function rankedSelection(rankingResult, count, config) {
  const warnings = [];
  const groups = [['rankedResults', 'MATCH'], ['rankedCandidatesToVerify', 'TO_VERIFY']];
  const candidates = []; const seen = new Set();
  for (const [key, matchStatus] of groups) {
    const items = Array.isArray(rankingResult[key]) ? [...rankingResult[key]] : [];
    items.sort((left, right) => (Number(left?.position) || 0) - (Number(right?.position) || 0));
    for (const item of items) {
      const id = String(item?.listing?.id || item?.listing?._id || '').toLowerCase();
      if (!LISTING_ID.test(id)) { warnings.push(warning('INVALID_RANKED_CANDIDATE', 'Un candidat classé sans identifiant public valide a été ignoré.')); continue; }
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push({ id, matchStatus, sourceScore: item.score, sourceConfidence: item.confidence });
    }
  }
  let requested = count === undefined || count === null ? DEFAULT_RANKED_COUNT : Math.floor(Number(count));
  if (!Number.isFinite(requested)) requested = DEFAULT_RANKED_COUNT;
  if (requested > config.maxListings) {
    warnings.push(warning('COMPARISON_LIMIT_APPLIED', `La comparaison est limitée à ${config.maxListings} biens.`));
    requested = config.maxListings;
  }
  requested = Math.max(P.MIN_LISTINGS, requested);
  return { ids: candidates.slice(0, requested).map((item, index) => ({ ...item, sourcePosition: index + 1 })), warnings, requested };
}

function rankedCoverage(rankingResult) {
  const coverage = rankingResult.coverage || {};
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const complete = coverage.complete !== false && rankingResult.rankingCoverage?.complete !== false;
  return {
    mode: 'RANKED_WINDOW', windowDependent: true, complete,
    evaluated: number(coverage.evaluated), sourceTotal: number(coverage.sourceTotal), limit: number(coverage.limit),
  };
}

// Défense en profondeur : un résolveur fautif ne peut pas faire entrer une annonce non publique.
function isPubliclyEligible(record, id) {
  const listing = record?.listing;
  if (!listing || String(record.id || '').toLowerCase() !== id || String(listing.id || listing._id || '').toLowerCase() !== id) return false;
  if (listing.isPublished !== true || listing.statusAdmin !== 'Validée' || listing.availability !== 'Disponible' || listing.pole !== 'Altimmo') return false;
  return listing.status !== 'hebergement' || Boolean(record.accommodation && typeof record.accommodation === 'object');
}

function flattenRecord(record) {
  const listing = record.listing;
  if (listing.status !== 'hebergement') return listing;
  const accommodation = record.accommodation || {};
  const rates = record.rates && typeof record.rates === 'object' ? record.rates : {};
  const structured = accommodation.amenities && typeof accommodation.amenities === 'object' && !Array.isArray(accommodation.amenities)
    ? Object.values(accommodation.amenities).flat().filter((value) => typeof value === 'string') : [];
  return {
    ...listing,
    accommodationType: accommodation.accommodationType ?? listing.accommodationType, occupancyMode: accommodation.occupancyMode,
    furnished: accommodation.furnished, capacity: accommodation.capacity, minimumStay: accommodation.minimumStay, maximumStay: accommodation.maximumStay,
    accommodationCurrency: accommodation.currency, searchPrice: rates.nightly?.amount, searchCurrency: rates.nightly?.currency,
    monthlyPrice: rates.monthly?.amount, monthlyCurrency: rates.monthly?.currency,
    amenities: [...new Set([...(Array.isArray(listing.amenities) ? listing.amenities : []), ...structured])],
  };
}

const confidenceLevel = (ranking) => (ranking.basis === 'NO_PREFERENCES' ? 'NOT_APPLICABLE'
  : ranking.confidence >= 8000 ? 'HIGH' : ranking.confidence >= 5000 ? 'MEDIUM' : ranking.confidence > 0 ? 'LOW' : 'NONE');

function toItem(entry, selection, position) {
  const byState = (state) => [
    ...entry.constraintChecks.filter((check) => check.state === state).map((check) => check.field),
    ...entry.ranking.contributions.filter((item) => item.state === state).map((item) => item.criterion),
  ];
  return {
    id: entry.id, label: entry.label, position, sourcePosition: selection.sourcePosition, matchStatus: selection.matchStatus,
    category: entry.category, listing: entry.listing, price: entry.price, monthlyPrice: entry.monthlyPrice,
    score: entry.ranking.score, confidence: entry.ranking.confidence, confidenceLevel: confidenceLevel(entry.ranking),
    scoreRange: entry.ranking.scoreRange, scoreSource: entry.ranking.source, scoreBasis: entry.ranking.basis,
    confirmedCriteria: byState('TRUE'), unmetCriteria: byState('FALSE'),
    criteriaToVerify: [...byState('UNKNOWN'), ...entry.unverifiable.map((item) => item.key)],
    constraintStatus: entry.constraintStatus, advantages: entry.advantages, disadvantages: entry.disadvantages,
    unknowns: entry.unknowns, summary: entry.summary,
    provenance: [
      ...entry.constraintChecks.map((check) => ({ criterion: check.field, state: check.state })),
      ...entry.ranking.contributions.map((item) => ({ criterion: item.criterion, state: item.state, source: item.source })),
      { criterion: 'price', state: entry.price.state === 'KNOWN' ? 'TRUE' : 'UNKNOWN', source: entry.price.source },
    ],
  };
}

/**
 * Point d'entrée interne IA-03C2. Aucune route, écriture, réservation ou action métier.
 * @param {{mode:string,propertyIds?:string[],rankingResult?:object,count?:number,criteria?:object,preferences?:Array,context?:{scopeMode:string}}} input
 * @param {{resolvePublicListings?:Function,config?:{maxListings?:number}}} [dependencies]
 */
async function compareRealEstate(input = {}, dependencies = {}) {
  const config = P.resolveComparisonConfig(dependencies.config);
  const mode = input.mode;
  if (!ALLOWED_SCOPE_MODES.includes(input.context?.scopeMode)) {
    return emptyResult('forbidden', mode, config, { errors: [{ code: 'UNRESOLVED_CONTEXT' }], warnings: [warning('UNRESOLVED_CONTEXT', 'Le contexte de sécurité ne peut pas être résolu.')] });
  }
  if (!Object.values(COMPARISON_MODE).includes(mode)) return emptyResult('invalid', mode, config, { errors: [{ code: 'INVALID_COMPARISON_MODE' }] });

  let selection; let criteria; let preferences; let coverage; const warnings = [];
  if (mode === COMPARISON_MODE.SELECTED) {
    selection = selectedIds(input.propertyIds, config);
    if (selection.errors.length) return emptyResult('invalid', mode, config, { errors: selection.errors, warnings: selection.warnings || [] });
    criteria = P.sanitizeComparisonCriteria(input.criteria);
    preferences = input.preferences !== undefined ? input.preferences : criteria.amenities.preferred;
    coverage = { mode: 'INDIVIDUAL_RESOLUTION', windowDependent: false, complete: null, evaluated: null, sourceTotal: null, limit: null };
  } else {
    const ranking = input.rankingResult;
    if (!ranking || ranking.status !== 'success' || ranking.rankingStatus !== 'ranked') {
      const questions = Array.isArray(ranking?.clarificationQuestions) ? ranking.clarificationQuestions.filter((q) => typeof q === 'string').slice(0, 5).map((q) => q.slice(0, 300)) : [];
      return emptyResult('not_compared', mode, config, {
        upstreamStatus: UPSTREAM_STATUSES.includes(ranking?.status) ? ranking.status : null, clarificationQuestions: questions,
        errors: [{ code: 'RANKING_NOT_AVAILABLE' }],
      });
    }
    selection = rankedSelection(ranking, input.count, config);
    criteria = P.sanitizeComparisonCriteria(ranking.interpretedCriteria);
    preferences = ranking.normalizedPreferences !== undefined ? ranking.normalizedPreferences : ranking.preferences;
    coverage = rankedCoverage(ranking);
    if (coverage.complete === false) warnings.push(warning('CATALOG_COVERAGE_LIMITED', 'Les biens comparés sont les mieux classés parmi les candidats évalués, pas sur tout le catalogue.'));
  }
  warnings.unshift(...selection.warnings);
  const normalizedPreferences = normalizeRankingPreferences(preferences);
  const base = { coverage, criteriaUsed: { constraints: [], preferences: normalizedPreferences, unverifiable: [] }, limits: { maxListings: config.maxListings, requested: selection.ids.length } };
  if (selection.ids.length < P.MIN_LISTINGS) return emptyResult('insufficient', mode, config, { ...base, warnings, errors: [{ code: 'NOT_ENOUGH_LISTINGS' }] });

  let records;
  try {
    const resolve = dependencies.resolvePublicListings || defaultResolver();
    records = await resolve(selection.ids.map((item) => item.id));
  } catch {
    // Aucune information interne (URI, tenant, pile) ne sort du service.
    return emptyResult('error', mode, config, { ...base, warnings, errors: [{ code: 'COMPARISON_SOURCE_UNAVAILABLE' }] });
  }
  const available = []; const unavailable = [];
  for (const item of selection.ids) {
    const record = (Array.isArray(records) ? records : []).find((candidate) => isPubliclyEligible(candidate, item.id));
    if (record) available.push({ selection: item, record }); else unavailable.push({ id: item.id, code: 'LISTING_UNAVAILABLE' });
  }
  if (unavailable.length && mode === COMPARISON_MODE.RANKED) warnings.push(warning('LISTING_NO_LONGER_AVAILABLE', 'Un bien classé n’est plus disponible publiquement et a été écarté.'));
  if (available.length < P.MIN_LISTINGS) {
    return emptyResult('insufficient', mode, config, { ...base, warnings, unavailable, comparedIds: available.map((item) => item.selection.id), errors: [{ code: 'NOT_ENOUGH_LISTINGS' }] });
  }

  const entries = available.map(({ selection: item, record }, index) => {
    // Évaluation sur la seule projection publique, comme le classement IA-03C1 ; les faits bruts
    // ne servent qu'à signaler les valeurs invalides.
    const flat = flattenRecord(record);
    // Libellé issu de la projection publique approuvée, jamais d'une révision en attente.
    const label = P.toComparisonListing(flat).title || `Bien ${index + 1}`;
    const entry = P.buildComparisonEntry(flat, { criteria, preferences: normalizedPreferences, label, publicOnly: true });
    return { ...entry, matchStatus: item.matchStatus };
  });
  if (mode === COMPARISON_MODE.RANKED && entries.some((entry, index) => entry.ranking.score !== available[index].selection.sourceScore
    || entry.ranking.confidence !== available[index].selection.sourceConfidence)) {
    warnings.push(warning('RANKING_RECOMPUTED', 'Les scores ont été recalculés par IA-03C1 sur les données publiques actuelles.'));
  }
  if (entries.some((entry) => entry.issues.length)) warnings.push(warning('DATA_INCONSISTENT', 'Certaines valeurs publiées sont invalides et sont traitées comme inconnues.'));

  const comparability = P.assessComparability(entries);
  const tradeoffs = P.buildTradeoffs(entries, comparability);
  const conclusion = P.decideConclusion(entries, {
    comparability, hasPreferences: normalizedPreferences.length > 0,
    hasConstraints: entries.some((entry) => entry.constraintChecks.length > 0),
    coverageLimited: mode === COMPARISON_MODE.RANKED && coverage.complete === false,
  });
  const { order, ...publicConclusion } = conclusion;
  return {
    ...emptyResult('success', mode, config, base),
    comparedIds: entries.map((entry) => entry.id),
    items: entries.map((entry, index) => toItem(entry, available[index].selection, order.indexOf(entry.id) + 1)),
    unavailable,
    criteriaUsed: {
      constraints: [...new Set(entries.flatMap((entry) => entry.constraintChecks.map((check) => check.field)))],
      preferences: normalizedPreferences, unverifiable: entries[0].unverifiable.map((item) => ({ key: item.key, reason: item.reason })),
    },
    grid: P.buildComparisonGrid(entries), comparability,
    tradeoffs: tradeoffs.tradeoffs, hasTradeoffs: tradeoffs.hasTradeoffs, tradeoffSummary: tradeoffs.summary,
    conclusion: publicConclusion, warnings,
  };
}

/**
 * Composition interne IA-03A → IA-03B → IA-03C1 → IA-03C2 (mode résultats classés).
 * Le contexte est vérifié avant toute recherche.
 */
async function searchRankAndCompareFromText(input = {}, dependencies = {}) {
  const config = P.resolveComparisonConfig(dependencies.config);
  if (!ALLOWED_SCOPE_MODES.includes(input.context?.scopeMode)) {
    return emptyResult('forbidden', COMPARISON_MODE.RANKED, config, { errors: [{ code: 'UNRESOLVED_CONTEXT' }], warnings: [warning('UNRESOLVED_CONTEXT', 'Le contexte de sécurité ne peut pas être résolu.')] });
  }
  const searchAndRank = dependencies.searchAndRankRealEstateFromText || require('./personalizedSearchService').searchAndRankRealEstateFromText;
  const count = input.comparisonCount !== undefined ? input.comparisonCount : requestedComparisonCount(input.query) ?? DEFAULT_RANKED_COUNT;
  // IA-03C3 : la première page du classement global contient exactement les N meilleurs candidats évalués.
  const pageSize = Math.min(config.maxListings, Math.max(P.MIN_LISTINGS, Math.floor(Number(count)) || DEFAULT_RANKED_COUNT));
  const rankingResult = await searchAndRank({ ...input, pagination: { page: 1, limit: pageSize } }, {
    searchRealEstateFromText: dependencies.searchRealEstateFromText, searchDependencies: dependencies.searchDependencies,
    config: dependencies.candidateConfig,
  });
  return compareRealEstate({ mode: COMPARISON_MODE.RANKED, rankingResult, count, context: input.context }, dependencies);
}

module.exports = { compareRealEstate, searchRankAndCompareFromText, requestedComparisonCount, COMPARISON_MODE, ALLOWED_SCOPE_MODES, SCORE_NOTE };
