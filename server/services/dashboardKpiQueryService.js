const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const userKpiService = require('./userKpiService');
const { getPropertyPortfolioForTenantScope } = require('./propertyPortfolioService');

async function getDashboardKpis({ scopeUserIds = [] } = {}) {
  const [propertyPortfolio, eventCount, usersCount, kpis, portfolioCount] = await Promise.all([
    getPropertyPortfolioForTenantScope({ scopeUserIds }),
    Event.countDocuments(),
    User.countDocuments(),
    userKpiService.getUserKpiSummary(),
    PortfolioItem.countDocuments({ isPublished: true }),
  ]);

  return {
    Altimmo: propertyPortfolio.stats.total,
    MilaEvents: eventCount,
    Altcom: portfolioCount,
    Users: usersCount,
    Owners: kpis.proprietaires,
  };
}

module.exports = { getDashboardKpis };
