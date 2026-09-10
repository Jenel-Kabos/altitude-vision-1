// server/services/mapAggregatesService.js — agrégation par localité pour la carte mobile.
//
// Réutilise strictement `propertyFilterService.buildPropertyMongoFilter` et les prédicats
// publics (availability/statusAdmin/isPublished/pole) définis dans `runPropertySearch` afin
// que le count par arrondissement soit RIGOUREUSEMENT identique à ce que retournerait
// `/api/altimmo/search` avec les mêmes filtres + `arrondissement=<label>`.
//
// Aucune coordonnée de propriété n'est jamais retournée : la carte agrégée expose
// uniquement les centres de localités (`server/data/localityCentroids.js`, source OSM/ODbL).

const Property = require('../models/Property');
const { buildPropertyMongoFilter } = require('./propertyFilterService');
const { LOCALITY_CENTROIDS } = require('../data/localityCentroids');

const stripDiacritics = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Clé canonique de comparaison locality-side. On garde toujours le libellé humain
 * (label) séparément — jamais utilisé côté DB pour la comparaison stricte, jamais
 * réécrit en base.
 */
function canonicalLocalityKey(city, arrondissement) {
  const norm = (s) => stripDiacritics(s).toLowerCase().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').trim();
  const c = norm(city);
  const a = norm(arrondissement);
  if (!c || !a) return null;
  return `${c}:${a}`;
}

const CENTROIDS_BY_KEY = new Map(
  LOCALITY_CENTROIDS.map((e) => [canonicalLocalityKey(e.city, e.arrondissement), e]),
);

function centroidFor(city, arrondissement) {
  const key = canonicalLocalityKey(city, arrondissement);
  return key ? CENTROIDS_BY_KEY.get(key) || null : null;
}

/**
 * Construit le filtre Mongo utilisé par la recherche publique (parité stricte avec
 * runPropertySearch, mode non-admin). Ne prend en charge que Property (Vente/Location) —
 * les hébergements publics passent par accommodationSearchService et ont leur propre
 * projection ; cette carte de premier niveau se concentre sur les biens Altimmo.
 */
function buildPublicPropertyMatch(rawQuery) {
  const workingQuery = { ...rawQuery };
  // Aucun paramètre imposé par le client sur ces prédicats — même contrat que
  // runPropertySearch.
  ['statusAdmin', 'isPublished', 'availability', 'pole', 'tenant', 'accommodationType']
    .forEach((k) => delete workingQuery[k]);
  const { mongoFilter } = buildPropertyMongoFilter(workingQuery);
  return {
    availability: 'Disponible',
    statusAdmin: 'Validée',
    isPublished: true,
    pole: 'Altimmo',
    ...mongoFilter,
  };
}

/**
 * Retourne les compteurs par localité pour la carte agrégée mobile.
 *
 * @returns {Promise<{ total: number, mappedTotal: number, unmappedTotal: number,
 *   areas: Array<{ key: string, city: string, label: string, count: number,
 *   latitude: number, longitude: number }> }>}
 */
async function aggregateByLocality(rawQuery = {}) {
  const match = buildPublicPropertyMatch(rawQuery);
  const rows = await Property.aggregate([
    { $match: match },
    { $group: { _id: { city: '$address.city', arr: '$address.arrondissement' }, count: { $sum: 1 } } },
  ]);

  // Fusion des variantes typographiques ("Poto Poto" / "POTO-POTO" / "Ouenzé"
  // vs "OUENZE"...) : deux documents groupés séparément par $group deviennent
  // une seule area si leur `canonicalLocalityKey` est identique. La DB n'est
  // jamais réécrite — normalisation read-side uniquement (ADR mission §4).
  const byKey = new Map();
  let mappedTotal = 0;
  let unmappedTotal = 0;

  for (const row of rows) {
    const city = row._id?.city;
    const arr = row._id?.arr;
    const count = row.count || 0;
    const centroid = centroidFor(city, arr);
    if (!centroid) { unmappedTotal += count; continue; }
    const key = canonicalLocalityKey(centroid.city, centroid.arrondissement);
    const prev = byKey.get(key);
    if (prev) {
      prev.count += count;
    } else {
      byKey.set(key, {
        key, city: centroid.city, label: centroid.arrondissement, count,
        latitude: centroid.latitude, longitude: centroid.longitude,
      });
    }
    mappedTotal += count;
  }

  const areas = Array.from(byKey.values())
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  return {
    total: mappedTotal + unmappedTotal,
    mappedTotal,
    unmappedTotal,
    areas,
  };
}

module.exports = {
  canonicalLocalityKey,
  centroidFor,
  buildPublicPropertyMatch,
  aggregateByLocality,
};
