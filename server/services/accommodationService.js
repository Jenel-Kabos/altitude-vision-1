// server/services/accommodationService.js
//
// Logique métier Hébergement : complétude, publication/rejet, visibilité
// publique, sérialisation. Pattern calqué sur rentalListingSyncService.js
// (Sprint 1.5 §02) mais volontairement plus simple : pas de workflow
// d'occupation, pas de bail, pas de maintenance — hors périmètre Sprint 2.

const ACCOMMODATION_REQUIRED_FIELDS = [
  ['accommodationType', (acc) => Boolean(acc.accommodationType)],
  ['capacity', (acc) => Number(acc.capacity?.maxAdults) > 0],
  ['checkInTime', (acc) => Boolean(acc.checkInTime)],
  ['checkOutTime', (acc) => Boolean(acc.checkOutTime)],
];

// bedrooms/bathrooms sont vérifiés sur Property (source de vérité unique,
// voir Accommodation.js) et non sur Accommodation lui-même.
const PROPERTY_REQUIRED_FIELDS = [
  ['bedrooms', (property) => Number.isFinite(property?.bedrooms)],
  ['bathrooms', (property) => Number(property?.bathrooms) > 0],
];

/**
 * Un hébergement est-il prêt (données propres + bien complètes) pour être
 * soumis ? `property` est requis pour vérifier bedrooms/bathrooms — la
 * complétude du reste de Property (titre, photos, adresse…) est déjà
 * validée par ses propres règles, inchangées.
 */
function evaluateReadiness(accommodation, property) {
  const missingFields = [
    ...ACCOMMODATION_REQUIRED_FIELDS.filter(([, test]) => !test(accommodation)),
    ...PROPERTY_REQUIRED_FIELDS.filter(([, test]) => !test(property)),
  ].map(([field]) => field);
  return { ready: missingFields.length === 0, missingFields };
}

/**
 * Un hébergement est visible publiquement seulement si :
 *  - Property est publiable selon les règles EXISTANTES (statusAdmin
 *    'Validée' + availability 'Disponible') — inchangé, jamais réévalué ici ;
 *  - Accommodation.publicationStatus === 'publie'.
 * Vente/Location ne passent jamais par cette fonction — leur visibilité
 * reste 100% gouvernée par Property seul, comme avant ce sprint.
 */
function isPubliclyVisible(property, accommodation) {
  if (!property || property.statusAdmin !== 'Validée' || property.availability !== 'Disponible') {
    return false;
  }
  if (property.status !== 'hebergement') return true; // règle Vente/Location inchangée
  return accommodation?.publicationStatus === 'publie';
}

function serializeAccommodation(doc, rates = []) {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : { ...doc };
  return { ...raw, rates };
}

module.exports = {
  evaluateReadiness, isPubliclyVisible, serializeAccommodation,
  ACCOMMODATION_REQUIRED_FIELDS, PROPERTY_REQUIRED_FIELDS,
};
