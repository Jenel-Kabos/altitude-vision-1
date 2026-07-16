const PROPERTY_TYPES = [
  'Terrain nu', 'Maison individuelle', 'Villa', 'Duplex', 'Appartement',
  'Immeuble résidentiel', 'Immeuble mixte', 'Bureau', 'Local commercial',
  'Entrepôt', 'Hôtel', 'Parcelle agricole', 'Ferme', 'Autre',
  // Valeurs historiques du formulaire public, conservées pendant la migration.
  'Maison', 'Terrain', 'Commerce', 'Studio', 'Appartement meublé',
];

const ESTIMATION_STATUSES = [
  'Brouillon', 'En attente', 'Informations incomplètes', 'En cours',
  'Visite programmée', 'Calcul automatique terminé', 'Révision expert',
  'En attente de validation', 'Validée', 'Rapport publié', 'Traitée', 'Annulée', 'Archivée',
];

const CONFIDENCE_THRESHOLDS = { low: 40, medium: 70, good: 85 };
const MIN_MARKET_TREND_SAMPLE_SIZE = 3;
const VALUATION_PAGE_LIMITS = { default: 20, max: 50, comparisonMax: 4 };
const COMPARABLE_THRESHOLDS = {
  maxWeight: 1,
  recentMonths: 12,
  staleMonths: 36,
  nearDistanceKm: 2,
  mediumDistanceKm: 10,
  farDistanceKm: 30,
};
const CURRENCY = 'XAF';
const CONSTRUCTION_CATEGORIES = ['économique', 'standard', 'confort', 'premium', 'industriel', 'autre'];
const COEFFICIENT_CATEGORIES = ['localisation', 'accessibilité', 'état', 'matériaux', 'documents', 'risque', 'terrain', 'équipements', 'potentiel commercial'];

module.exports = { PROPERTY_TYPES, ESTIMATION_STATUSES, CONFIDENCE_THRESHOLDS, COMPARABLE_THRESHOLDS, MIN_MARKET_TREND_SAMPLE_SIZE, VALUATION_PAGE_LIMITS, CURRENCY, CONSTRUCTION_CATEGORIES, COEFFICIENT_CATEGORIES };
