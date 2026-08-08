// REPORTING-1 — DomainReport Accommodation. Réutilise
// dashboardAnalyticsController.accommodations() (taux d'occupation,
// réservations, encaissements — déjà mensuel).
const { accommodations } = require('../../../controllers/dashboardAnalyticsController');
const AccommodationReservation = require('../../../models/AccommodationReservation');

// Durée moyenne de séjour (Gap Phase 1 §6) : seule agrégation réellement
// nouvelle de ce sprint pour ce domaine — `nights` est déjà un champ stocké
// sur AccommodationReservation (calculé à la création), jamais recalculé
// depuis les dates ici.
async function averageStayLength() {
  const [row] = await AccommodationReservation.aggregate([
    { $match: { status: { $in: ['confirmed', 'checked_in', 'checked_out'] } } },
    { $group: { _id: null, averageNights: { $avg: '$nights' } } },
  ]);
  return row ? Math.round(row.averageNights * 10) / 10 : null;
}

async function getAccommodationReport() {
  const [data, avgStay] = await Promise.all([accommodations(), averageStayLength()]);
  return { domain: 'accommodation', periodSupported: false, ...data, averageStayNights: avgStay };
}

module.exports = { getAccommodationReport };
