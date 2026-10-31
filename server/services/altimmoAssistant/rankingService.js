const { toPublicListing } = require('../publicListingService');
const { DEFAULT_CANDIDATE_WINDOW } = require('../altimmoRankingPolicyService');
const { evaluateRankingCandidate, normalizeRankingPreferences } = require('./rankingPolicy');
const { buildRankingExplanation } = require('./rankingExplanation');

const ALLOWED_SCOPE_MODES = Object.freeze(['PUBLIC', 'TENANT', 'PLATFORM']);
const idOf = (listing) => String(listing?.id || listing?._id || '').trim();

function sanitizeUnknownCriteria(criteria) {
  if (!Array.isArray(criteria)) return [];
  return criteria.filter((item) => item && typeof item.field === 'string' && /^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(item.field) && ['TRUE', 'FALSE', 'UNKNOWN'].includes(item.state))
    .map((item) => ({ field: item.field.slice(0, 100), state: item.state }));
}

function safeListing(listing) {
  const id = idOf(listing);
  return toPublicListing({ ...listing, _id: id });
}

function rankedItem(listing, preferences, extra = {}) {
  const projected = safeListing(listing);
  const evaluation = evaluateRankingCandidate(projected, preferences);
  return {
    listing: projected,
    score: evaluation.score,
    confidence: evaluation.confidence,
    satisfiedPreferences: evaluation.contributions.filter((item) => item.state === 'TRUE').map((item) => item.key || item.kind),
    unsatisfiedPreferences: evaluation.contributions.filter((item) => item.state === 'FALSE').map((item) => item.key || item.kind),
    unknownPreferences: evaluation.contributions.filter((item) => item.state === 'UNKNOWN').map((item) => item.key || item.kind),
    explanation: buildRankingExplanation(evaluation),
    ...extra,
  };
}

function compareRanked(left, right) {
  const scoreDifference = right.score - left.score;
  if (scoreDifference) return scoreDifference;
  const confirmedDifference = right.satisfiedPreferences.length - left.satisfiedPreferences.length;
  if (confirmedDifference) return confirmedDifference;
  return idOf(left.listing).localeCompare(idOf(right.listing));
}

function baseOutput(searchResult, rankingStatus, rankingWarnings = []) {
  const preserved = {};
  for (const key of [
    'status', 'intent', 'interpretedCriteria', 'appliedCriteria', 'unverifiableCriteria', 'unsupportedCriteria',
    'ambiguities', 'clarificationQuestions', 'preferences', 'total', 'verificationTotal', 'pagination', 'coverage', 'warnings',
  ]) if (searchResult?.[key] !== undefined) preserved[key] = searchResult[key];
  return { ...preserved, rankingStatus, rankedResults: [], rankedCandidatesToVerify: [], rankingWarnings };
}

const MAX_RANKING_WINDOW = 1000;
const rankingWindow = (value) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 1 ? Math.min(MAX_RANKING_WINDOW, number) : DEFAULT_CANDIDATE_WINDOW;
};

/**
 * @param {{searchResult:object,preferences?:Array,context?:object,options?:{maxCandidates?:number}}} input
 * `options.maxCandidates` : fenêtre de classement fixée côté serveur (250 par défaut, 1 000 au plus).
 */
function rankRealEstateResults({ searchResult, preferences, context = {}, options = {} } = {}) {
  const windowLimit = rankingWindow(options.maxCandidates);
  if (!searchResult || searchResult.status !== 'success' || context.scopeMode === 'UNRESOLVED'
    || context.scopeMode && !ALLOWED_SCOPE_MODES.includes(context.scopeMode)) {
    return baseOutput(searchResult || {}, 'not_ranked', [{ code: 'RANKING_INPUT_REJECTED', message: 'Le résultat de recherche ne peut pas être classé.' }]);
  }
  const normalizedPreferences = normalizeRankingPreferences(preferences === undefined ? searchResult.preferences : preferences);
  const rankingWarnings = []; const seen = new Set(); let accepted = 0;
  const take = (listing, extra) => {
    const id = idOf(listing);
    if (!id) { rankingWarnings.push({ code: 'MISSING_CANDIDATE_ID', message: 'Un candidat sans identifiant public a été ignoré.' }); return null; }
    if (listing?.isPublished !== true || listing?.statusAdmin !== 'Validée' || listing?.availability !== 'Disponible') {
      rankingWarnings.push({ code: 'INELIGIBLE_CANDIDATE', message: 'Un candidat non admissible a été ignoré.' });
      return null;
    }
    if (seen.has(id)) { rankingWarnings.push({ code: 'DUPLICATE_CANDIDATE_ID', message: 'Un candidat dupliqué a été ignoré.' }); return null; }
    if (accepted >= windowLimit) return null;
    seen.add(id); accepted += 1;
    return rankedItem(listing, normalizedPreferences, extra);
  };
  const rankedResults = [];
  for (const listing of Array.isArray(searchResult.results) ? searchResult.results : []) {
    const ranked = take(listing); if (ranked) rankedResults.push(ranked);
  }
  const rankedCandidatesToVerify = [];
  for (const candidate of Array.isArray(searchResult.candidatesToVerify) ? searchResult.candidatesToVerify : []) {
    const ranked = take(candidate?.listing, { unknownCriteria: sanitizeUnknownCriteria(candidate?.unknownCriteria) });
    if (ranked) rankedCandidatesToVerify.push(ranked);
  }
  const inputCount = (searchResult.results?.length || 0) + (searchResult.candidatesToVerify?.length || 0);
  if (inputCount > windowLimit) rankingWarnings.push({ code: 'RANKING_WINDOW_TRUNCATED', message: 'Le classement est borné à la fenêtre IA-03B.' });
  rankedResults.sort(compareRanked).forEach((item, index) => { item.position = index + 1; });
  rankedCandidatesToVerify.sort(compareRanked).forEach((item, index) => { item.position = index + 1; });
  return {
    ...baseOutput(searchResult, 'ranked', rankingWarnings),
    normalizedPreferences, rankedResults, rankedCandidatesToVerify,
    rankingCoverage: {
      evaluated: accepted,
      complete: searchResult.coverage?.complete !== false && inputCount <= windowLimit,
      limit: windowLimit,
      sourceCoverage: searchResult.coverage || null,
    },
  };
}

module.exports = { rankRealEstateResults, compareRanked };
