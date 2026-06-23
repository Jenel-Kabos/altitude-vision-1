export const VILLES = [
  'Brazzaville',
  'Pointe-Noire',
  'Dolisie',
  'Nkayi',
  'Ouesso',
  'Owando',
  'Sibiti',
  'Impfondo',
  'Madingou',
  'Mossendjo',
  'Kinkala',
  'Loutété',
  'Gamboma',
];

export const ARRONDISSEMENTS = {
  'Brazzaville': [
    'Makélékélé', 'Bacongo', 'Poto-Poto', 'Moungali', 'Ouenzé',
    'Talangaï', 'Mfilou', 'Madibou', 'Djiri',
  ],
  'Pointe-Noire': [
    'Lumumba', 'Mvou-Mvou', 'Tié-Tié', 'Loandjili', 'Ngoyo',
  ],
  'Dolisie':   ['Centre-ville', 'Autres'],
  'Nkayi':     ['Centre-ville', 'Autres'],
  'Ouesso':    ['Centre-ville', 'Autres'],
  'Owando':    ['Centre-ville', 'Autres'],
  'Sibiti':    ['Centre-ville', 'Autres'],
  'Impfondo':  ['Centre-ville', 'Autres'],
  'Madingou':  ['Centre-ville', 'Autres'],
  'Mossendjo': ['Centre-ville', 'Autres'],
  'Kinkala':   ['Centre-ville', 'Autres'],
  'Loutété':   ['Centre-ville', 'Autres'],
  'Gamboma':   ['Centre-ville', 'Autres'],
};

export function getArrondissementsFor(ville) {
  return ARRONDISSEMENTS[ville] || [];
}
