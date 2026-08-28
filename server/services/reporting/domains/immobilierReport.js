// REPORTING-1 — DomainReport Immobilier. Réutilise intégralement
// immobilierReportQueryService (fonction pure, sans req/res) — aucune
// requête Mongo n'est réécrite ici.
const { getImmobilierReportData } = require('../immobilierReportQueryService');

// La query ne supporte aucun filtre de période (audit Phase 1) — la donnée
// renvoyée est un instantané total, jamais présentée comme filtrée.
async function getImmobilierReport({ scopeUserIds } = {}) {
  const data = await getImmobilierReportData({ scopeUserIds });
  return { domain: 'immobilier', periodSupported: false, ...data };
}

module.exports = { getImmobilierReport };
