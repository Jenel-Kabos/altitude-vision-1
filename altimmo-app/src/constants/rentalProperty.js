// Miroir du contrat Property/RentalManagement. Centralisé pour empêcher les
// formulaires de location mobile de diverger des valeurs acceptées par MongoDB.
export const TENANT_PROFILES = [
  'Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité',
];

export const REQUIRED_DOCUMENTS = [
  'CNI',
  'Justificatif de revenus',
  '2 derniers bulletins de salaire',
  'Caution bancaire',
  'Attestation de travail',
  'Quittance de loyer précédente',
];
