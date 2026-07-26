// Équipements d'hébergement, groupés par catégorie du schéma `Accommodation.amenities`
// (server/models/Accommodation.js : cuisine/salon/internet/exterieur/parking/securite).
// Distinct de `constants/amenities.js` (liste plate utilisée pour Property/filtres) —
// ici la forme groupée est imposée par le modèle backend, pas une duplication.

export const ACCOMMODATION_AMENITY_GROUPS = [
  {
    key: 'internet',
    label: 'Internet',
    options: ['Wifi'],
  },
  {
    key: 'cuisine',
    label: 'Cuisine',
    options: ['Cuisine équipée', 'Réfrigérateur', 'Four à micro-ondes'],
  },
  {
    key: 'salon',
    label: 'Salon',
    options: ['Télévision', 'Climatisation'],
  },
  {
    key: 'exterieur',
    label: 'Extérieur',
    options: ['Piscine', 'Terrasse', 'Jardin'],
  },
  {
    key: 'parking',
    label: 'Parking',
    options: ['Parking privé'],
  },
  {
    key: 'securite',
    label: 'Sécurité',
    options: ['Gardien', 'Vidéosurveillance'],
  },
];

export const ACCOMMODATION_AMENITY_KEYS = ACCOMMODATION_AMENITY_GROUPS.map((g) => g.key);
