// client/lib/constants/hotel.js — Sprint B2 (domaine Hôtellerie), synchronisé
// avec server/models/Hotel.js (HOTEL_SERVICE_KEYS) et RatePlan.js (RATE_TYPES).

export const HOTEL_SERVICES = [
  { key: "restaurant", label: "Restaurant" },
  { key: "bar", label: "Bar" },
  { key: "piscine", label: "Piscine" },
  { key: "spa", label: "Spa" },
  { key: "salleSport", label: "Salle de sport" },
  { key: "salleConference", label: "Salle de conférence" },
  { key: "navette", label: "Navette" },
  { key: "parking", label: "Parking" },
  { key: "reception24h", label: "Réception 24h/24" },
  { key: "wifi", label: "Wi-Fi" },
];

export const HOTEL_RATE_TYPES = [
  { value: "public", label: "Tarif public" },
  { value: "entreprise", label: "Tarif entreprise" },
  { value: "weekend", label: "Tarif week-end" },
  { value: "promotion", label: "Tarif promotion" },
  { value: "haute_saison", label: "Tarif haute saison" },
];

export const HOTEL_PUBLICATION_STATUSES = [
  { value: "brouillon", label: "Brouillon", color: "gray" },
  { value: "soumis", label: "En attente", color: "amber" },
  { value: "publie", label: "Publié", color: "green" },
  { value: "suspendu", label: "Suspendu", color: "orange" },
  { value: "rejete", label: "Rejeté", color: "red" },
];

export const ROOM_CATEGORY_SUGGESTIONS = [
  "Standard", "Deluxe", "Suite", "Suite familiale", "Suite présidentielle",
];

// PHASE-H5/HX1 — synchronisé avec server/models/RatePlan.js (MEAL_PLANS/
// CANCELLATION_TYPES/PENALTY_TYPES). N'expose QUE les concepts H5
// réellement implémentés — jamais paymentPolicy (différé, voir
// HOTEL_H5_REPORT.md "Payment policy: DEFERRED").
export const HOTEL_MEAL_PLANS = [
  { value: "room_only", label: "Chambre seule" },
  { value: "breakfast_included", label: "Petit-déjeuner inclus" },
  { value: "half_board", label: "Demi-pension" },
  { value: "full_board", label: "Pension complète" },
];

export const HOTEL_CANCELLATION_TYPES = [
  { value: "free_until", label: "Annulation gratuite jusqu'à un délai" },
  { value: "flexible", label: "Flexible (pénalité après délai)" },
  { value: "non_refundable", label: "Non remboursable" },
];

export const HOTEL_PENALTY_TYPES = [
  { value: "percentage", label: "Pourcentage du montant" },
  { value: "fixed_amount", label: "Montant fixe" },
];
