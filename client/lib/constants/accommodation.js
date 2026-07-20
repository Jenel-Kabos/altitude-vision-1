// client/lib/constants/accommodation.js — synchronisé avec le modèle
// Mongoose server/models/Accommodation.js (Sprint 2). Ne pas ajouter de
// valeur ici sans l'ajouter d'abord côté schéma serveur.

export const ACCOMMODATION_TYPES = [
  { value: "villa_meublee", label: "Villa meublée" },
  { value: "maison_meublee", label: "Maison meublée" },
  { value: "appartement_meuble", label: "Appartement meublé" },
  { value: "studio_meuble", label: "Studio meublé" },
  { value: "residence_meublee", label: "Résidence meublée" },
  { value: "bungalow", label: "Bungalow" },
];

export const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible" },
  { value: "moderee", label: "Modérée" },
  { value: "stricte", label: "Stricte" },
];
