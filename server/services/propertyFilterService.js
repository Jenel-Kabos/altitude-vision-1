// server/services/propertyFilterService.js — Audit filtrage Altimmo (Web + Mobile)
//
// Point unique de normalisation des paramètres de recherche de biens, réutilisé par toutes
// les routes de listing (properties, hôtels). Convertit la nomenclature canonique ET les
// alias legacy (`server/constants/propertyFilterConstants.js`) vers un filtre MongoDB sûr :
// ville/arrondissement en regex ancrée, insensible à la casse, ÉCHAPPÉE (jamais de
// new RegExp() direct sur une entrée utilisateur) ; prix en `$gte`/`$lte` numériques ;
// valeurs absentes/invalides ignorées silencieusement (jamais d'exception, cohérent avec le
// comportement historique de ces routes publiques).

const { escapeRegex } = require('../utils/regexEscape');
const { LEGACY_QUERY_PARAM_ALIASES, OFFER_TYPES, PROPERTY_TYPES } = require('../constants/propertyFilterConstants');

function firstDefined(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Construit le filtre MongoDB pour `address.city`/`address.arrondissement` à partir d'une
 * valeur brute : égalité exacte, insensible à la casse, ancrée (^...$), échappée. Retourne
 * `undefined` si la valeur est absente, vide, ou vaut un pseudo "toutes" (`tous`, `toutes`,
 * `all` — insensible à la casse), pour rester cohérent avec les conventions déjà en place
 * côté web/mobile (`'Toutes'`, `'Tous'`).
 */
function buildExactCiRegexFilter(rawValue) {
  if (rawValue === undefined || rawValue === null) return undefined;
  const value = String(rawValue).trim();
  if (!value || /^(tous|toutes|all)$/i.test(value)) return undefined;
  return { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') };
}

/**
 * Normalise `req.query` (ou tout objet équivalent) vers le filtre Mongo canonique + les
 * paramètres restants (search, sort, page, limit, fields, et tout passthrough non couvert
 * ici) destinés à continuer d'être traités par `APIFeatures` exactement comme avant.
 *
 * @returns {{ mongoFilter: object, remainingQuery: object }}
 */
function buildPropertyMongoFilter(rawQuery = {}) {
  const query = { ...rawQuery };
  const mongoFilter = {};

  const offerTypeRaw = firstDefined(query, ['offerType', ...LEGACY_QUERY_PARAM_ALIASES.offerType]);
  if (offerTypeRaw !== undefined) {
    const normalized = String(offerTypeRaw).trim().toLowerCase();
    if (OFFER_TYPES.includes(normalized)) mongoFilter.status = normalized;
    // Valeur invalide (ex. 'tous') : ignorée silencieusement, pas de filtre appliqué.
  }
  ['offerType', ...LEGACY_QUERY_PARAM_ALIASES.offerType].forEach((key) => delete query[key]);

  const propertyTypeRaw = firstDefined(query, ['propertyType', ...LEGACY_QUERY_PARAM_ALIASES.propertyType]);
  if (propertyTypeRaw !== undefined) {
    const match = PROPERTY_TYPES.find((t) => t.toLowerCase() === String(propertyTypeRaw).trim().toLowerCase());
    if (match) mongoFilter.type = match;
  }
  ['propertyType', ...LEGACY_QUERY_PARAM_ALIASES.propertyType].forEach((key) => delete query[key]);

  const cityRaw = firstDefined(query, ['city', ...LEGACY_QUERY_PARAM_ALIASES.city]);
  const cityFilter = buildExactCiRegexFilter(cityRaw);
  if (cityFilter) mongoFilter['address.city'] = cityFilter;
  ['city', ...LEGACY_QUERY_PARAM_ALIASES.city].forEach((key) => delete query[key]);

  const arrondissementFilter = buildExactCiRegexFilter(query.arrondissement);
  if (arrondissementFilter) mongoFilter['address.arrondissement'] = arrondissementFilter;
  delete query.arrondissement;

  // minPrice/maxPrice canoniques ; alias legacy price[gte]/price[lte] (qs bracket notation
  // → req.query.price = { gte, lte, gt, lt }).
  const minPriceRaw = query.minPrice !== undefined ? query.minPrice : query.price?.gte ?? query.price?.gt;
  const maxPriceRaw = query.maxPrice !== undefined ? query.maxPrice : query.price?.lte ?? query.price?.lt;
  const minPrice = toFiniteNumber(minPriceRaw);
  const maxPrice = toFiniteNumber(maxPriceRaw);
  if (minPrice !== undefined || maxPrice !== undefined) {
    mongoFilter.price = {};
    if (minPrice !== undefined) mongoFilter.price.$gte = minPrice;
    if (maxPrice !== undefined) mongoFilter.price.$lte = maxPrice;
  }
  delete query.minPrice;
  delete query.maxPrice;
  delete query.price;

  return { mongoFilter, remainingQuery: query };
}

module.exports = { buildPropertyMongoFilter, buildExactCiRegexFilter };
