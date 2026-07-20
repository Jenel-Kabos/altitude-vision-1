// client/lib/constants/accommodation.js — synchronisé avec le modèle
// Mongoose server/models/Accommodation.js (Sprint 2). Ne pas ajouter de
// valeur ici sans l'ajouter d'abord côté schéma serveur.

export const ACCOMMODATION_TYPES = [
  { value: "hotel", label: "Hôtel" },
  { value: "appartement_meuble", label: "Appartement meublé" },
  { value: "maison_meublee", label: "Maison meublée" },
  { value: "villa_meublee", label: "Villa meublée" },
  { value: "residence_hoteliere", label: "Résidence hôtelière" },
  { value: "chambre_hotes", label: "Chambre d'hôtes" },
  { value: "studio_meuble", label: "Studio meublé" },
  { value: "autre", label: "Autre" },
];

// Valeurs historiques (Sprint 2) : le schéma serveur les accepte encore
// (documents existants, jamais migrés silencieusement), mais elles ne
// doivent plus être proposées à la création. `PropertyForm.jsx` les
// réinjecte dans la liste UNIQUEMENT si la valeur actuelle du formulaire
// (édition d'une annonce existante) en fait partie — voir HEBERGEMENT.md.
export const LEGACY_ACCOMMODATION_TYPES = [
  { value: "residence_meublee", label: "Résidence meublée (historique)" },
  { value: "bungalow", label: "Bungalow (historique)" },
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
