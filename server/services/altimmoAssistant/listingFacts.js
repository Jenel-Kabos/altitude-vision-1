// ALTIMMO-AI-DATA-READINESS-01 — valeurs d'annonce réellement connues, pour l'évaluation du moteur.
//
// Sur `main`, `Property.bedrooms` et `bathrooms` valent 0 par défaut (schéma), et l'application mobile
// envoie 0 quand le compteur n'est pas touché : sur un logement, un 0 ne distingue pas « aucune
// chambre » de « non renseigné ». Le moteur le traite donc comme INCONNU (« à vérifier »), jamais
// comme une valeur établie. Aucune donnée n'est modifiée : seule l'interprétation par l'assistant
// change. Pour un studio, un terrain, un bureau, un commerce ou un entrepôt, 0 reste une valeur connue.
const ROOM_COUNT_FIELDS = Object.freeze(['bedrooms', 'bathrooms']);
const AMBIGUOUS_ZERO_TYPES = Object.freeze(['Appartement', 'Appartement meublé', 'Maison', 'Villa']);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** 0 chambre ou salle de bain sur un logement : valeur par défaut indiscernable d'une absence. */
function isAmbiguousZero(listing, field) {
  return ROOM_COUNT_FIELDS.includes(field) && listing?.[field] === 0 && AMBIGUOUS_ZERO_TYPES.includes(listing?.type);
}

module.exports = { ROOM_COUNT_FIELDS, AMBIGUOUS_ZERO_TYPES, isFiniteNumber, isAmbiguousZero };
