// IA-03C2 — Politique de comparaison déterministe. Aucun second moteur de score :
// les scores viennent de rankingPolicy (IA-03C1), les contraintes de searchCriteriaAdapter (IA-03B).
const C = require('./catalog');
const { emptyCriteria } = require('./criteria');
const { evaluateListingConstraints, EXPECTED_PERIOD } = require('./searchCriteriaAdapter');
const { evaluateRankingCandidate, normalizeRankingPreferences, SCORE_SCALE } = require('./rankingPolicy');
const { toPublicListing } = require('../publicListingService');
const X = require('./comparisonExplanation');
const { isAmbiguousZero } = require('./listingFacts');

const DEFAULT_MAX_LISTINGS = 5;
const MIN_LISTINGS = 2;
const ABSOLUTE_MAX_LISTINGS = 10;
const CATEGORY = Object.freeze({ SALE: 'SALE', RENTAL: 'RENTAL', HOTEL: 'HOTEL', FURNISHED: 'FURNISHED', LODGING_OTHER: 'LODGING_OTHER', UNKNOWN: 'UNKNOWN' });
const COMPARABILITY = Object.freeze({ COMPARABLE: 'COMPARABLE', PARTIALLY_COMPARABLE: 'PARTIALLY_COMPARABLE', NOT_COMPARABLE: 'NOT_COMPARABLE' });
const PERIOD_BY_STATUS = Object.freeze({ vente: 'TOTAL', location: 'MONTH', hebergement: 'NIGHT' });
const HOTEL_TYPES = Object.freeze(['hotel', 'residence_hoteliere', 'chambre_hotes']);
const OCCUPANCY_MODES = Object.freeze(['entire_place', 'room_based']);
const STAY_TYPES = Object.freeze(['SHORT_TERM', 'LONG_TERM']);
const FACT_LIMITS = Object.freeze({ bedrooms: 100, bathrooms: 100, surface: 1_000_000, livingRooms: 100 });
const CATEGORY_LABELS = Object.freeze({ SALE: 'Vente', RENTAL: 'Location', HOTEL: 'Hôtel', FURNISHED: 'Meublé', LODGING_OTHER: 'Autre hébergement', UNKNOWN: 'Non renseigné' });
const OFFER_LABELS = Object.freeze({ vente: 'Vente', location: 'Location', hebergement: 'Hébergement' });
const NEED_DISPLAY = Object.freeze({ TRUE: 'Confirmé', FALSE: 'Non satisfait', UNKNOWN: 'À vérifier', NOT_APPLICABLE: 'Non applicable' });
const UNKNOWN_DISPLAY = 'Non renseigné';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= C.MAX_AMOUNT;
const boundedInt = (value, min, max) => (Number.isSafeInteger(value) && value >= min && value <= max ? value : null);
const shortString = (value, max = 80) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null);
const unique = (values) => [...new Set(values)];

function canonicalAmenity(value) {
  if (typeof value !== 'string') return null;
  const needle = fold(value);
  return Object.entries(C.AMENITIES).find(([key, aliases]) => key === needle || aliases.some((alias) => fold(alias) === needle))?.[0] || null;
}

function resolveComparisonConfig(config = {}) {
  const requested = Math.floor(Number(config?.maxListings));
  if (!Number.isFinite(requested)) return { maxListings: DEFAULT_MAX_LISTINGS };
  return { maxListings: Math.min(ABSOLUTE_MAX_LISTINGS, Math.max(MIN_LISTINGS, requested)) };
}

// ── Critères ───────────────────────────────────────────────────────────────

function range(raw, max) {
  return { min: boundedInt(raw?.min, 0, max), max: boundedInt(raw?.max, 0, max) };
}

function proximityList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.filter((item) => isPlainObject(item) && Object.hasOwn(C.PROXIMITIES, item.category) && !seen.has(item.category)
    && typeof item.maxMeters === 'number' && item.maxMeters > 0 && item.maxMeters <= 50000 && seen.add(item.category))
    .map((item) => ({ category: item.category, maxMeters: item.maxMeters }));
}

/** Reconstruit un critère IA-03A complet par liste blanche : aucune clé ni valeur forgée ne survit. */
function sanitizeComparisonCriteria(raw) {
  const out = emptyCriteria();
  if (!isPlainObject(raw)) return out;
  if (C.TRANSACTIONS.includes(raw.transaction)) out.transaction = raw.transaction;
  const listOf = (values, allowed) => (Array.isArray(values) ? unique(values.filter((value) => typeof value === 'string' && allowed.includes(value))) : []);
  out.propertyTypes = listOf(raw.propertyTypes, C.PROPERTY_TYPES);
  out.accommodationTypes = listOf(raw.accommodationTypes, C.ACCOMMODATION_TYPES);
  const location = isPlainObject(raw.location) ? raw.location : {};
  if (C.CITIES.includes(location.city)) out.location.city = location.city;
  const districts = out.location.city && C.DISTRICTS[out.location.city] ? C.DISTRICTS[out.location.city] : Object.values(C.DISTRICTS).flat();
  out.location.districts = listOf(location.districts, districts);
  out.location.preferredDistricts = listOf(location.preferredDistricts, districts);
  out.location.neighborhood = shortString(location.neighborhood);
  if (typeof location.radiusMeters === 'number' && location.radiusMeters > 0 && location.radiusMeters <= 50000) out.location.radiusMeters = location.radiusMeters;
  const budget = isPlainObject(raw.budget) ? raw.budget : {};
  out.budget = {
    min: boundedInt(budget.min, 0, C.MAX_AMOUNT), max: boundedInt(budget.max, 0, C.MAX_AMOUNT),
    currency: C.CURRENCIES.includes(budget.currency) ? budget.currency : null, period: C.PERIODS.includes(budget.period) ? budget.period : null,
  };
  out.bedrooms = range(raw.bedrooms, FACT_LIMITS.bedrooms);
  out.bathrooms = range(raw.bathrooms, FACT_LIMITS.bathrooms);
  out.surface = range(raw.surface, FACT_LIMITS.surface);
  out.floors = range(raw.floors, 200);
  const amenities = isPlainObject(raw.amenities) ? raw.amenities : {};
  for (const key of ['required', 'preferred', 'excluded']) {
    out.amenities[key] = Array.isArray(amenities[key]) ? unique(amenities[key].map(canonicalAmenity).filter(Boolean)) : [];
  }
  const proximity = isPlainObject(raw.proximity) ? raw.proximity : {};
  out.proximity = { required: proximityList(proximity.required), preferred: proximityList(proximity.preferred) };
  const stay = isPlainObject(raw.stay) ? raw.stay : {};
  const day = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
  out.stay = {
    checkIn: day(stay.checkIn), checkOut: day(stay.checkOut), nights: boundedInt(stay.nights, 1, 365),
    adults: boundedInt(stay.adults, 0, 50), children: boundedInt(stay.children, 0, 50), rooms: boundedInt(stay.rooms, 1, 50),
    stayType: STAY_TYPES.includes(stay.stayType) ? stay.stayType : null,
  };
  return out;
}

// ── Projection et faits ────────────────────────────────────────────────────

function factOf(raw, field) {
  const value = raw?.[field];
  if (value === undefined || value === null || value === '') return { state: 'UNKNOWN', value: null, issue: null };
  // DATA-READINESS-01 : 0 chambre ou salle de bain sur un logement = valeur par défaut, jamais affichée comme connue.
  if (isAmbiguousZero(raw, field)) return { state: 'UNKNOWN', value: null, issue: null };
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= FACT_LIMITS[field]) return { state: 'KNOWN', value, issue: null };
  return { state: 'UNKNOWN', value: null, issue: 'INVALID_VALUE' };
}

function capacityOf(value) {
  if (!isPlainObject(value)) return undefined;
  const maxAdults = boundedInt(value.maxAdults, 0, 500); const maxChildren = boundedInt(value.maxChildren, 0, 500);
  return maxAdults === null && maxChildren === null ? undefined : { ...(maxAdults !== null ? { maxAdults } : {}), ...(maxChildren !== null ? { maxChildren } : {}) };
}

/**
 * Projection de comparaison : liste blanche publique IA-02 puis faits d'hébergement typés.
 * Le prix générique Property.price n'est jamais conservé pour un hébergement.
 */
function toComparisonListing(raw = {}) {
  const base = toPublicListing({ ...raw, _id: raw._id || raw.id }) || {};
  const out = { id: String(base.id || raw.id || '') };
  const title = shortString(base.title, 200); if (title) out.title = title;
  for (const field of ['status', 'type', 'constructionType', 'availability']) { const value = shortString(base[field]); if (value) out[field] = value; }
  if (isPlainObject(base.address)) {
    const address = {};
    for (const field of ['neighborhood', 'arrondissement', 'city']) { const value = shortString(base.address[field]); if (value) address[field] = value; }
    out.address = address;
  }
  if (out.status !== 'hebergement' && isAmount(base.price)) out.price = base.price;
  for (const field of ['bedrooms', 'bathrooms', 'surface', 'livingRooms']) if (factOf(base, field).state === 'KNOWN') out[field] = base[field];
  if (typeof base.cautionMultiplicateur === 'number' && base.cautionMultiplicateur >= 0 && base.cautionMultiplicateur <= 24) out.cautionMultiplicateur = base.cautionMultiplicateur;
  if (Array.isArray(base.amenities)) out.amenities = unique(base.amenities.map(canonicalAmenity).filter(Boolean));
  if (Array.isArray(base.images) && typeof base.images[0] === 'string') out.image = base.images[0];
  if (C.ACCOMMODATION_TYPES.includes(raw.accommodationType)) out.accommodationType = raw.accommodationType;
  if (out.status === 'hebergement') {
    if (OCCUPANCY_MODES.includes(raw.occupancyMode)) out.occupancyMode = raw.occupancyMode;
    if (typeof raw.furnished === 'boolean') out.furnished = raw.furnished;
    const capacity = capacityOf(raw.capacity); if (capacity) out.capacity = capacity;
    for (const field of ['minimumStay', 'maximumStay']) { const value = boundedInt(raw[field], 1, 3650); if (value !== null) out[field] = value; }
    for (const [amount, currency] of [['searchPrice', 'searchCurrency'], ['monthlyPrice', 'monthlyCurrency']]) {
      if (typeof raw[amount] === 'number' && Number.isFinite(raw[amount])) out[amount] = raw[amount];
      const code = shortString(raw[currency], 3); if (code) out[currency] = code;
    }
    if (C.CURRENCIES.includes(raw.accommodationCurrency)) out.accommodationCurrency = raw.accommodationCurrency;
  }
  return out;
}

function categorizeListing(listing = {}) {
  if (listing.status === 'vente') return CATEGORY.SALE;
  if (listing.status === 'location') return CATEGORY.RENTAL;
  if (listing.status !== 'hebergement') return CATEGORY.UNKNOWN;
  if (HOTEL_TYPES.includes(listing.accommodationType) || listing.occupancyMode === 'room_based') return CATEGORY.HOTEL;
  if (!listing.accommodationType || listing.accommodationType === 'autre') return CATEGORY.LODGING_OTHER;
  return CATEGORY.FURNISHED;
}

const unknownPrice = (period, issue) => ({ state: 'UNKNOWN', amount: null, currency: null, period, source: null, issue });

function ratePrice(listing, amountField, currencyField, period, source) {
  const amount = listing[amountField]; const currency = listing[currencyField];
  if (amount === undefined || amount === null) return unknownPrice(period, 'RATE_UNAVAILABLE');
  if (!isAmount(amount) || !C.CURRENCIES.includes(currency)) return unknownPrice(period, 'INVALID_VALUE');
  if (listing.accommodationCurrency && listing.accommodationCurrency !== currency) return unknownPrice(period, 'CONTRADICTORY_CURRENCY');
  return { state: 'KNOWN', amount, currency, period, source, issue: null };
}

/** Prix applicable dans l'unité native du bien. Aucune conversion de période ni de devise. */
function pricingOf(listing = {}) {
  const period = PERIOD_BY_STATUS[listing.status];
  if (!period) return unknownPrice(null, 'PERIOD_UNKNOWN');
  // Property.price n'est pas une preuve de tarif nocturne : seul un RatePlan actif fait foi.
  if (listing.status === 'hebergement') return ratePrice(listing, 'searchPrice', 'searchCurrency', 'NIGHT', 'rate_plan.nightly');
  if (listing.price === undefined || listing.price === null) return unknownPrice(period, 'MISSING_VALUE');
  if (!isAmount(listing.price)) return unknownPrice(period, 'INVALID_VALUE');
  // Convention plateau IA-03B : les prix Property sont exprimés en XAF.
  return { state: 'KNOWN', amount: listing.price, currency: 'XAF', period, source: 'public_listing.price', issue: null };
}

function monthlyPricingOf(listing = {}) {
  if (listing.status !== 'hebergement') return { state: 'NOT_APPLICABLE', amount: null, currency: null, period: 'MONTH', source: null, issue: null };
  return ratePrice(listing, 'monthlyPrice', 'monthlyCurrency', 'MONTH', 'rate_plan.monthly');
}

// ── Entrée de comparaison ─────────────────────────────────────────────────

function budgetChecks(prices, criteria) {
  const checks = []; let budgetPrice = null;
  const budget = criteria.budget || {};
  const bounds = [['budget.min', budget.min, (actual, bound) => actual >= bound], ['budget.max', budget.max, (actual, bound) => actual <= bound]];
  if (bounds.every(([, bound]) => bound === null || bound === undefined)) return { checks, budgetPrice };
  const period = budget.period || EXPECTED_PERIOD[criteria.transaction] || null;
  const currency = budget.currency || 'XAF';
  const known = prices.filter((price) => price.state === 'KNOWN');
  const sameUnit = known.find((price) => price.period === period);
  let reason = null;
  if (!period) reason = 'BUDGET_PERIOD_UNKNOWN';
  else if (!known.length) reason = 'PRICE_UNKNOWN';
  else if (!sameUnit) reason = 'INCOMPARABLE_PRICE_UNIT';
  else if (sameUnit.currency !== currency) reason = 'INCOMPARABLE_CURRENCY';
  else budgetPrice = sameUnit;
  for (const [field, bound, test] of bounds) {
    if (bound === null || bound === undefined) continue;
    checks.push(reason ? { field, state: 'UNKNOWN', reason } : { field, state: test(budgetPrice.amount, bound) ? 'TRUE' : 'FALSE' });
  }
  return { checks, budgetPrice };
}

function unverifiableNeeds(criteria) {
  const out = [];
  for (const requirement of ['required', 'preferred']) {
    for (const item of criteria.proximity?.[requirement] || []) {
      if (!out.some((x) => x.category === item.category)) out.push({ key: `proximity.${item.category}`, category: item.category, requirement, reason: 'POI_CATALOG_UNAVAILABLE' });
    }
  }
  if (criteria.location?.radiusMeters) out.push({ key: 'radius', category: null, requirement: 'required', reason: 'RADIUS_WITHOUT_REFERENCE_COORDINATES' });
  return out;
}

const contributionCriterion = (item) => (item.kind === 'AMENITY' ? `amenity.${item.key}` : item.kind === 'AMENITY_ANY' ? `amenity_any.${item.key}` : 'price_target');

function rankingOf(listing, preferences) {
  const evaluation = evaluateRankingCandidate(listing, preferences);
  const keys = (state) => evaluation.contributions.filter((item) => item.state === state).map((item) => item.key || item.kind);
  const weight = (state) => evaluation.contributions.filter((item) => item.state === state).reduce((sum, item) => sum + item.weight, 0);
  const possible = evaluation.possiblePoints;
  return {
    source: 'IA-03C1', basis: preferences.length ? 'PREFERENCES' : 'NO_PREFERENCES',
    score: evaluation.score, confidence: evaluation.confidence,
    // Intervalle explicite : pire cas (inconnues = 0) et meilleur cas (inconnues = satisfaites).
    scoreRange: possible ? { min: Math.round((weight('TRUE') / possible) * SCORE_SCALE), max: Math.round(((weight('TRUE') + weight('UNKNOWN')) / possible) * SCORE_SCALE) } : null,
    confirmed: keys('TRUE'), unsatisfied: keys('FALSE'), toVerify: keys('UNKNOWN'),
    contributions: evaluation.contributions.map((item) => ({ criterion: contributionCriterion(item), kind: item.kind, key: item.key || null, weight: item.weight, state: item.state, source: item.source || null })),
    rawContributions: evaluation.contributions,
  };
}

function dedupeTexts(items) {
  const seen = new Set();
  return items.filter((item) => item && !seen.has(item.text) && seen.add(item.text));
}

/**
 * Construit l'entrée comparée d'un bien déjà résolu côté serveur.
 * @param {object} item annonce (projection publique ou faits serveur typés)
 * @param {{criteria?:object,preferences?:Array,label?:string,publicOnly?:boolean}} options
 */
function buildComparisonEntry(item = {}, { criteria, preferences = [], label, publicOnly = false } = {}) {
  const crit = sanitizeComparisonCriteria(criteria);
  const prefs = normalizeRankingPreferences(preferences);
  const listing = toComparisonListing(item);
  const facts = { surface: factOf(item, 'surface'), bedrooms: factOf(item, 'bedrooms'), bathrooms: factOf(item, 'bathrooms') };
  const price = pricingOf(listing);
  const monthlyPrice = monthlyPricingOf(listing);
  const issues = [];
  for (const [field, fact] of Object.entries(facts)) if (fact.issue) issues.push({ field, code: fact.issue });
  if (['INVALID_VALUE', 'CONTRADICTORY_CURRENCY'].includes(price.issue)) issues.push({ field: 'price', code: price.issue });
  // Faits d'évaluation : uniquement les valeurs validées. Une valeur invalide devient inconnue, jamais comparée.
  // publicOnly : seule la projection publique est évaluée (aucun indicateur interne tel que amenitiesComplete).
  const evaluated = {
    ...(publicOnly ? {} : item), ...listing,
    bedrooms: facts.bedrooms.value ?? undefined, bathrooms: facts.bathrooms.value ?? undefined, surface: facts.surface.value ?? undefined,
    price: price.state === 'KNOWN' ? price.amount : undefined,
    capacity: listing.capacity, minimumStay: listing.minimumStay, maximumStay: listing.maximumStay,
  };
  const budget = budgetChecks([price, monthlyPrice], crit);
  const withoutBudget = { ...crit, budget: { min: null, max: null, currency: null, period: null } };
  const constraintChecks = [...evaluateListingConstraints(evaluated, withoutBudget).checks, ...budget.checks];
  const constraintStatus = !constraintChecks.length ? 'NO_CONSTRAINTS'
    : constraintChecks.some((check) => check.state === 'FALSE') ? 'NOT_MATCHING'
      : constraintChecks.some((check) => check.state === 'UNKNOWN') ? 'TO_VERIFY' : 'MATCHING';
  const unverifiable = unverifiableNeeds(crit);
  const ranking = rankingOf(evaluated, prefs);
  const described = [
    ...constraintChecks.map((check) => X.describeCheck(check, listing, { criteria: crit, budgetPrice: budget.budgetPrice })),
    ...ranking.rawContributions.map(X.describeContribution),
  ].filter(Boolean);
  const advantages = dedupeTexts(described.filter((item) => item.state === 'TRUE'));
  const disadvantages = dedupeTexts(described.filter((item) => item.state === 'FALSE'));
  const unknowns = dedupeTexts([...described.filter((item) => item.state === 'UNKNOWN'), ...unverifiable.map(X.describeUnverifiable)]);
  delete ranking.rawContributions;
  const hasNeeds = Boolean(constraintChecks.length || prefs.length || unverifiable.length);
  return {
    id: listing.id, label: shortString(label, 120) || listing.title || 'Bien', category: categorizeListing(listing), listing,
    price, monthlyPrice, facts, issues, constraintChecks, constraintStatus, unverifiable, ranking,
    advantages, disadvantages, unknowns, summary: X.entrySummary({ hasNeeds, advantages, disadvantages, unknowns }),
  };
}

// ── Comparabilité ─────────────────────────────────────────────────────────

function priceDimension(entries) {
  const prices = entries.map((entry) => entry.price);
  const groups = [];
  entries.forEach((entry) => {
    if (entry.price.state !== 'KNOWN') return;
    const group = groups.find((item) => item.period === entry.price.period && item.currency === entry.price.currency);
    if (group) group.ids.push(entry.id); else groups.push({ period: entry.price.period, currency: entry.price.currency, ids: [entry.id] });
  });
  const unknown = prices.find((price) => price.state !== 'KNOWN');
  if (unknown) return { comparable: false, reason: unknown.issue === 'PERIOD_UNKNOWN' ? 'PERIOD_UNKNOWN' : 'PRICE_UNKNOWN', groups };
  if (new Set(prices.map((price) => price.period)).size > 1) return { comparable: false, reason: 'PRICE_PERIOD_DIFFERS', groups };
  if (new Set(prices.map((price) => price.currency)).size > 1) return { comparable: false, reason: 'CURRENCY_DIFFERS', groups };
  return { comparable: true, groups };
}

function assessComparability(entries = []) {
  const reasons = [];
  const categories = entries.map((entry) => entry.category);
  if (new Set(entries.map((entry) => entry.listing.status || 'UNKNOWN')).size > 1) reasons.push('TRANSACTION_DIFFERS');
  const stays = entries.filter((entry) => entry.listing.status === 'hebergement');
  if (stays.length === entries.length && new Set(categories).size > 1) reasons.push('ACCOMMODATION_CATEGORY_DIFFERS');
  const price = priceDimension(entries);
  if (!price.comparable) reasons.push(price.reason);
  // Les chiffres d'un établissement hôtelier ne décrivent pas un logement entier.
  const hotelMix = categories.includes(CATEGORY.HOTEL) && categories.some((category) => category !== CATEGORY.HOTEL);
  const numeric = (field) => {
    if (hotelMix) return { comparable: false, reason: 'ACCOMMODATION_CATEGORY_DIFFERS' };
    return entries.filter((entry) => entry.facts[field].state === 'KNOWN').length >= MIN_LISTINGS ? { comparable: true } : { comparable: false, reason: 'INSUFFICIENT_DATA' };
  };
  const dimensions = { price, surface: numeric('surface'), bedrooms: numeric('bedrooms'), bathrooms: numeric('bathrooms') };
  const level = !Object.values(dimensions).some((dimension) => dimension.comparable) ? COMPARABILITY.NOT_COMPARABLE
    : reasons.length ? COMPARABILITY.PARTIALLY_COMPARABLE : COMPARABILITY.COMPARABLE;
  return { level, reasons: unique(reasons), dimensions };
}

// ── Grille ────────────────────────────────────────────────────────────────

const cell = (state, value = null, display = UNKNOWN_DISPLAY) => ({ state, value, display });
const known = (value, display) => (value === undefined || value === null || value === '' ? cell('UNKNOWN') : cell('KNOWN', value, display ?? String(value)));
const priceCell = (price) => (price.state === 'KNOWN'
  ? cell('KNOWN', { amount: price.amount, currency: price.currency, period: price.period }, X.formatPrice(price, 'grid'))
  : price.state === 'NOT_APPLICABLE' ? cell('NOT_APPLICABLE', null, 'Non applicable') : cell('UNKNOWN', null, price.period === 'NIGHT' ? 'Tarif non vérifié' : UNKNOWN_DISPLAY));
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

function capacityDisplay(capacity) {
  const parts = [];
  if (Number.isInteger(capacity.maxAdults)) parts.push(plural(capacity.maxAdults, 'adulte', 'adultes'));
  if (Number.isInteger(capacity.maxChildren)) parts.push(plural(capacity.maxChildren, 'enfant', 'enfants'));
  return parts.join(', ');
}

function stayRows(entries) {
  const forStay = (render) => entries.map((entry) => (entry.listing.status === 'hebergement' ? render(entry) : cell('NOT_APPLICABLE', null, 'Non applicable')));
  const state = (value) => cell(value, null, NEED_DISPLAY[value]);
  return [
    { key: 'stay.accommodationType', label: "Catégorie d'hébergement", values: forStay((e) => known(e.listing.accommodationType, X.ACCOMMODATION_LABELS[e.listing.accommodationType])) },
    { key: 'stay.capacity', label: 'Capacité', values: forStay((e) => (e.listing.capacity ? cell('KNOWN', e.listing.capacity, capacityDisplay(e.listing.capacity)) : cell('UNKNOWN'))) },
    { key: 'stay.nightlyRate', label: 'Tarif nocturne vérifié', values: forStay((e) => priceCell(e.price)) },
    { key: 'stay.monthlyRate', label: 'Tarif mensuel vérifié', values: forStay((e) => priceCell(e.monthlyPrice)) },
    { key: 'stay.minimumStay', label: 'Séjour minimum', values: forStay((e) => known(e.listing.minimumStay, e.listing.minimumStay && plural(e.listing.minimumStay, 'nuit', 'nuits'))) },
    { key: 'stay.maximumStay', label: 'Séjour maximum', values: forStay((e) => known(e.listing.maximumStay, e.listing.maximumStay && plural(e.listing.maximumStay, 'nuit', 'nuits'))) },
    { key: 'stay.shortStay', label: 'Séjour court', values: forStay((e) => state(e.price.state === 'KNOWN' ? 'TRUE' : e.listing.minimumStay >= 30 ? 'FALSE' : 'UNKNOWN')) },
    { key: 'stay.longStay', label: 'Séjour long', values: forStay((e) => state(e.monthlyPrice.state === 'KNOWN' ? 'TRUE' : e.listing.maximumStay < 28 ? 'FALSE' : 'UNKNOWN')) },
    // Disponibilité datée : aucun moteur de disponibilité vérifiée dans IA-03C2.
    { key: 'stay.datedAvailability', label: 'Disponibilité aux dates', values: forStay(() => cell('UNKNOWN', null, 'Non vérifiée')) },
  ].map((row) => ({ group: 'STAY', ...row }));
}

function needKey(field) {
  const amenity = /^amenities\.required\.([a-z_]+)$/.exec(field);
  if (amenity) return `need.amenity.${amenity[1]}`;
  const excluded = /^amenities\.excluded\.([a-z_]+)$/.exec(field);
  if (excluded) return `need.amenity.excluded.${excluded[1]}`;
  return `need.${field}`;
}

function needRows(entries) {
  const rows = new Map();
  const record = (key, criterion, entryIndex, state) => {
    if (!rows.has(key)) rows.set(key, { key, label: X.criterionShort(criterion) || criterion, group: 'NEED', criterion, states: new Array(entries.length).fill(null) });
    const row = rows.get(key);
    if (row.states[entryIndex] === null) row.states[entryIndex] = state;
  };
  entries.forEach((entry, index) => {
    for (const check of entry.constraintChecks) record(needKey(check.field), check.field, index, check.state);
    for (const item of entry.ranking.contributions) record(item.kind === 'PRICE_TARGET' ? 'need.price_target' : `need.${item.criterion}`, item.criterion, index, item.state);
  });
  return [...rows.values()].map(({ states, ...row }) => ({
    ...row, values: states.map((state) => (state ? cell(state, null, NEED_DISPLAY[state]) : cell('NOT_APPLICABLE', null, NEED_DISPLAY.NOT_APPLICABLE))),
  }));
}

function buildComparisonGrid(entries = []) {
  const each = (render) => entries.map(render);
  const has = (category) => entries.some((entry) => entry.category === category);
  const only = (category, render) => each((entry) => (entry.category === category ? render(entry) : cell('NOT_APPLICABLE', null, 'Non applicable')));
  const amenityLabels = (values) => (values.length ? values.map((key) => X.AMENITIES[key]?.label || key).join(', ') : 'Aucun équipement déclaré');
  const rows = [
    { key: 'category', label: 'Catégorie', values: each((e) => cell(e.category === CATEGORY.UNKNOWN ? 'UNKNOWN' : 'KNOWN', e.category, CATEGORY_LABELS[e.category])) },
    { key: 'offer', label: "Type d'offre", values: each((e) => known(OFFER_LABELS[e.listing.status] ? e.listing.status : null, OFFER_LABELS[e.listing.status])) },
    { key: 'propertyType', label: 'Type de bien', values: each((e) => known(e.listing.type)) },
    { key: 'location.city', label: 'Ville', values: each((e) => known(e.listing.address?.city)) },
    { key: 'location.arrondissement', label: 'Arrondissement', values: each((e) => known(e.listing.address?.arrondissement)) },
    { key: 'location.neighborhood', label: 'Quartier', values: each((e) => known(e.listing.address?.neighborhood)) },
    { key: 'price', label: 'Prix applicable', values: each((e) => priceCell(e.price)) },
    { key: 'surface', label: 'Superficie', values: each((e) => known(e.facts.surface.value, e.facts.surface.value !== null ? `${e.facts.surface.value} m²` : undefined)) },
    { key: 'bedrooms', label: 'Chambres', values: each((e) => known(e.facts.bedrooms.value)) },
    { key: 'bathrooms', label: 'Salles de bains', values: each((e) => known(e.facts.bathrooms.value)) },
    { key: 'amenities.declared', label: 'Équipements déclarés', values: each((e) => (Array.isArray(e.listing.amenities) ? cell('KNOWN', e.listing.amenities, amenityLabels(e.listing.amenities)) : cell('UNKNOWN'))) },
    { key: 'availability.public', label: "Disponibilité de l'annonce", values: each((e) => (e.listing.availability === 'Disponible' ? cell('KNOWN', 'Disponible', 'Annoncé disponible (non daté)') : cell('UNKNOWN'))) },
  ].map((row) => ({ group: 'FACT', ...row }));
  if (has(CATEGORY.SALE)) rows.push({ group: 'SALE', key: 'sale.constructionType', label: 'Type de construction', values: only(CATEGORY.SALE, (e) => known(e.listing.constructionType)) });
  if (has(CATEGORY.RENTAL)) {
    rows.push({ group: 'RENTAL', key: 'rental.deposit', label: 'Caution', values: only(CATEGORY.RENTAL, (e) => known(e.listing.cautionMultiplicateur, e.listing.cautionMultiplicateur !== undefined ? `${e.listing.cautionMultiplicateur} mois de loyer` : undefined)) });
  }
  if (entries.some((entry) => entry.listing.status === 'hebergement')) rows.push(...stayRows(entries));
  rows.push(...needRows(entries));
  for (const item of entries[0]?.unverifiable || []) {
    rows.push({ group: 'UNVERIFIABLE', key: `unverifiable.${item.key}`, label: X.criterionShort(item.key) || item.key, reason: item.reason, values: each(() => cell('UNKNOWN', null, 'Non vérifiable')) });
  }
  return { rows };
}

// ── Compromis ─────────────────────────────────────────────────────────────

function extremes(entries, valueOf) {
  const values = entries.map(valueOf);
  const knownValues = values.filter((value) => value !== null);
  if (knownValues.length < MIN_LISTINGS) return null;
  const min = Math.min(...knownValues); const max = Math.max(...knownValues);
  if (min === max) return null;
  const isUnique = (target) => values.filter((value) => value === target).length === 1;
  return { values, min, max, uniqueMin: isUnique(min), uniqueMax: isUnique(max) };
}

function buildTradeoffs(entries = [], comparability = assessComparability(entries)) {
  const parts = entries.map(() => ({ strengths: [], weaknesses: [], neutral: [], toVerify: [] }));
  if (comparability.dimensions.price.comparable) {
    const price = extremes(entries, (entry) => entry.price.amount);
    if (price) entries.forEach((entry, index) => {
      const value = { amount: entry.price.amount, currency: entry.price.currency, period: entry.price.period };
      if (entry.price.amount === price.min && price.uniqueMin) parts[index].strengths.push({ code: 'PRICE_LOWEST', dimension: 'price', value });
      else if (entry.price.amount === price.max && price.uniqueMax) parts[index].weaknesses.push({ code: 'PRICE_HIGHEST', dimension: 'price', value });
      else if (entry.price.amount > price.min && entry.price.amount < price.max) parts[index].neutral.push({ code: 'PRICE_INTERMEDIATE', dimension: 'price', value });
    });
  }
  // La taille est un fait descriptif : jamais un atout automatique.
  if (comparability.dimensions.surface.comparable) {
    const surface = extremes(entries, (entry) => entry.facts.surface.value);
    if (surface) entries.forEach((entry, index) => {
      if (entry.facts.surface.value === surface.max && surface.uniqueMax) parts[index].neutral.push({ code: 'SURFACE_LARGEST', dimension: 'surface', value: surface.max });
      else if (entry.facts.surface.value === surface.min && surface.uniqueMin) parts[index].neutral.push({ code: 'SURFACE_SMALLEST', dimension: 'surface', value: surface.min });
    });
  }
  const compareStates = (statesOf, codes) => {
    const criteria = unique(entries.flatMap((entry) => statesOf(entry).map((item) => item.criterion)));
    for (const criterion of criteria) {
      const states = entries.map((entry) => statesOf(entry).find((item) => item.criterion === criterion)?.state || null);
      states.forEach((state, index) => {
        const others = states.filter((_, other) => other !== index);
        if (state === 'TRUE' && others.some((value) => value !== 'TRUE')) parts[index].strengths.push({ code: codes.met, criterion });
        else if (state === 'FALSE' && others.includes('TRUE')) parts[index].weaknesses.push({ code: codes.unmet, criterion });
        else if (state === 'UNKNOWN' && others.includes('TRUE')) parts[index].toVerify.push({ code: codes.toVerify, criterion });
      });
    }
  };
  compareStates((entry) => entry.constraintChecks.map((check) => ({ criterion: check.field, state: check.state })), { met: 'CRITERION_MET', unmet: 'CRITERION_UNMET', toVerify: 'CRITERION_TO_VERIFY' });
  compareStates((entry) => entry.ranking.contributions, { met: 'PREFERENCE_CONFIRMED', unmet: 'PREFERENCE_UNMET', toVerify: 'PREFERENCE_TO_VERIFY' });
  const tradeoffs = entries.map((entry, index) => ({ id: entry.id, ...parts[index], text: X.tradeoffText(entry.label, parts[index]) }));
  const withStrengths = tradeoffs.filter((item) => item.strengths.length).length;
  const anyDifference = tradeoffs.some((item) => item.strengths.length || item.weaknesses.length);
  const hasTradeoffs = withStrengths >= MIN_LISTINGS;
  return { tradeoffs, hasTradeoffs, summary: hasTradeoffs ? X.TRADEOFF_SUMMARY.PRESENT : anyDifference ? X.TRADEOFF_SUMMARY.DOMINANT : X.TRADEOFF_SUMMARY.NONE };
}

// ── Conclusion ────────────────────────────────────────────────────────────

function groupOf(entry) {
  if (entry.constraintStatus === 'NOT_MATCHING') return 3;
  if (entry.constraintStatus === 'TO_VERIFY' || entry.matchStatus === 'TO_VERIFY') return 2;
  return 1;
}

/** Ordre IA-03C1 (score, préférences confirmées, identifiant) appliqué après la séparation IA-03B. */
function orderEntries(entries) {
  return [...entries].sort((left, right) => groupOf(left) - groupOf(right)
    || right.ranking.score - left.ranking.score
    || right.ranking.confirmed.length - left.ranking.confirmed.length
    || left.id.localeCompare(right.id));
}

function decideConclusion(entries = [], { comparability, hasPreferences, hasConstraints, coverageLimited = false } = {}) {
  const ordered = orderEntries(entries);
  const level = (comparability || assessComparability(entries)).level;
  const toVerifyOf = (entry) => [...entry.constraintChecks.filter((c) => c.state === 'UNKNOWN').map((c) => c.field),
    ...entry.ranking.contributions.filter((c) => c.state === 'UNKNOWN').map((c) => c.criterion), ...entry.unverifiable.map((u) => u.key)];
  const finish = (verdict, { leader = null, recommended = false, tied = [], basis = null } = {}) => ({
    verdict, basis, leaderId: leader?.id || null, recommendedId: recommended && leader ? leader.id : null, tiedIds: tied.map((entry) => entry.id),
    order: ordered.map((entry) => entry.id), conditions: leader ? toVerifyOf(leader) : [],
    text: X.conclusionText({
      verdict, basis, count: entries.length, leader, tied,
      confirmed: leader ? [...leader.constraintChecks.filter((c) => c.state === 'TRUE' && c.field.startsWith('amenities.')).map((c) => c.field), ...leader.ranking.contributions.filter((c) => c.state === 'TRUE').map((c) => c.criterion)] : [],
      toVerify: leader ? toVerifyOf(leader) : [], partial: level === COMPARABILITY.PARTIALLY_COMPARABLE, coverageLimited,
    }),
  });
  if (level === COMPARABILITY.NOT_COMPARABLE) return finish('NOT_COMPARABLE');
  if (!hasPreferences && !hasConstraints) return finish('NO_PREFERENCES');
  const eligible = ordered.filter((entry) => groupOf(entry) < 3);
  if (!eligible.length) return finish('NO_ELIGIBLE');
  const verified = eligible.filter((entry) => groupOf(entry) === 1);
  if (!hasPreferences) {
    if (eligible.length === 1) return finish(verified.length ? 'RECOMMENDED' : 'CONDITIONAL_LEAD', { leader: eligible[0], recommended: verified.length === 1, basis: 'CONSTRAINTS' });
    return finish('NO_PREFERENCES', { basis: 'SEVERAL_ELIGIBLE' });
  }
  const leader = eligible[0];
  const leaderVerified = groupOf(leader) === 1;
  if (eligible.length === 1) return finish(leaderVerified ? 'RECOMMENDED' : 'CONDITIONAL_LEAD', { leader, recommended: leaderVerified, basis: 'PREFERENCES' });
  if (eligible.every((entry) => entry.ranking.confidence === 0)) return finish('INSUFFICIENT_DATA');
  const tied = eligible.filter((entry) => groupOf(entry) === groupOf(leader) && entry.ranking.score === leader.ranking.score);
  if (tied.length > 1) return finish('TIE', { tied, basis: 'PREFERENCES' });
  // Distinction significative : le pire cas du meneur dépasse le meilleur cas de chaque autre bien admissible.
  const robust = eligible.slice(1).every((entry) => leader.ranking.scoreRange.min > entry.ranking.scoreRange.max);
  if (robust && leaderVerified) return finish('RECOMMENDED', { leader, recommended: true, basis: 'PREFERENCES' });
  return finish('CONDITIONAL_LEAD', { leader, basis: 'PREFERENCES' });
}

module.exports = {
  DEFAULT_MAX_LISTINGS, MIN_LISTINGS, ABSOLUTE_MAX_LISTINGS, CATEGORY, COMPARABILITY,
  resolveComparisonConfig, sanitizeComparisonCriteria, toComparisonListing, categorizeListing,
  pricingOf, monthlyPricingOf, buildComparisonEntry, assessComparability, buildComparisonGrid,
  buildTradeoffs, orderEntries, decideConclusion,
};
