const Property = require('../models/Property');
const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const userKpiService = require('./userKpiService');

async function getDashboardKpis() {
  const [propertyCount, eventCount, usersCount, kpis, portfolioCount] = await Promise.all([
    Property.countDocuments(),
    Event.countDocuments(),
    User.countDocuments(),
    userKpiService.getUserKpiSummary(),
    PortfolioItem.countDocuments({ isPublished: true }),
  ]);

  return {
    Altimmo: propertyCount,
    MilaEvents: eventCount,
    Altcom: portfolioCount,
    Users: usersCount,
    Owners: kpis.proprietaires,
  };
}

module.exports = { getDashboardKpis };
