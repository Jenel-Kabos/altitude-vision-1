// REPORTING-1 — DomainReport Finance transversale. Réutilise
// crmService.getDashboard().commercial.revenueByPole — déjà un
// FinancialDocument.aggregate groupé par domain (hotel/real_estate/rental/
// visit/altcom/mila_events) — et le détail hôtelier déjà period-aware de
// hotelFinancialDashboardService. Aucune nouvelle agrégation financière
// globale n'est créée : un vrai "P&L multi-domaines" nécessiterait une
// décision de modélisation (quelles charges soustraire, quel domaine
// consolider) qui dépasse le périmètre technique de ce sprint — documenté
// en dette plutôt qu'inventé.
const { getDashboard } = require('../../crmService');

// `crmDashboard` peut être injecté par l'orchestrateur pour éviter un second
// appel à la même agrégation (voir reportingService.js) ; sinon recalculé.
async function getFinanceReport({ crmDashboard, tenantId } = {}) {
  const dashboard = crmDashboard || await getDashboard(new Date(), { tenantId });
  return {
    domain: 'finance', periodSupported: false,
    revenueByPole: dashboard.commercial.revenueByPole,
    conversionRate: dashboard.commercial.conversionRate,
    note: "P&L consolidé multi-domaines non disponible : nécessiterait une décision de modélisation des charges hors périmètre technique (voir rapport final §10).",
  };
}

module.exports = { getFinanceReport };
