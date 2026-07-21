// client/lib/constants/saleProperty.js — Sprint A (séparation Vente/Location)
// Synchronisé avec server/models/SaleManagement.js.

export const LEGAL_STATUSES = [
  { value: 'non_renseigne', label: 'Non renseigné' },
  { value: 'regularise', label: 'Régularisé' },
  { value: 'en_cours_regularisation', label: 'En cours de régularisation' },
  { value: 'litigieux', label: 'Litigieux' },
];
