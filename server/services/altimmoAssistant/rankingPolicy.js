const C = require('./catalog');
const { AMENITY_STATE, classifyAmenity } = require('../altimmoRankingPolicyService');

const DEFAULT_WEIGHT = 100;
const MIN_WEIGHT = 10;
const MAX_WEIGHT = 500;
const SCORE_SCALE = 10000;
const PERIOD_BY_STATUS = Object.freeze({ vente: 'TOTAL', location: 'MONTH', hebergement: 'NIGHT' });
const MAX_ALTERNATIVE_OPTIONS = 4;
const MAX_OPTION_SIZE = 3;

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const boundedWeight = (value) => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(Number(value) || DEFAULT_WEIGHT)));

function canonicalAmenity(value) {
  const needle = fold(value);
  return Object.entries(C.AMENITIES).find(([key, aliases]) => key === needle || aliases.some((alias) => fold(alias) === needle))?.[0] || null;
}

function alternativeOptions(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_ALTERNATIVE_OPTIONS) return null;
  const options = raw.map((option) => (Array.isArray(option) && option.length >= 1 && option.length <= MAX_OPTION_SIZE
    ? [...new Set(option.map(canonicalAmenity))] : [null]));
  return options.every((option) => option.every(Boolean)) ? options : null;
}

function normalizeRankingPreferences(preferences = []) {
  if (!Array.isArray(preferences)) return [];
  const normalized = [];
  for (const raw of preferences) {
    if (typeof raw === 'string') {
      const key = canonicalAmenity(raw);
      if (key) normalized.push({ kind: 'AMENITY', key, weight: DEFAULT_WEIGHT });
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (raw.kind === 'AMENITY') {
      const key = canonicalAmenity(raw.key);
      if (key) normalized.push({ kind: 'AMENITY', key, weight: boundedWeight(raw.weight) });
    } else if (raw.kind === 'AMENITY_ANY') {
      // IA-03C4 (option A) : alternative « parking ou jardin » = une seule préférence, jamais un « et ».
      const options = alternativeOptions(raw.options);
      if (options) normalized.push({ kind: 'AMENITY_ANY', key: options.map((option) => option.join('+')).join('|'), options, weight: boundedWeight(raw.weight) });
    } else if (raw.kind === 'PRICE_TARGET'
      && Number.isFinite(Number(raw.target)) && Number(raw.target) >= 0
      && C.CURRENCIES.includes(raw.currency) && C.PERIODS.includes(raw.period)) {
      normalized.push({ kind: 'PRICE_TARGET', target: Number(raw.target), currency: raw.currency, period: raw.period, weight: boundedWeight(raw.weight) });
    }
  }
  const seen = new Set();
  return normalized.filter((item) => {
    const signature = `${item.kind}:${item.key || `${item.target}:${item.currency}:${item.period}`}`;
    if (seen.has(signature)) return false;
    seen.add(signature); return true;
  });
}

function canonicalListingAmenities(listing) {
  if (!Array.isArray(listing.amenities)) return listing.amenities;
  return listing.amenities.map(canonicalAmenity).filter(Boolean);
}

function amenityContribution(listing, preference) {
  const state = classifyAmenity(canonicalListingAmenities(listing), preference.key, { isComplete: listing.amenitiesComplete === true });
  const points = state === AMENITY_STATE.TRUE ? preference.weight : state === AMENITY_STATE.FALSE ? 0 : preference.weight / 2;
  return { ...preference, state, points, source: 'public_listing.amenities' };
}

// Une option est satisfaite si tous ses équipements sont confirmés ; l'alternative l'est si une option l'est.
function alternativeContribution(listing, preference) {
  const amenities = canonicalListingAmenities(listing); const isComplete = listing.amenitiesComplete === true;
  const optionStates = preference.options.map((option) => {
    const states = option.map((key) => classifyAmenity(amenities, key, { isComplete }));
    return states.every((value) => value === AMENITY_STATE.TRUE) ? AMENITY_STATE.TRUE
      : states.includes(AMENITY_STATE.FALSE) ? AMENITY_STATE.FALSE : AMENITY_STATE.UNKNOWN;
  });
  const state = optionStates.includes(AMENITY_STATE.TRUE) ? AMENITY_STATE.TRUE
    : optionStates.every((value) => value === AMENITY_STATE.FALSE) ? AMENITY_STATE.FALSE : AMENITY_STATE.UNKNOWN;
  const points = state === AMENITY_STATE.TRUE ? preference.weight : state === AMENITY_STATE.FALSE ? 0 : preference.weight / 2;
  return { ...preference, state, points, source: 'public_listing.amenities' };
}

function priceContribution(listing, preference, warnings) {
  const actualPeriod = PERIOD_BY_STATUS[listing.status];
  if (actualPeriod !== preference.period || preference.currency !== 'XAF' || !Number.isFinite(Number(listing.price))) {
    warnings.push({ code: 'INCOMPATIBLE_PRICE_PERIOD', field: 'price', message: 'Le prix public ne peut pas être comparé dans cette unité.' });
    return { ...preference, state: AMENITY_STATE.UNKNOWN, points: preference.weight / 2, source: null };
  }
  const state = Number(listing.price) === preference.target ? AMENITY_STATE.TRUE : AMENITY_STATE.FALSE;
  return { ...preference, state, points: state === AMENITY_STATE.TRUE ? preference.weight : 0, source: 'public_listing.price' };
}

function evaluateRankingCandidate(listing = {}, rawPreferences = []) {
  const preferences = normalizeRankingPreferences(rawPreferences);
  const warnings = [];
  const contributions = preferences.map((preference) => {
    if (preference.kind === 'AMENITY') return amenityContribution(listing, preference);
    if (preference.kind === 'AMENITY_ANY') return alternativeContribution(listing, preference);
    return priceContribution(listing, preference, warnings);
  });
  const possiblePoints = contributions.reduce((sum, item) => sum + item.weight, 0);
  const earnedPoints = contributions.reduce((sum, item) => sum + item.points, 0);
  const knownWeight = contributions.filter((item) => item.state !== AMENITY_STATE.UNKNOWN).reduce((sum, item) => sum + item.weight, 0);
  return {
    score: possiblePoints ? Math.round((earnedPoints / possiblePoints) * SCORE_SCALE) : 0,
    confidence: possiblePoints ? Math.round((knownWeight / possiblePoints) * SCORE_SCALE) : 0,
    earnedPoints, possiblePoints, contributions, warnings,
  };
}

module.exports = {
  DEFAULT_WEIGHT, MIN_WEIGHT, MAX_WEIGHT, SCORE_SCALE,
  normalizeRankingPreferences, evaluateRankingCandidate,
};
