const AMENITY_STATE = Object.freeze({ TRUE: 'TRUE', FALSE: 'FALSE', UNKNOWN: 'UNKNOWN' });
const DEFAULT_CANDIDATE_WINDOW = 250;

function classifyAmenity(amenities, requested, { isComplete = false } = {}) {
  if (!Array.isArray(amenities)) return AMENITY_STATE.UNKNOWN;
  const needle = String(requested || '').trim().toLocaleLowerCase('fr');
  const present = amenities.some((value) => String(value || '').trim().toLocaleLowerCase('fr') === needle);
  if (present) return AMENITY_STATE.TRUE;
  return isComplete ? AMENITY_STATE.FALSE : AMENITY_STATE.UNKNOWN;
}

function scoreAmenityPreference(state) {
  if (state === AMENITY_STATE.TRUE) return { score: 1, confidence: 1 };
  if (state === AMENITY_STATE.FALSE) return { score: 0, confidence: 1 };
  return { score: 0.5, confidence: 0 };
}

function selectCandidateWindow(listings, { mandatoryMatch, preliminaryScore }, { maxCandidates = DEFAULT_CANDIDATE_WINDOW } = {}) {
  if (!Array.isArray(listings)) return [];
  const eligible = listings.filter((item) => mandatoryMatch(item));
  eligible.sort((left, right) => {
    const scoreDifference = Number(preliminaryScore(right) || 0) - Number(preliminaryScore(left) || 0);
    if (scoreDifference) return scoreDifference;
    return String(left.id || left._id || '').localeCompare(String(right.id || right._id || ''));
  });
  return eligible.slice(0, Math.max(1, Math.floor(Number(maxCandidates)) || DEFAULT_CANDIDATE_WINDOW));
}

module.exports = {
  AMENITY_STATE,
  DEFAULT_CANDIDATE_WINDOW,
  classifyAmenity,
  scoreAmenityPreference,
  selectCandidateWindow,
};
