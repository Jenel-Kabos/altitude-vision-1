// client/lib/constants/rentalProperty.js — Sprint A (séparation Vente/Location)
// Synchronisé avec server/models/RentalManagement.js et Property.js
// (profilsLocataireRecherches/documentsRequis, mêmes valeurs des deux côtés
// pour les annonces historiques comme pour les nouvelles créées via
// RentalPropertyForm).

export const TENANT_PROFILES = ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'];

export const REQUIRED_DOCUMENTS = [
  'CNI',
  'Justificatif de revenus',
  '2 derniers bulletins de salaire',
  'Caution bancaire',
  'Attestation de travail',
  'Quittance de loyer précédente',
];
