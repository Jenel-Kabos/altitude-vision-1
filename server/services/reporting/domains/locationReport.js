// REPORTING-1 — DomainReport Gestion locative. Réutilise
// dashboardAnalyticsController.rentals() (baux actifs, préavis, vacance,
// paiements, maintenance) — même fonction déjà utilisée par
// /api/dashboard-analytics/rentals.
const { rentals } = require('../../../controllers/dashboardAnalyticsController');

async function getLocationReport({ scopeUserIds } = {}) {
  const data = await rentals({ scopeUserIds });
  return { domain: 'location', periodSupported: false, ...data };
}

module.exports = { getLocationReport };
