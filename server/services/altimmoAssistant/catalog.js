const { PROPERTY_TYPES, ACCOMMODATION_TYPES } = require('../../constants/propertyFilterConstants');

const TRANSACTIONS = Object.freeze(['BUY', 'RENT', 'STAY']);
const CURRENCIES = Object.freeze(['XAF', 'EUR', 'USD']);
const PERIODS = Object.freeze(['TOTAL', 'NIGHT', 'MONTH']);
const AMENITIES = Object.freeze({
  parking: ['parking', 'garage'], pool: ['piscine'], garden: ['jardin'], terrace: ['terrasse', 'balcon'],
  air_conditioning: ['climatisation', 'climatise', 'clim'], wifi: ['wifi', 'wi-fi', 'internet'],
  security: ['securite', 'gardien', 'gardiennage'], generator: ['groupe electrogene', 'generateur'],
  borehole: ['forage'], furnished: ['meuble', 'meublee'], equipped_kitchen: ['cuisine equipee'],
});
const PROXIMITIES = Object.freeze({
  market: ['marche'], school: ['ecole', 'college', 'lycee'], health: ['hopital', 'clinique', 'centre de sante'],
  pharmacy: ['pharmacie'], transport: ['transport', 'arret de bus', 'gare'], supermarket: ['supermarche'],
  bank: ['banque'], worship: ['eglise', 'mosquee'],
});
const CITIES = Object.freeze(['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Ouesso', 'Owando', 'Sibiti', 'Impfondo', 'Madingou', 'Mossendjo', 'Kinkala', 'Loutété', 'Gamboma']);
const DISTRICTS = Object.freeze({
  Brazzaville: Object.freeze(['Makélékélé', 'Bacongo', 'Poto-Poto', 'Moungali', 'Ouenzé', 'Talangaï', 'Mfilou', 'Madibou', 'Djiri']),
  'Pointe-Noire': Object.freeze(['Lumumba', 'Mvou-Mvou', 'Tié-Tié', 'Loandjili', 'Ngoyo']),
});

module.exports = Object.freeze({
  PROPERTY_TYPES: Object.freeze([...PROPERTY_TYPES]), ACCOMMODATION_TYPES: Object.freeze([...ACCOMMODATION_TYPES]),
  TRANSACTIONS, CURRENCIES, PERIODS, AMENITIES, PROXIMITIES, CITIES, DISTRICTS,
  MAX_INPUT_LENGTH: 500, MAX_AMOUNT: 100_000_000_000, DEFAULT_PROXIMITY_RADIUS: 1500,
});
