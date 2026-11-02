'use strict';
// État conversationnel local : critères canoniques, préférences, motivations et historique borné.
// Toutes les mutations passent par applyOperations, qui ne modifie jamais l'état reçu.
const LIMITS = { history: 20, amenities: 8, motivations: 6, proposedIds: 10, rejected: 10, asked: 12 };

const TRANSACTIONS = new Set(['RENT', 'BUY', 'STAY']);
const PROPERTY_TYPES = new Set(['Maison', 'Villa', 'Appartement', 'Studio', 'Terrain', 'Bureau', 'Commerce', 'Duplex', 'Hôtel']);
const CITIES = { Brazzaville: ['Makélékélé', 'Bacongo', 'Poto-Poto', 'Moungali', 'Ouenzé', 'Talangaï', 'Mfilou', 'Madibou', 'Djiri'], 'Pointe-Noire': ['Lumumba', 'Mvou-Mvou', 'Tié-Tié', 'Loandjili', 'Ngoyo', 'Mongo-Mpoukou'] };
const DISTRICTS = Object.fromEntries(Object.entries(CITIES).flatMap(([city, list]) => list.map((district) => [district, city])));
const AMENITIES = new Set(['cour', 'parking', 'jardin', 'piscine', 'climatisation', 'garage', 'balcon', 'terrasse', 'forage', 'groupe électrogène', 'wifi', 'meublé']);
const FEMININE = new Set(['cour', 'piscine', 'climatisation', 'terrasse']);
const noted = (amenity, negative = false) => `${amenity} ${negative ? 'non ' : ''}${FEMININE.has(amenity) ? 'indiquée' : 'indiqué'}`;
const MOTIVATIONS = new Set(['famille', 'ecole', 'espace', 'mobilite', 'budget', 'calme', 'courses', 'commerce', 'exterieur']);
const IMPORTANCE = new Set(['important', 'required']);

const SCALAR_PATHS = {
  transaction: (v) => TRANSACTIONS.has(v),
  propertyType: (v) => PROPERTY_TYPES.has(v),
  // Plusieurs types acceptés (« maison ou appartement ») ; propertyType reste le premier, pour les contrats existants.
  propertyTypes: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 4 && new Set(v).size === v.length && v.every((t) => PROPERTY_TYPES.has(t)),
  // Mode actif : 'explore' = exploration du catalogue sans filtre de projet ; null = recherche ciblée.
  mode: (v) => v === 'explore',
  city: (v) => Object.hasOwn(CITIES, v),
  district: (v) => Object.hasOwn(DISTRICTS, v),
  'budget.min': (v) => Number.isInteger(v) && v >= 1000 && v <= 5_000_000_000,
  'budget.max': (v) => Number.isInteger(v) && v >= 1000 && v <= 5_000_000_000,
  'budget.strict': (v) => typeof v === 'boolean',
  // Budget explicitement levé par le client (« peu importe le budget ») : aucune borne, et la question n'est plus posée.
  'budget.unrestricted': (v) => typeof v === 'boolean',
  'budget.period': (v) => v === null || ['month', 'night', 'sale'].includes(v),
  furnished: (v) => typeof v === 'boolean',
  'bedrooms.min': (v) => Number.isInteger(v) && v >= 0 && v <= 20,
  'surface.min': (v) => Number.isInteger(v) && v >= 5 && v <= 100_000,
  'proximity.school': (v) => IMPORTANCE.has(v),
  'proximity.market': (v) => IMPORTANCE.has(v),
};
const LIST_PATHS = new Set(['amenities.preferred', 'amenities.required']);
const OPS = new Set(['set', 'replace', 'remove', 'restore']);

function createConversationState() {
  return {
    criteria: { mode: null, transaction: null, propertyType: null, propertyTypes: [], city: null, district: null, budget: { min: null, max: null, strict: false, period: null, unrestricted: false }, furnished: null, bedrooms: { min: null }, surface: { min: null } },
    amenities: { required: [], preferred: [] },
    proximity: { school: null, market: null },
    motivations: [],
    criteriaHistory: [],
    proposedIds: [],
    lastResults: [],
    rejectedRelaxations: [],
    acceptedRelaxations: [],
    pendingRelaxation: null,
    asked: [],
    lastQuestion: null,
    certified: null,
  };
}

function getScalar(state, path) {
  if (path.startsWith('proximity.')) return state.proximity[path.split('.')[1]] ?? null;
  const [head, tail] = path.split('.');
  return tail ? state.criteria[head][tail] : state.criteria[head];
}

function setScalar(state, path, value) {
  if (path.startsWith('proximity.')) { state.proximity[path.split('.')[1]] = value; return; }
  const [head, tail] = path.split('.');
  if (tail) state.criteria[head][tail] = value; else state.criteria[head] = value;
}

const DEFAULTS = { 'budget.strict': false, 'budget.period': null, 'budget.unrestricted': false };
const defaultOf = (path) => (path === 'propertyTypes' ? [] : DEFAULTS[path] ?? null);

function remember(state, path, value) {
  if (value === null || value === undefined) return;
  state.criteriaHistory.push({ path, value });
  if (state.criteriaHistory.length > LIMITS.history) state.criteriaHistory.splice(0, state.criteriaHistory.length - LIMITS.history);
}

function applyOne(state, operation) {
  const { op, path, value } = operation || {};
  if (!OPS.has(op)) throw new Error('Opération mémoire inconnue.');
  if (LIST_PATHS.has(path)) {
    const [, bucket] = path.split('.');
    if (op === 'restore') {
      const known = state.criteriaHistory.some((item) => item.path === path && item.value === value);
      if (!known && !AMENITIES.has(value)) throw new Error('Valeur à restaurer inconnue.');
    }
    if (!AMENITIES.has(value)) throw new Error('Valeur d’équipement hors catalogue.');
    if (op === 'remove') {
      for (const key of ['preferred', 'required']) {
        if (state.amenities[key].includes(value)) { remember(state, `amenities.${key}`, value); state.amenities[key] = state.amenities[key].filter((item) => item !== value); }
      }
      return;
    }
    const other = bucket === 'required' ? 'preferred' : 'required';
    state.amenities[other] = state.amenities[other].filter((item) => item !== value);
    if (!state.amenities[bucket].includes(value)) state.amenities[bucket].push(value);
    if (state.amenities[bucket].length > LIMITS.amenities) state.amenities[bucket].shift();
    return;
  }
  if (!Object.hasOwn(SCALAR_PATHS, path)) throw new Error(`Chemin mémoire interdit : ${String(path).slice(0, 40)}`);
  const previous = getScalar(state, path);
  if (op === 'remove') { if (!(Array.isArray(previous) && !previous.length)) remember(state, path, previous); setScalar(state, path, defaultOf(path)); return; }
  if (op === 'restore') {
    const entry = [...state.criteriaHistory].reverse().find((item) => item.path === path && item.value !== previous);
    if (!entry) throw new Error('Aucune valeur précédente à restaurer.');
    remember(state, path, previous); setScalar(state, path, entry.value); return;
  }
  if (!SCALAR_PATHS[path](value)) throw new Error(`Valeur invalide pour ${path}.`);
  if (previous !== value && !(Array.isArray(previous) && !previous.length)) remember(state, path, previous);
  setScalar(state, path, Array.isArray(value) ? [...value] : value);
  remember(state, path, value);
  if (path === 'district') setScalar(state, 'city', DISTRICTS[value]);
  // Un projet précisé (opération ou type) met fin à l'exploration ; un type unique remplace une liste de types.
  if (['transaction', 'propertyType', 'propertyTypes'].includes(path)) state.criteria.mode = null;
  if (path === 'propertyType' && !state.criteria.propertyTypes.includes(value)) state.criteria.propertyTypes = [];
  if (path === 'propertyTypes') state.criteria.propertyType = value[0];
  if (path === 'budget.min' || path === 'budget.max') state.criteria.budget.unrestricted = false;
  if (path === 'mode') state.lastQuestion = null;
}

function applyOperations(state, operations = []) {
  const next = structuredClone(state);
  let invalidate = false;
  for (const operation of operations) {
    const path = operation?.path;
    const before = path && !path.startsWith('amenities.') ? getScalar(next, path) : undefined;
    applyOne(next, operation);
    const after = path && !path.startsWith('amenities.') ? getScalar(next, path) : undefined;
    if (JSON.stringify(before) !== JSON.stringify(after) && ['mode', 'propertyTypes', 'budget.unrestricted', 'transaction', 'propertyType', 'city', 'district', 'budget.min', 'budget.max', 'budget.period', 'furnished', 'bedrooms.min', 'surface.min'].includes(path)) invalidate = true;
  }
  if (invalidate) { next.lastResults = []; next.proposedIds = []; next.certified = null; next.pendingRelaxation = null; }
  return next;
}

function addMotivations(state, motivations = []) {
  const next = structuredClone(state);
  for (const item of motivations) if (MOTIVATIONS.has(item) && !next.motivations.includes(item)) next.motivations.push(item);
  next.motivations = next.motivations.slice(-LIMITS.motivations);
  return next;
}

const TX_LABEL = { RENT: 'location', BUY: 'achat', STAY: 'séjour meublé' };
const TX_QUERY = { RENT: 'à louer', BUY: 'à acheter', STAY: 'meublé pour un séjour' };
const fcfa = (value) => `${Number(value).toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;

// Requête textuelle fermée pour IA-03 : seuls les critères canoniques connus, dans une forme que le parseur comprend.
function buildSearchQuery(state) {
  const c = state.criteria;
  const parts = [];
  const head = [(c.propertyType || 'logement').toLowerCase(), c.transaction ? TX_QUERY[c.transaction] : null].filter(Boolean).join(' ');
  const place = c.district ? `à ${c.district}, ${c.city || DISTRICTS[c.district]}` : c.city ? `à ${c.city}` : null;
  parts.push([head, place].filter(Boolean).join(' '));
  if (Number.isInteger(c.bedrooms.min)) parts.push(`au moins ${c.bedrooms.min} chambres`);
  if (Number.isInteger(c.surface.min)) parts.push(`au moins ${c.surface.min} m2`);
  // INTEGRATION-01 : l'analyseur IA-03 de main lit une fourchette sous la forme « entre X et Y » (deux bornes séparées
  // « minimum X, maximum Y » ne gardent que la première).
  if (Number.isInteger(c.budget.min) && Number.isInteger(c.budget.max)) parts.push(`budget entre ${c.budget.min} et ${c.budget.max} FCFA`);
  else if (Number.isInteger(c.budget.min)) parts.push(`budget minimum ${c.budget.min} FCFA`);
  else if (Number.isInteger(c.budget.max)) parts.push(`budget maximum ${c.budget.max} FCFA`);
  if (c.furnished === true) parts.push('meublé');
  return parts.join(', ');
}

// Variantes de recherche IA-03 : une par type accepté et, sans opération, par opération (IA-03 bloque sinon).
// Critères structurés transmis à l'adaptateur avec la requête : le type validé en mémoire (IA-03 le convertit en
// type d'hébergement pour un séjour, ce qui le perdrait pour les hébergements publiés sans fiche de séjour).
const variantCriteria = (variant) => (variant.criteria.propertyType ? { propertyTypes: [variant.criteria.propertyType] } : {});

function searchVariants(state, { transactions = ['RENT', 'BUY', 'STAY'] } = {}) {
  const c = state.criteria;
  const types = c.propertyTypes.length ? c.propertyTypes : [c.propertyType];
  const txs = c.transaction ? [c.transaction] : transactions;
  return types.flatMap((type) => txs.map((tx) => {
    const v = structuredClone(state); v.criteria.propertyType = type; v.criteria.propertyTypes = []; v.criteria.transaction = tx; return v;
  }));
}

// Filtres réellement actifs, pour le panneau « Critères retenus ».
function describeFilters(state) {
  const c = state.criteria;
  if (c.mode === 'explore') {
    const lines = ['mode : exploration du catalogue', 'type : tous', 'opération : toutes', 'budget : sans restriction', `lieu : ${[c.district, c.city].filter(Boolean).join(', ') || 'toutes les zones couvertes'}`];
    return lines.join(' ; ');
  }
  const base = describeState(state).replace(/^types? : [^;]+ ; /, '');
  const types = c.propertyTypes.length ? `types : ${c.propertyTypes.join(', ')}` : c.propertyType ? `type : ${c.propertyType}` : 'type : non précisé';
  const parts = base.split(' ; ');
  const at = parts.findIndex((p) => p.startsWith('lieu'));
  if (c.budget.unrestricted && !Number.isInteger(c.budget.min) && !Number.isInteger(c.budget.max)) parts.splice(at >= 0 ? at + 1 : 1, 0, 'budget : sans restriction');
  return ['mode : recherche ciblée', types, ...parts].join(' ; ');
}

// Résumé français des critères connus, utilisé par la narration et l'interface.
function describeState(state) {
  const c = state.criteria;
  const lines = [];
  if (c.propertyTypes.length) lines.push(`types : ${c.propertyTypes.join(', ')}`);
  else if (c.propertyType) lines.push(`type : ${c.propertyType}`);
  lines.push(`opération : ${c.transaction ? TX_LABEL[c.transaction] : 'non précisée'}`);
  if (c.district || c.city) lines.push(`lieu : ${[c.district, c.city].filter(Boolean).join(', ')}`);
  if (Number.isInteger(c.budget.min) && Number.isInteger(c.budget.max)) lines.push(`budget : ${fcfa(c.budget.min)} – ${fcfa(c.budget.max)}${c.budget.strict ? ' (strict)' : ''}`);
  else if (Number.isInteger(c.budget.max)) lines.push(`budget maximum : ${fcfa(c.budget.max)}${c.budget.strict ? ' (strict)' : ''}`);
  else if (Number.isInteger(c.budget.min)) lines.push(`budget minimum : ${fcfa(c.budget.min)}`);
  if (c.budget.period) lines.push(`périodicité : ${{ month: 'mensuelle', night: 'par nuit', sale: 'prix de vente' }[c.budget.period]}`);
  lines.push(`meublé : ${c.furnished === true ? 'oui' : c.furnished === false ? 'non' : 'non précisé'}`);
  if (Number.isInteger(c.bedrooms.min)) lines.push(`chambres : au moins ${c.bedrooms.min}`);
  if (Number.isInteger(c.surface.min)) lines.push(`surface : au moins ${c.surface.min} m²`);
  if (state.amenities.required.length) lines.push(`indispensable : ${state.amenities.required.join(', ')}`);
  if (state.amenities.preferred.length) lines.push(`souhaité : ${state.amenities.preferred.join(', ')}`);
  if (state.proximity.school) lines.push(`proximité d’une école : ${state.proximity.school === 'required' ? 'indispensable' : 'importante'}`);
  if (state.proximity.market) lines.push(`proximité d’un marché : ${state.proximity.market === 'required' ? 'indispensable' : 'importante'}`);
  if (state.motivations.length) lines.push(`motivations : ${state.motivations.map((item) => ({ ecole: 'école', mobilite: 'mobilité', exterieur: 'espace extérieur', courses: 'courses quotidiennes', commerce: 'activité commerciale' }[item] || item)).join(', ')}`);
  return lines.join(' ; ');
}

// Atouts, limites et points à vérifier d'une annonce, calculés uniquement depuis sa projection publique.
function evaluateListing(state, listing) {
  const c = state.criteria;
  const strengths = []; const limits = []; const toVerify = [];
  const amenities = (listing.amenities || []).map((item) => String(item).toLowerCase());
  if (Number.isFinite(listing.price) && Number.isInteger(c.budget.max)) {
    if (listing.price < c.budget.max) strengths.push(`prix de ${fcfa(listing.price)}, sous votre budget de ${fcfa(c.budget.max)}`);
    else if (listing.price === c.budget.max) strengths.push(`prix de ${fcfa(listing.price)}, au niveau exact de votre budget`);
    else limits.push(`prix de ${fcfa(listing.price)}, au-dessus de votre budget de ${fcfa(c.budget.max)}`);
  } else if (!Number.isFinite(listing.price)) toVerify.push('prix non publié');
  if (Number.isFinite(listing.price) && Number.isInteger(c.budget.min) && listing.price < c.budget.min) limits.push(`prix de ${fcfa(listing.price)}, sous votre minimum de ${fcfa(c.budget.min)}`);
  if (Number.isFinite(listing.bedrooms) && Number.isInteger(c.bedrooms.min)) {
    if (listing.bedrooms > c.bedrooms.min) strengths.push(`${listing.bedrooms} chambres, au-delà des ${c.bedrooms.min} demandées`);
    else if (listing.bedrooms === c.bedrooms.min) strengths.push(`${listing.bedrooms} chambres, comme demandé`);
    else limits.push(`${listing.bedrooms} chambres seulement, pour ${c.bedrooms.min} demandées`);
  } else if (!Number.isFinite(listing.bedrooms) && Number.isInteger(c.bedrooms.min)) toVerify.push('nombre de chambres non publié');
  for (const amenity of [...state.amenities.required, ...state.amenities.preferred]) {
    if (amenities.includes(amenity)) strengths.push(noted(amenity));
    else limits.push(`${noted(amenity, true)} dans l’annonce`);
  }
  if (state.proximity.school) toVerify.push('proximité d’une école (non vérifiable dans les annonces)');
  if (state.proximity.market) toVerify.push('proximité d’un marché (non vérifiable dans les annonces)');
  return { id: listing.id, strengths, limits, toVerify };
}

module.exports = { variantCriteria, LIMITS, TRANSACTIONS, PROPERTY_TYPES, CITIES, DISTRICTS, AMENITIES, MOTIVATIONS, createConversationState, applyOperations, addMotivations, fcfa, buildSearchQuery, searchVariants, describeFilters, describeState, evaluateListing };
