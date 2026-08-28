// REPORTING-1 — DomainReport Gestion locative. Réutilise
// rentalReportQueryService (baux actifs, préavis, vacance,
// paiements, maintenance) — même query utilisée par
// /api/dashboard-analytics/rentals.
const { getRentalReportData } = require('../rentalReportQueryService');

async function getLocationReport({ scopeUserIds } = {}) {
  const data = await getRentalReportData({ scopeUserIds });
  return { domain: 'location', periodSupported: false, ...data };
}

module.exports = { getLocationReport };
