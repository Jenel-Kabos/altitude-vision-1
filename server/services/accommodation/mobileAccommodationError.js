// Erreur typée à code stable pour le parcours de publication mobile Hébergement
// atomique — même pattern que `services/hotel/hotelAccessError.js` (F2.6.3) :
// le code est stable et interrogeable par l'appelant (mobile, tests), le message
// est destiné à l'affichage, `statusCode` porte le code HTTP attendu par le
// contrôleur.
class MobileAccommodationError extends Error {
  constructor(code, message, statusCode = 422, extra = {}) {
    super(message);
    this.name = 'MobileAccommodationError';
    this.code = code;
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

const fail = (code, message, statusCode = 422, extra = {}) => {
  throw new MobileAccommodationError(code, message, statusCode, extra);
};

module.exports = { MobileAccommodationError, fail };
