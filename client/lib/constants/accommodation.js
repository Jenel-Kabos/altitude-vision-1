// client/lib/constants/accommodation.js — synchronisé avec le modèle
// Mongoose server/models/Accommodation.js (Sprint 2). Ne pas ajouter de
// valeur ici sans l'ajouter d'abord côté schéma serveur.

// Sprint B1 : "hébergement indépendant" (villas/appartements/studios/
// maisons/chambres d'hôtes/résidences meublées) — hotel/residence_hoteliere
// restent dans l'enum serveur (documents existants) mais ne sont plus
// proposés dans ce sous-ensemble : leur écran dédié arrive au Sprint B2
// (Hôtellerie). `residence_meublee` est repromu en type de premier rang à
// la demande explicite du Sprint B1 (elle était reléguée en LEGACY au
// Sprint 2, faute de cas d'usage confirmé à l'époque).
export const INDEPENDENT_ACCOMMODATION_TYPES = [
  { value: "appartement_meuble", label: "Appartement meublé" },
  { value: "villa_meublee", label: "Villa meublée" },
  { value: "maison_meublee", label: "Maison meublée" },
  { value: "studio_meuble", label: "Studio meublé" },
  { value: "chambre_hotes", label: "Chambre d'hôtes" },
  { value: "residence_meublee", label: "Résidence meublée" },
];

export const ACCOMMODATION_TYPES = [
  ...INDEPENDENT_ACCOMMODATION_TYPES,
  { value: "hotel", label: "Hôtel" },
  { value: "residence_hoteliere", label: "Résidence hôtelière" },
  { value: "autre", label: "Autre" },
];

// Valeurs historiques (Sprint 2) : le schéma serveur les accepte encore
// (documents existants, jamais migrés silencieusement), mais elles ne
// doivent plus être proposées à la création. `PropertyForm.jsx` les
// réinjecte dans la liste UNIQUEMENT si la valeur actuelle du formulaire
// (édition d'une annonce existante) en fait partie — voir HEBERGEMENT.md.
export const LEGACY_ACCOMMODATION_TYPES = [
  { value: "bungalow", label: "Bungalow (historique)" },
];

// Sprint B1 — équipements structurés par catégorie (miroir de
// server/models/Accommodation.js AMENITY_CATEGORIES). Purement une liste de
// référence proposée en checkbox : le serveur accepte toute chaîne dans ces
// catégories (pas d'enum strict côté schéma), pour ne jamais nécessiter de
// migration à l'ajout d'un équipement.
export const AMENITY_CATEGORIES = [
  {
    key: "cuisine",
    label: "Cuisine",
    options: ["Four", "Micro-ondes", "Réfrigérateur", "Congélateur", "Plaques de cuisson", "Vaisselle"],
  },
  {
    key: "salon",
    label: "Salon",
    options: ["TV", "Netflix", "Climatisation", "Ventilateur"],
  },
  {
    key: "internet",
    label: "Internet",
    options: ["Wifi"],
  },
  {
    key: "exterieur",
    label: "Extérieur",
    options: ["Piscine", "Jardin", "Terrasse", "Balcon"],
  },
  {
    key: "parking",
    label: "Parking",
    options: ["Privé", "Public"],
  },
  {
    key: "securite",
    label: "Sécurité",
    options: ["Caméra", "Gardien", "Coffre-fort"],
  },
];

// Sprint B1 — services inclus dans le prix (booléens simples, pas de
// tarification additionnelle dans ce sprint).
export const INCLUDED_SERVICES = [
  { key: "menage", label: "Ménage" },
  { key: "petitDejeuner", label: "Petit déjeuner" },
  { key: "blanchisserie", label: "Blanchisserie" },
  { key: "transfert", label: "Transfert" },
  { key: "cuisine", label: "Service de cuisine" },
];

// Sous-ensemble de ACCOMMODATION_TYPES exigeant un rattachement à un
// établissement Hotel (voir server/models/Accommodation.js
// HOTEL_ACCOMMODATION_TYPES).
export const HOTEL_ACCOMMODATION_TYPES = ["hotel"];

export const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible" },
  { value: "moderee", label: "Modérée" },
  { value: "stricte", label: "Stricte" },
];

// Statuts de publication (Sprint B1 : ajout de "suspendu", action admin
// distincte de la désactivation propriétaire — voir ACCOMMODATION_V2.md).
export const PUBLICATION_STATUSES = [
  { value: "brouillon", label: "Brouillon", color: "gray" },
  { value: "soumis", label: "En attente", color: "amber" },
  { value: "publie", label: "Publié", color: "green" },
  { value: "suspendu", label: "Suspendu", color: "orange" },
  { value: "rejete", label: "Rejeté", color: "red" },
];

export const RATE_MODES = [
  { value: "nightly", label: "Par nuit" },
  { value: "weekly", label: "Par semaine" },
  { value: "monthly", label: "Par mois" },
];
