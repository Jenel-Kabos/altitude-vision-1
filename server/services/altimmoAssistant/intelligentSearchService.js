const { parseRealEstateRequest, validateParsedRequest } = require('./ruleParser');
const { buildAllowedSearchRequests, evaluateListingConstraints } = require('./searchCriteriaAdapter');
const { toPublicListing, publicPagination } = require('../publicListingService');
const { DEFAULT_CANDIDATE_WINDOW } = require('../altimmoRankingPolicyService');

const ALLOWED_SCOPE_MODES = Object.freeze(['PUBLIC', 'TENANT', 'PLATFORM', 'UNRESOLVED']);
// IA-03C3 — plafond interne validé par la direction : 1 000 candidats évalués, configurable à la baisse.
const MAX_INTERNAL_CANDIDATES = 1000;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 250;
const SCAN_FACTOR = 2; // documents parcourus au plus : 2 × plafond (doublons et rejets compris)
const LEGACY_PAGE_SIZE = 50;
const warning = (code, message) => ({ code, message });
const idOf = (listing) => String(listing?.id || listing?._id || '');

function resolveCandidateConfig(config = {}) {
  const bounded = (value, fallback, max) => {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= 1 ? Math.min(max, number) : fallback;
  };
  const maxCandidates = bounded(config?.maxCandidates, MAX_INTERNAL_CANDIDATES, MAX_INTERNAL_CANDIDATES);
  return { maxCandidates, batchSize: bounded(config?.batchSize, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE), maxScanned: maxCandidates * SCAN_FACTOR };
}

// Fenêtre historique du contrat public IA-03B (inchangée) : 250 candidats.
const PUBLIC_COLLECTION = Object.freeze({ maxCandidates: DEFAULT_CANDIDATE_WINDOW, batchSize: LEGACY_PAGE_SIZE, maxScanned: DEFAULT_CANDIDATE_WINDOW * SCAN_FACTOR });

function emptyResult(parsed, status, warnings = []) {
  return {
    status, intent: parsed?.criteria?.transaction || null, interpretedCriteria: parsed?.criteria || null,
    appliedCriteria: [], unverifiableCriteria: [], unsupportedCriteria: [], ambiguities: parsed?.ambiguities || [],
    clarificationQuestions: parsed?.clarificationQuestions || [], preferences: [], results: [], candidatesToVerify: [],
    total: 0, verificationTotal: 0, pagination: { page: 1, limit: 10, pages: 0 }, coverage: { evaluated: 0, sourceTotal: 0, complete: true, limit: DEFAULT_CANDIDATE_WINDOW }, warnings,
  };
}

function defaultDependencies() {
  // Chargement tardif : les tests unitaires injectent des sources sans initialiser Mongoose.
  return require('./searchSource');
}

/** Source historique paginée (searchProperties/searchAccommodations) : conservée pour les sources injectées. */
async function collectLegacy(requests, dependencies, limits) {
  const byId = new Map(); let sourceTotal = 0; let scanned = 0; let readCalls = 0;
  for (const baseRequest of requests) {
    if (byId.size >= limits.maxCandidates) break;
    const source = baseRequest.offerType === 'hebergement' ? dependencies.searchAccommodations : dependencies.searchProperties;
    let page = 1; let requestTotal = 0;
    do {
      const response = await source({ ...baseRequest, page: String(page), limit: String(LEGACY_PAGE_SIZE) });
      readCalls += 1;
      if (page === 1) { requestTotal = Math.max(0, Number(response.total) || 0); sourceTotal += requestTotal; }
      for (const item of response.properties || []) {
        scanned += 1;
        const id = idOf(item); if (id && !byId.has(id) && byId.size < limits.maxCandidates) byId.set(id, item);
      }
      page += 1;
    } while ((page - 1) * LEGACY_PAGE_SIZE < requestTotal && byId.size < limits.maxCandidates);
  }
  return {
    candidates: [...byId.values()], sourceTotal, scanned, readCalls, mongoTotalExact: requests.length === 1,
    complete: sourceTotal <= limits.maxCandidates, scanLimitReached: false,
  };
}

/** IA-03C3 : lecture par lots à curseur, bornée en candidats évalués et en documents parcourus. */
async function collectScanned(requests, dependencies, limits) {
  const byId = new Map(); let sourceTotal = 0; let scanned = 0; let readCalls = 0;
  let complete = true; let scanLimitReached = false; let totalsExact = true;
  for (const request of requests) {
    if (byId.size >= limits.maxCandidates || scanned >= limits.maxScanned) { complete = false; break; }
    let cursor = null; let exhausted = false;
    while (byId.size < limits.maxCandidates && scanned < limits.maxScanned) {
      const response = await dependencies.scanCandidates(request, { cursor, batchSize: limits.batchSize });
      readCalls += 1;
      if (cursor === null) {
        sourceTotal += Math.max(0, Number(response.total) || 0);
        if (response.totalExact === false) totalsExact = false;
      }
      const items = Array.isArray(response.items) ? response.items : [];
      scanned += Number.isFinite(response.scanned) ? response.scanned : items.length;
      let overflow = false;
      for (const item of items) {
        const id = idOf(item);
        if (!id || byId.has(id)) continue;
        if (byId.size >= limits.maxCandidates) { overflow = true; continue; }
        byId.set(id, item);
      }
      if (response.nextCursor === null || response.nextCursor === undefined) { exhausted = !overflow; break; }
      cursor = response.nextCursor;
    }
    if (!exhausted) {
      complete = false;
      if (scanned >= limits.maxScanned && byId.size < limits.maxCandidates) scanLimitReached = true;
    }
  }
  return {
    candidates: [...byId.values()], sourceTotal, scanned, readCalls, mongoTotalExact: totalsExact && requests.length === 1,
    complete, scanLimitReached,
  };
}

/**
 * @param {object[]} requests requêtes fermées issues de l'adaptateur IA-03B
 * @param {object} dependencies `scanCandidates` (lecture par lots) ou sources historiques paginées
 * @param {{maxCandidates?:number,batchSize?:number,maxScanned?:number}} [limits]
 */
async function collectCandidates(requests, dependencies, limits = PUBLIC_COLLECTION) {
  return typeof dependencies.scanCandidates === 'function'
    ? collectScanned(requests, dependencies, limits)
    : collectLegacy(requests, dependencies, limits);
}

function stableSort(listings) {
  return listings.sort(compareListings);
}

function compareListings(left, right) {
  const dateDifference = new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  return dateDifference || idOf(left).localeCompare(idOf(right));
}

/** Cœur commun : contexte, analyse, collecte bornée, contraintes obligatoires, séparation exacts / à vérifier. */
async function evaluateSearch(input, dependencies, limits) {
  const scopeMode = input.context?.scopeMode || 'PUBLIC';
  const parsed = parseRealEstateRequest(input.query, { referenceDate: input.context?.referenceDate });
  if (!ALLOWED_SCOPE_MODES.includes(scopeMode) || scopeMode === 'UNRESOLVED') {
    return { early: emptyResult(parsed, 'forbidden', [warning('UNRESOLVED_CONTEXT', 'Le contexte de sécurité ne peut pas être résolu.')]) };
  }
  const validation = validateParsedRequest(parsed);
  if (!validation.valid) return { early: emptyResult(parsed, 'invalid', validation.errors.map((message) => warning('INVALID_CRITERIA', message))) };
  if (parsed.status !== 'recognized' || parsed.ambiguities.length || parsed.contradictions.length || parsed.alternatives.length > 1) {
    return { early: emptyResult(parsed, 'needs_clarification', [warning('BLOCKING_AMBIGUITY', 'La demande doit être clarifiée avant toute recherche.')]) };
  }
  const adapted = buildAllowedSearchRequests(parsed.criteria);
  if (!adapted.requests.length || adapted.blockingIssues.length) {
    const out = emptyResult(parsed, 'needs_clarification', adapted.blockingIssues);
    return { early: { ...out, appliedCriteria: adapted.appliedCriteria, unverifiableCriteria: adapted.unverifiableCriteria, unsupportedCriteria: adapted.unsupportedCriteria } };
  }
  const sources = dependencies || defaultDependencies();
  const collection = await collectCandidates(adapted.requests, sources, limits);
  const matches = []; const verify = []; const dynamicUnverifiable = [];
  for (const candidate of collection.candidates) {
    // Défense en profondeur : même une source injectée ne peut faire passer une annonce privée.
    if (candidate.isPublished !== true || candidate.statusAdmin !== 'Validée' || candidate.availability !== 'Disponible') continue;
    const evaluation = evaluateListingConstraints(candidate, parsed.criteria);
    if (evaluation.classification === 'REJECT') continue;
    const projected = toPublicListing(candidate);
    if (evaluation.classification === 'VERIFY') {
      const unknown = evaluation.checks.filter((check) => check.state === 'UNKNOWN');
      verify.push({ listing: projected, unknownCriteria: unknown });
      for (const check of unknown) if (!dynamicUnverifiable.some((item) => item.field === check.field)) dynamicUnverifiable.push({ code: 'CRITERION_UNKNOWN', field: check.field, message: 'Critère non vérifiable avec les données disponibles.' });
    } else matches.push(projected);
  }
  stableSort(matches);
  verify.sort((a, b) => compareListings(a.listing, b.listing));
  const warnings = [];
  if (!matches.length) warnings.push(warning('NO_EXACT_MATCH', 'Aucune annonce ne satisfait toutes les contraintes vérifiables.'));
  if (!collection.complete) warnings.push(warning('CATALOG_COVERAGE_LIMITED', 'La recherche a évalué une fenêtre bornée du catalogue.'));
  if (collection.scanLimitReached) warnings.push(warning('SCAN_LIMIT_REACHED', 'La lecture a atteint la borne de documents parcourus.'));
  return { parsed, adapted, collection, matches, verify, dynamicUnverifiable, warnings };
}

function commonFields({ parsed, adapted, dynamicUnverifiable, matches, verify, warnings }) {
  return {
    status: 'success', intent: parsed.criteria.transaction, interpretedCriteria: parsed.criteria,
    appliedCriteria: adapted.appliedCriteria, unverifiableCriteria: [...adapted.unverifiableCriteria, ...dynamicUnverifiable],
    unsupportedCriteria: adapted.unsupportedCriteria, ambiguities: parsed.ambiguities,
    clarificationQuestions: parsed.clarificationQuestions, preferences: [...parsed.criteria.amenities.preferred],
    preferenceAlternatives: (parsed.amenityAlternatives || []).filter((item) => item.modality === 'preferred').map((item) => ({ options: item.options })),
    total: matches.length, verificationTotal: verify.length, warnings,
  };
}

/**
 * Point d'entrée interne IA-03B (contrat public paginé, fenêtre de 250 inchangée).
 * Ne crée aucune route et n'exécute aucune action métier.
 * @param {{query:string,context?:object,pagination?:object}} input
 * @param {{scanCandidates?:Function,searchProperties?:Function,searchAccommodations?:Function}} [dependencies]
 */
async function searchRealEstateFromText(input = {}, dependencies = null) {
  const evaluated = await evaluateSearch(input, dependencies, PUBLIC_COLLECTION);
  if (evaluated.early) return evaluated.early;
  const { matches, verify, collection } = evaluated;
  const { page, limit, skip } = publicPagination(input.pagination || {});
  return {
    ...commonFields(evaluated),
    results: matches.slice(skip, skip + limit), candidatesToVerify: verify.slice(skip, skip + limit),
    pagination: { page, limit, pages: Math.ceil(matches.length / limit) },
    coverage: { evaluated: collection.candidates.length, sourceTotal: collection.sourceTotal, complete: collection.complete, limit: PUBLIC_COLLECTION.maxCandidates },
  };
}

/**
 * IA-03C3 — contrat interne : tous les candidats évalués (non paginés), déjà projetés, séparés en
 * correspondances exactes et candidats à vérifier, avec une couverture détaillée. Destiné au classement.
 * @param {{query:string,context?:object}} input
 * @param {object} [dependencies] sources de lecture
 * @param {{maxCandidates?:number,batchSize?:number}} [config] configuration serveur (jamais issue du client)
 */
async function searchRealEstateCandidatesFromText(input = {}, dependencies = null, config = {}) {
  const limits = resolveCandidateConfig(config);
  const evaluated = await evaluateSearch(input, dependencies, limits);
  if (evaluated.early) {
    const { results: _results, candidatesToVerify: _verify, pagination: _pagination, ...rest } = evaluated.early;
    return { ...rest, matches: [], candidatesToVerify: [], coverage: { ...rest.coverage, limit: limits.maxCandidates } };
  }
  const { matches, verify, collection } = evaluated;
  return {
    ...commonFields(evaluated), matches, candidatesToVerify: verify,
    coverage: {
      // A. total MongoDB des filtres appliqués en base (exact pour une seule requête Property)
      mongoMatchedTotal: collection.sourceTotal, mongoTotalExact: collection.mongoTotalExact, sourceTotal: collection.sourceTotal,
      // C. documents évalués et parcourus ; B. admissibles confirmés parmi les évalués
      evaluated: collection.candidates.length, scanned: collection.scanned, readCalls: collection.readCalls,
      admissible: matches.length, toVerify: verify.length,
      complete: collection.complete, admissibleTotalExact: collection.complete,
      limit: limits.maxCandidates, batchSize: limits.batchSize, maxScanned: limits.maxScanned,
    },
  };
}

module.exports = {
  searchRealEstateFromText, searchRealEstateCandidatesFromText, resolveCandidateConfig, collectCandidates,
  stableSort, compareListings, ALLOWED_SCOPE_MODES, MAX_INTERNAL_CANDIDATES,
};
