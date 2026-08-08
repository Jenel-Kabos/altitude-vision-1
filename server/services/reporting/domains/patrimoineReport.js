// REPORTING-1 — DomainReport Patrimoine. Réutilise
// propertyAssetPortfolioService.getPortfolioDashboard() (GL-ASSET-UX-1,
// valeur/rentabilité/occupation déjà calculées) et
// valuationMarketAnalyticsService (tendance de marché, déjà utilisée par
// estimationController) — aucune agrégation Property n'est réécrite ici.
const { getPortfolioDashboard } = require('../../propertyAssetPortfolioService');
const { buildMarketHistoryPipeline, finalizeMarketHistory } = require('../../valuationMarketAnalyticsService');
const MarketPriceReference = require('../../../models/MarketPriceReference');

async function getPatrimoineReport({ period = 'month' } = {}) {
  const [portfolio, marketRows] = await Promise.all([
    getPortfolioDashboard({}), // pas de ownerId = portefeuille global (vue Direction)
    MarketPriceReference.aggregate(buildMarketHistoryPipeline({ period, filters: {} })),
  ]);
  return {
    domain: 'patrimoine',
    periodSupported: true, // uniquement pour la tendance de marché
    portfolio,
    marketTrend: finalizeMarketHistory(marketRows),
  };
}

module.exports = { getPatrimoineReport };
