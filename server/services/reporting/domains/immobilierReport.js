// REPORTING-1 — DomainReport Immobilier. Réutilise intégralement
// dashboardAnalyticsController.sales() (déjà une fonction pure, sans
// req/res) — aucune requête Mongo n'est réécrite ici.
const { sales } = require('../../../controllers/dashboardAnalyticsController');

// `sales()` ne supporte aucun filtre de période (audit Phase 1) — la donnée
// renvoyée est un instantané total, jamais présentée comme filtrée.
async function getImmobilierReport() {
  const data = await sales();
  return { domain: 'immobilier', periodSupported: false, ...data };
}

module.exports = { getImmobilierReport };
