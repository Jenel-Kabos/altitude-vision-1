const C = require('./catalog');
const { emptyCriteria, normalizeCriteria, validateParsedRequest } = require('./criteria');

const WORD_NUMBERS = Object.freeze({ un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 });
const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const number = (raw) => WORD_NUMBERS[raw] || Number(String(raw).replace(/[ .]/g, '').replace(',', '.'));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (text, value) => new RegExp(`(^|[^a-z])${escapeRegex(value)}([^a-z]|$)`).test(text);
const plusDays = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const validIso = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === iso; };
const toIso = (day, month, year) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

function notice(code, message, field) { return { code, ...(field ? { field } : {}), message }; }
function parseTransaction(text) {
  if (/(hotel|hebergement|sejour|nuitees?|par nuit|courte duree)/.test(text)) return 'STAY';
  if (/(a louer|location|loyer|par mois|bail|longue duree)/.test(text)) return 'RENT';
  if (/(acheter|achat|a vendre|en vente|acquerir)/.test(text)) return 'BUY';
  return null;
}

const PROPERTY_PATTERNS = [
  ['Appartement meublé', /appartements? meubles?/], ['Maison', /maisons?/], ['Villa', /villas?/],
  ['Appartement', /appartements?|\bappart\b/], ['Studio', /studios?/], ['Terrain', /terrains?/],
  ['Parcelle', /parcelles?/], ['Bureau', /bureaux?/], ['Commerce', /commerces?|boutiques?|local commercial/],
  ['Entrepôt', /entrepots?|hangars?/],
];
const STAY_PATTERNS = [
  ['residence_hoteliere', /residences? hotelieres?/], ['hotel', /\bhotels?\b/],
  ['appartement_meuble', /appartements? meubles?/], ['villa_meublee', /villas? meublees?/],
  ['maison_meublee', /maisons? meublees?/], ['studio_meuble', /studios? meubles?/],
  ['residence_meublee', /residences? meublees?/], ['bungalow', /bungalows?/], ['chambre_hotes', /chambres? d'hotes?/],
];
function parseTypes(text, transaction, criteria) {
  const lodging = STAY_PATTERNS.filter(([, re]) => re.test(text)).map(([key]) => key);
  if (transaction === 'STAY' || /\bhotel/.test(text)) criteria.accommodationTypes.push(...lodging);
  else {
    let remaining = text;
    for (const [type, re] of PROPERTY_PATTERNS) if (re.test(remaining)) { criteria.propertyTypes.push(type); remaining = remaining.replace(re, ' '); }
  }
}

function parseLocation(text, criteria) {
  for (const city of C.CITIES) if (word(text, fold(city))) criteria.location.city = city;
  for (const [city, districts] of Object.entries(C.DISTRICTS)) for (const district of districts) {
    if (word(text, fold(district))) {
      criteria.location.districts.push(district);
      const at = text.indexOf(fold(district));
      if (/(plutot|de preference|idealement)/.test(text.slice(Math.max(0, at - 25), at))) criteria.location.preferredDistricts.push(district);
      if (!criteria.location.city) criteria.location.city = city;
    }
  }
  const neighborhood = /quartier\s+([a-z][a-z'-]{1,40})/.exec(text); if (neighborhood) criteria.location.neighborhood = neighborhood[1];
  if (/centre[- ]ville/.test(text)) criteria.location.zone = 'centre-ville';
  const radius = /(?:moins de|a)\s*(\d+(?:[.,]\d+)?)\s*(km|m\b|metres?)/.exec(text);
  if (radius) criteria.location.radiusMeters = Math.round(number(radius[1]) * (radius[2] === 'km' ? 1000 : 1));
  if (/congo(?:-brazzaville)?/.test(text)) criteria.location.country = 'CG';
}

const AMOUNT = '(\\d{1,3}(?:[ .]\\d{3})+|\\d+(?:[.,]\\d+)?)(?![\\d])\\s*(milliards?|millions?|mille|mds?|mil(?!l)|k|m(?![a-z²\\d]))?'; // « 120 m2 » : surface, jamais 120 millions
function amountValue(raw, unit) {
  const base = number(raw); const u = unit || '';
  if (/^(k|mil|mille)$/.test(u)) return Math.round(base * 1e3);
  if (/^(m|million|millions)$/.test(u)) return Math.round(base * 1e6);
  if (/^(md|mds|milliard|milliards)$/.test(u)) return Math.round(base * 1e9);
  return Math.round(base);
}
// AI-INTEGRATION-02 — un nombre suivi d'une unité de taille ou d'occupation n'est jamais un montant
// (« au moins 3 chambres », « maximum 2 salles de bain », « minimum 4 nuits »).
const NOT_AN_AMOUNT = '(?!\\s*(?:m2|m²|metres? carres?|chambres?|pieces?|salles?|sdb|etages?|nuits?|adultes?|enfants?|personnes?|voyageurs?|lits?))';
function parseBudget(text, criteria, issues, ambiguities) {
  if (/(?:budget|prix|loyer)\s*-\s*\d/.test(text)) issues.push(notice('INVALID_NEGATIVE_AMOUNT', 'Un montant négatif est refusé.', 'budget'));
  const between = new RegExp(`entre\\s+${AMOUNT}\\s*(?:xaf|fcfa|francs?)?\\s+et\\s+${AMOUNT}`).exec(text);
  const single = new RegExp(`(?:budget|prix|loyer|maximum|max|au plus|jusqu'a)\\s*(?:de|a|:)?\\s*${AMOUNT}${NOT_AN_AMOUNT}`).exec(text)
    || new RegExp(`pour\\s+${AMOUNT}\\s*(?:xaf|fcfa|francs?)`).exec(text)
    || new RegExp(`${AMOUNT}\\s*(?:xaf|fcfa|francs?)(?:\\s|$)`).exec(text);
  const minimum = new RegExp(`(?:au moins|minimum|min|a partir de)\\s*(?:de|:)?\\s*${AMOUNT}${NOT_AN_AMOUNT}\\s*(?:xaf|fcfa|francs?)?`).exec(text);
  if (between) { const sharedUnit = between[2] || between[4]; criteria.budget.min = amountValue(between[1], sharedUnit); criteria.budget.max = amountValue(between[3], between[4] || sharedUnit); }
  else if (minimum) criteria.budget.min = amountValue(minimum[1], minimum[2]);
  else if (single) criteria.budget.max = amountValue(single[1], single[2]);
  if (/(xaf|fcfa|francs?\s*cfa)/.test(text)) criteria.budget.currency = 'XAF';
  else if (/\beur\b|euros?/.test(text)) criteria.budget.currency = 'EUR';
  else if (/\busd\b|dollars?/.test(text)) criteria.budget.currency = 'USD';
  if (/par mois|mensuel|\/mois/.test(text)) criteria.budget.period = 'MONTH';
  else if (/par nuit|la nuit|\/nuit/.test(text)) criteria.budget.period = 'NIGHT';
  else if (criteria.budget.max !== null && criteria.transaction === 'BUY') criteria.budget.period = 'TOTAL';
  if (criteria.budget.max !== null && !criteria.budget.currency) ambiguities.push(notice('MISSING_CURRENCY', 'La devise du budget doit être confirmée.', 'budget.currency'));
  for (const value of [criteria.budget.min, criteria.budget.max]) if (value !== null && value > C.MAX_AMOUNT) issues.push(notice('AMOUNT_OUT_OF_RANGE', 'Le montant dépasse la limite acceptée.', 'budget'));
}

function parseDimensions(text, criteria, contradictions) {
  const bedroomMatches = [...text.matchAll(/(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*chambres?/g)].map((m) => number(m[1]));
  const elliptical = /(?:mais|ou)\s*(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:suffisent|minimum|au moins)/.exec(text);
  if (elliptical) bedroomMatches.push(number(elliptical[1]));
  if (bedroomMatches.length) criteria.bedrooms.min = bedroomMatches[0];
  if (new Set(bedroomMatches).size > 1) contradictions.push(notice('CONFLICTING_VALUES', `Plusieurs nombres de chambres sont exprimés: ${bedroomMatches.join(', ')}.`, 'bedrooms'));
  const baths = /(\d+|un|une|deux|trois|quatre|cinq)\s*(?:salles? de bains?|salles? d'eau|sdb)/.exec(text);
  if (baths) criteria.bathrooms.min = number(baths[1]);
  const area = /(?:au moins|min(?:imum)?\s*)?(\d{2,6})\s*(?:m2|m²|metres? carres?)/.exec(text);
  if (area) criteria.surface.min = Number(area[1]);
  const floors = /(\d+)\s*etages?/.exec(text); if (floors) criteria.floors.min = Number(floors[1]);
}

function preferenceWindow(text, index) { const around = text.slice(Math.max(0, index - 25), index + 50); return /(si possible|de preference|plutot|idealement|souhaite)/.test(around); }

// IA-03C2-FIX01 — modalité des équipements analysée par proposition : un marqueur ne s'applique
// qu'à la liste d'équipements qu'il qualifie (après elle) ou qu'il introduit (avant elle).
const CLAUSE_BOUNDARY = /[.;!?]+|,?\s+(?:mais|cependant|par contre|en revanche|toutefois)\s+/;
const LIST_CONNECTORS = new Set(['et', 'ou', 'ni', 'un', 'une', 'le', 'la', 'les', 'des', 'du', 'de', "d'", "l'", 'au', 'moins', 'aussi', 'egalement']);
const ARTICLES = new Set(['le', 'la', 'les', "l'"]);
const COPULAS = new Set(['est', 'sont', 'serait', 'seraient', 'reste', 'restent', 'ce', "c'", ...ARTICLES]);
const MODALITY_MARKERS = Object.freeze([
  // Formes niées d'abord : « pas obligatoire » rend facultatif, jamais obligatoire ni interdit.
  { modality: 'preferred', roles: ['post', 'retro'], re: "(?:n'est |ne sont |ne serait |ce n'est )?pas (?:indispensables?|obligatoires?|necessaires?|essentiel(?:le)?s?|une obligation)|facultati(?:f|ve)s?|en option" },
  { modality: 'excluded', roles: ['prefix', 'immediate'], re: "je ne veux (?:pas|aucune?)(?: de| d')?|surtout pas(?: de| d')?" },
  { modality: 'excluded', roles: ['immediate'], re: "sans|pas de|pas d'|aucune?" },
  { modality: 'excluded', roles: ['post'], re: 'a exclure|exclue?s?|interdite?s?' },
  { modality: 'required', roles: ['prefix'], re: 'il me faut|je dois avoir|doit avoir|obligatoirement' },
  { modality: 'required', roles: ['prefix', 'post'], re: 'absolument|imperativement' },
  { modality: 'required', roles: ['post'], re: 'obligatoires?|indispensables?|imperati(?:f|ve)s?|exigee?s?|necessaires?' },
  { modality: 'preferred', roles: ['prefix'], re: "je prefere(?:rais)?|ce serait (?:bien|un plus|ideal)|je souhaite(?:rais)?|j'aimerais" },
  { modality: 'preferred', roles: ['prefix', 'post'], re: 'de preference|si possible|idealement|si disponibles?|preferablement' },
  { modality: 'preferred', roles: ['post'], re: 'preferee?s?|souhaitee?s?' },
  { modality: 'preferred', roles: ['immediate'], re: 'plutot' },
].map((marker) => ({ ...marker, regex: new RegExp(`(?<![a-z'])(?:${marker.re})(?:(?<=')|(?![a-z]))`, 'g') })));
const AMENITY_ALIASES = Object.entries(C.AMENITIES)
  .flatMap(([key, aliases]) => aliases.map((alias) => ({ key, regex: new RegExp(`(?<![a-z])${escapeRegex(fold(alias))}(?:e|s|es)?(?![a-z])`, 'g'), length: alias.length })))
  .sort((left, right) => right.length - left.length);

const overlaps = (item, list) => list.some((other) => item.start < other.end && item.end > other.start);
const tokensOf = (gap) => gap.replace(/([dlc])'/g, "$1' ").split(/[\s,:]+/).filter(Boolean);
const onlyTokens = (gap, allowed) => tokensOf(gap).every((token) => allowed.has(token));

function findAll(clause, entries) {
  const found = [];
  for (const entry of entries) {
    for (const match of clause.matchAll(entry.regex)) {
      const item = { ...entry, start: match.index, end: match.index + match[0].length };
      if (!overlaps(item, found)) found.push(item);
    }
  }
  return found.sort((left, right) => left.start - right.start);
}

/** Regroupe les équipements coordonnés (« un parking, un jardin et la clim », « parking ou jardin »). */
function amenityLists(clause, mentions) {
  const lists = [];
  for (const mention of mentions) {
    const current = lists[lists.length - 1];
    const gap = current ? clause.slice(current.items[current.items.length - 1].end, mention.start) : null;
    if (current && onlyTokens(gap, LIST_CONNECTORS)) {
      current.items.push(mention); current.separators.push(tokensOf(gap).includes('ou') ? 'OR' : 'AND');
    } else lists.push({ items: [mention], separators: [] });
  }
  return lists;
}

function listModality(clause, list, markers, consumed) {
  const first = list.items[0]; const last = list.items[list.items.length - 1];
  // 1. Marqueur postposé : « parking et jardin de préférence », « la climatisation est obligatoire ».
  const post = markers.find((marker) => marker.start >= last.end && marker.roles.includes('post'));
  if (post) {
    const gap = clause.slice(last.end, post.start);
    // Après une virgule, seul un verbe d'état rattache le marqueur (« parking, ce n'est pas indispensable ») ;
    // « parking, de préférence un jardin » introduit au contraire l'équipement suivant.
    const linksBack = tokensOf(gap).some((token) => !ARTICLES.has(token));
    if (onlyTokens(gap, COPULAS) && (!gap.includes(',') || linksBack)) {
      consumed.add(post); return { modality: post.modality, explicit: true };
    }
  }
  const before = markers.filter((marker) => marker.end <= first.start && !consumed.has(marker));
  // 2. Marqueur immédiat : « sans piscine », « pas de piscine ni de jardin », « plutôt un jardin ».
  const immediate = [...before].reverse().find((marker) => marker.roles.includes('immediate'));
  if (immediate && onlyTokens(clause.slice(immediate.end, first.start), LIST_CONNECTORS)) return { modality: immediate.modality, explicit: true };
  // 3. Marqueur introducteur le plus proche dans la proposition : « je préfère un parking, un jardin… ».
  const prefix = [...before].reverse().find((marker) => marker.roles.includes('prefix'));
  if (prefix) return { modality: prefix.modality, explicit: true };
  return { modality: 'required', explicit: false };
}

function parseAmenities(text, criteria, ambiguities, contradictions) {
  const mentionsByKey = new Map(); const alternativesFound = []; let previousDefaults = [];
  const record = (key, mention) => { if (!mentionsByKey.has(key)) mentionsByKey.set(key, []); mentionsByKey.get(key).push(mention); };
  for (const clause of text.split(CLAUSE_BOUNDARY).map((part) => part.trim()).filter(Boolean)) {
    const mentions = findAll(clause, AMENITY_ALIASES);
    const markers = findAll(clause, MODALITY_MARKERS);
    // « …avec parking, mais ce n'est pas indispensable » : la négation qualifie la proposition précédente.
    if (!mentions.length) {
      if (markers.some((marker) => marker.roles.includes('retro'))) for (const mention of previousDefaults) Object.assign(mention, { modality: 'preferred', explicit: true });
      previousDefaults = [];
      continue;
    }
    previousDefaults = [];
    const consumed = new Set();
    for (const list of amenityLists(clause, mentions)) {
      const { modality, explicit } = listModality(clause, list, markers, consumed);
      if (list.separators.includes('OR')) {
        // Le contrat de critères n'a pas de groupe logique : l'alternative est conservée à part et signalée.
        const options = [[]];
        list.items.forEach((item, index) => { if (index && list.separators[index - 1] === 'OR') options.push([]); options[options.length - 1].push(item.key); });
        alternativesFound.push({ modality, options: options.map((option) => [...new Set(option)]) });
        continue;
      }
      for (const item of list.items) {
        const mention = { modality, explicit };
        record(item.key, mention);
        if (!explicit) previousDefaults.push(mention);
      }
    }
  }
  for (const key of Object.keys(C.AMENITIES)) {
    const mentions = mentionsByKey.get(key); if (!mentions) continue;
    const explicit = [...new Set(mentions.filter((mention) => mention.explicit).map((mention) => mention.modality))];
    if (explicit.length > 1) {
      contradictions.push(notice('CONFLICTING_AMENITY_MODALITIES', `Modalités incompatibles pour un même équipement : ${explicit.join(', ')}.`, `amenities.${key}`));
      continue;
    }
    criteria.amenities[explicit[0] || 'required'].push(key);
  }
  // IA-03C4 (option A) : une alternative facultative est classée (AMENITY_ANY) ; obligatoire ou exclue, elle reste à préciser.
  if (alternativesFound.some((item) => item.modality !== 'preferred')) ambiguities.push(notice('AMENITY_ALTERNATIVE', 'Une alternative entre équipements doit être précisée.', 'amenities'));
  return alternativesFound;
}
function parseProximity(text, criteria) {
  if (!/(proche|pres|a cote|proximite|moins de \d|centre-ville)/.test(text)) return;
  for (const [category, aliases] of Object.entries(C.PROXIMITIES)) for (const alias of aliases) {
    const index = text.indexOf(alias); if (index < 0) continue;
    const bucket = preferenceWindow(text, index) ? 'preferred' : 'required';
    criteria.proximity[bucket].push({ category, maxMeters: criteria.location.radiusMeters || C.DEFAULT_PROXIMITY_RADIUS }); break;
  }
}

function parseStay(text, criteria, context, issues, ambiguities) {
  if (/courte duree|court sejour/.test(text)) criteria.stay.stayType = 'SHORT_TERM';
  if (/longue duree|long sejour/.test(text)) criteria.stay.stayType = 'LONG_TERM';
  const nights = /(\d+)\s*nuits?/.exec(text); if (nights) criteria.stay.nights = Number(nights[1]);
  const adults = /(\d+)\s*adultes?/.exec(text); if (adults) criteria.stay.adults = Number(adults[1]);
  const children = /(\d+)\s*enfants?/.exec(text); if (children) criteria.stay.children = Number(children[1]);
  if (criteria.transaction === 'STAY') { const rooms = /(\d+)\s*chambres?/.exec(text); if (rooms) criteria.stay.rooms = Number(rooms[1]); }
  const range = /du\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*au\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (range) {
    const start = toIso(range[1], range[2], range[3]); const end = toIso(range[4], range[5], range[6]);
    if (!validIso(start) || !validIso(end) || end <= start) issues.push(notice('INVALID_DATE', 'La plage de dates est invalide.', 'stay'));
    else { criteria.stay.checkIn = start; criteria.stay.checkOut = end; criteria.stay.nights = Math.round((new Date(end) - new Date(start)) / 86400000); }
  } else if (/\bdemain\b/.test(text)) {
    if (!context.referenceDate || !validIso(context.referenceDate)) ambiguities.push(notice('RELATIVE_DATE_REQUIRES_CONTEXT', 'Une date de référence valide est requise pour « demain ».', 'stay.checkIn'));
    else { criteria.stay.checkIn = plusDays(context.referenceDate, 1); if (criteria.stay.nights) criteria.stay.checkOut = plusDays(criteria.stay.checkIn, criteria.stay.nights); }
  }
}

function alternatives(text) {
  if (!/\bou\b/.test(text)) return [];
  const parts = text.split(/\bou\b/).map((x) => x.trim()).filter(Boolean);
  const parsed = parts.map((part) => ({ transaction: parseTransaction(part), propertyTypes: PROPERTY_PATTERNS.filter(([, re]) => re.test(part)).map(([type]) => type) }));
  return parsed.filter((x) => x.transaction || x.propertyTypes.length);
}

/** @returns {import('./types').ParsedRealEstateRequest} */
function parseRealEstateRequest(rawInput, context = {}) {
  const raw = typeof rawInput === 'string' ? rawInput : '';
  const issues = []; const ambiguities = []; const contradictions = [];
  if (!raw.trim()) issues.push(notice('EMPTY_INPUT', 'La demande est vide.'));
  if (raw.length > C.MAX_INPUT_LENGTH) issues.push(notice('INPUT_TRUNCATED', `La demande est limitée à ${C.MAX_INPUT_LENGTH} caractères.`));
  const text = fold(raw.slice(0, C.MAX_INPUT_LENGTH).replace(/<[^>]*>/g, ' '));
  const criteria = emptyCriteria(); criteria.transaction = parseTransaction(text);
  parseTypes(text, criteria.transaction, criteria); parseLocation(text, criteria);
  parseBudget(text, criteria, issues, ambiguities); parseDimensions(text, criteria, contradictions);
  const amenityAlternatives = parseAmenities(text, criteria, ambiguities, contradictions);
  parseProximity(text, criteria); parseStay(text, criteria, context, issues, ambiguities);
  if (criteria.accommodationTypes.some((type) => /meuble/.test(type)) || criteria.propertyTypes.includes('Appartement meublé')) {
    criteria.amenities.required = criteria.amenities.required.filter((amenity) => amenity !== 'furnished');
  }
  if (!criteria.transaction && criteria.accommodationTypes.length) criteria.transaction = 'STAY';
  const choices = alternatives(text);
  if (choices.length > 1) ambiguities.push(notice('MULTIPLE_ALTERNATIVES', 'Plusieurs recherches incompatibles ont été conservées.'));
  const missing = [];
  if (!criteria.transaction) missing.push('transaction');
  if (!criteria.location.city && !criteria.location.districts.length && !criteria.location.zone) missing.push('location');
  const clarificationQuestions = [];
  if (contradictions.length) clarificationQuestions.push('Quelle valeur contradictoire faut-il retenir ?');
  if (choices.length > 1) clarificationQuestions.push('Souhaitez-vous traiter ces alternatives séparément ?');
  if (amenityAlternatives.some((item) => item.modality !== 'preferred')) clarificationQuestions.push('Souhaitez-vous l’un de ces équipements, ou plusieurs à la fois ?');
  for (const field of missing) clarificationQuestions.push(`Pouvez-vous préciser ${field === 'transaction' ? 'achat, location ou séjour' : 'la localisation'} ?`);
  const hasCriteria = criteria.transaction || criteria.propertyTypes.length || criteria.accommodationTypes.length || criteria.location.city || criteria.location.districts.length || criteria.budget.max !== null || criteria.bedrooms.min !== null;
  const status = !hasCriteria && !text ? 'unrecognized' : (ambiguities.length || contradictions.length || missing.length || issues.some((x) => x.code !== 'INPUT_TRUNCATED') ? 'needs_clarification' : 'recognized');
  return {
    version: '1.1.0', status, criteria: normalizeCriteria(criteria), alternatives: choices, amenityAlternatives, missing,
    ambiguities, contradictions, clarificationQuestions, issues, unrecognizedFragments: [],
  };
}

module.exports = { parseRealEstateRequest, parseRequest: parseRealEstateRequest, validateParsedRequest, fold, amountValue };
