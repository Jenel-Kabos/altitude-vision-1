// server/services/accommodationSearchService.js — correctif architecture recherche Altimmo
// (2026-07-25)
//
// La recherche « Hébergement » ne doit JAMAIS interroger Property.status==='hebergement' seul
// (ça fonctionnait déjà pour exclure Vente/Location, mais ça ne permettait aucun filtre par
// vraie catégorie d'hébergement et le frontend ne proposait donc que les types de biens
// Vente/Location — Terrain, Bureau, Commerce, Entrepôt — dénués de sens pour un hébergement).
// Ce service interroge directement `Accommodation` (source de vérité des catégories
// d'hébergement réelles, `accommodationType`), ne retourne QUE des hébergements publiés et
// disponibles, et ne peut structurellement jamais renvoyer une annonce Vente ou Location
// (collection différente).

const Accommodation = require('../models/Accommodation');
const { escapeRegex } = require('../utils/regexEscape');
const { ACCOMMODATION_TYPES } = require('../constants/propertyFilterConstants');
const { buildExactCiRegexFilter, firstDefined, toFiniteNumber } = require('./propertyFilterService');

/**
 * @param {object} rawQuery — req.query (ou équivalent) : accommodationType, city (alias
 *   ville), arrondissement, minPrice, maxPrice, search, sort, page, limit. `propertyType` est
 *   silencieusement ignoré (n'a pas de sens pour un hébergement — voir mission §4).
 * @returns {Promise<{properties: object[], total: number, page: number, limit: number}>}
 */
async function searchPublicAccommodations(rawQuery = {}) {
  const accommodationTypeRaw = rawQuery.accommodationType;
  let accommodationType;
  if (accommodationTypeRaw !== undefined && accommodationTypeRaw !== '') {
    const normalized = String(accommodationTypeRaw).trim().toLowerCase();
    if (ACCOMMODATION_TYPES.includes(normalized)) accommodationType = normalized;
    // Valeur invalide/inconnue : ignorée silencieusement (cohérent avec propertyFilterService).
  }

  const cityFilter = buildExactCiRegexFilter(firstDefined(rawQuery, ['city', 'ville']));
  const arrondissementFilter = buildExactCiRegexFilter(rawQuery.arrondissement);
  const minPrice = toFiniteNumber(rawQuery.minPrice);
  const maxPrice = toFiniteNumber(rawQuery.maxPrice);

  const propertyMatch = {
    statusAdmin: 'Validée',
    availability: 'Disponible',
    pole: 'Altimmo',
    status: 'hebergement',
    ...(cityFilter ? { 'address.city': cityFilter } : {}),
    ...(arrondissementFilter ? { 'address.arrondissement': arrondissementFilter } : {}),
  };
  if (minPrice !== undefined || maxPrice !== undefined) {
    propertyMatch.price = {};
    if (minPrice !== undefined) propertyMatch.price.$gte = minPrice;
    if (maxPrice !== undefined) propertyMatch.price.$lte = maxPrice;
  }
  if (rawQuery.search) {
    const regex = new RegExp(escapeRegex(rawQuery.search), 'i');
    propertyMatch.$or = [{ title: regex }, { description: regex }, { 'address.arrondissement': regex }];
  }

  const accommodations = await Accommodation.find({
    publicationStatus: 'publie',
    active: { $ne: false },
    ...(accommodationType ? { accommodationType } : {}),
  })
    .populate({ path: 'property', match: propertyMatch })
    .lean();

  const visible = accommodations.filter((a) => a.property);

  const sort = rawQuery.sort;
  if (sort === 'price' || sort === '-price') {
    const dir = sort.startsWith('-') ? -1 : 1;
    visible.sort((a, b) => dir * ((a.property.price || 0) - (b.property.price || 0)));
  } else {
    visible.sort((a, b) => new Date(b.property.createdAt || 0) - new Date(a.property.createdAt || 0));
  }

  const total = visible.length;
  const page = Math.max(1, Number(rawQuery.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(rawQuery.limit) || 10));
  const start = (page - 1) * limit;

  const properties = visible.slice(start, start + limit).map((a) => ({
    ...a.property,
    accommodationType: a.accommodationType,
    accommodationId: a._id,
    // PHASE-H1.5 — même clé que runPropertySearch (propertyController.js)
    // pour un contrat unique côté consommateur, quel que soit le chemin.
    hotel: a.hotel || null,
  }));

  return { properties, total, page, limit };
}

module.exports = { searchPublicAccommodations };
