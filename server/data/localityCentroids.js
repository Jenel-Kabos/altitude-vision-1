// server/data/localityCentroids.js — centroïdes canoniques par ville/arrondissement.
//
// Source : OpenStreetMap — https://www.openstreetmap.org
// Licence : Open Database License (ODbL) — https://www.openstreetmap.org/copyright
// Attribution requise : © OpenStreetMap contributors.
//
// Résolus le 2026-09-10 via Nominatim (usage manuel unique — jamais appelé au runtime).
// Ordre de préférence : boundary/administrative (relation) → place/city|suburb (node).
// Chaque entrée conserve son OSM ID et son type pour permettre un audit ultérieur.
//
// IMPORTANT : ce fichier ne contient AUCUNE coordonnée provenant d'une propriété
// utilisateur (`Property.address.coordinates`). Il est utilisé uniquement pour
// représenter le CENTRE d'une localité sur la carte agrégée mobile.

const LOCALITY_CENTROIDS = Object.freeze([
  // ── Brazzaville — 9 arrondissements ─────────────────────────────────────
  { city: 'Brazzaville', arrondissement: 'Makélékélé', latitude: -4.2915008, longitude: 15.2338680, source: 'OpenStreetMap', osmType: 'relation', osmId: 16356192, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Bacongo',    latitude: -4.2935218, longitude: 15.2620062, source: 'OpenStreetMap', osmType: 'relation', osmId: 16357002, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Poto-Poto',  latitude: -4.2726398, longitude: 15.2775717, source: 'OpenStreetMap', osmType: 'relation', osmId: 16357198, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Moungali',   latitude: -4.2433802, longitude: 15.2669867, source: 'OpenStreetMap', osmType: 'relation', osmId: 16359029, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Ouenzé',     latitude: -4.2436991, longitude: 15.2840585, source: 'OpenStreetMap', osmType: 'node',     osmId: 436070754, verified: 'node' },
  { city: 'Brazzaville', arrondissement: 'Talangaï',   latitude: -4.2223134, longitude: 15.2953989, source: 'OpenStreetMap', osmType: 'relation', osmId: 16363022, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Mfilou',     latitude: -4.2177160, longitude: 15.2188006, source: 'OpenStreetMap', osmType: 'relation', osmId: 16365154, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Madibou',    latitude: -4.3120598, longitude: 15.1837685, source: 'OpenStreetMap', osmType: 'relation', osmId: 16370379, verified: 'boundary' },
  { city: 'Brazzaville', arrondissement: 'Djiri',      latitude: -4.1604818, longitude: 15.2742446, source: 'OpenStreetMap', osmType: 'relation', osmId: 16370647, verified: 'boundary' },
  // ── Pointe-Noire — 5 arrondissements ────────────────────────────────────
  { city: 'Pointe-Noire', arrondissement: 'Lumumba',   latitude: -4.7975373, longitude: 11.8503297, source: 'OpenStreetMap', osmType: 'node',     osmId: 2448258134, verified: 'node' },
  { city: 'Pointe-Noire', arrondissement: 'Mvou-Mvou', latitude: -4.7753627, longitude: 11.8666827, source: 'OpenStreetMap', osmType: 'relation', osmId: 9316600, verified: 'boundary' },
  { city: 'Pointe-Noire', arrondissement: 'Tié-Tié',   latitude: -4.7910491, longitude: 11.9249938, source: 'OpenStreetMap', osmType: 'relation', osmId: 16243251, verified: 'boundary' },
  { city: 'Pointe-Noire', arrondissement: 'Loandjili', latitude: -4.7380291, longitude: 11.9403588, source: 'OpenStreetMap', osmType: 'relation', osmId: 16243463, verified: 'boundary' },
  { city: 'Pointe-Noire', arrondissement: 'Ngoyo',     latitude: -4.8643142, longitude: 11.9268418, source: 'OpenStreetMap', osmType: 'relation', osmId: 9316592, verified: 'boundary' },
]);

module.exports = { LOCALITY_CENTROIDS };
