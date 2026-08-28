const Event = require('../models/Event');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const PortfolioItem = require('../models/portfolioItemModel');
const userKpiService = require('./userKpiService');
const { getPropertyPortfolioForTenantScope } = require('./propertyPortfolioService');

// HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — même relation canonique que
// `contratController.scopedContratFilterForTenant` (Property.owner ->
// OrgMembership) et même portée que le compteur "Altimmo" ci-dessus
// (`getPropertyPortfolioForTenantScope`) : ce KPI ne doit jamais résoudre le
// tenant une seconde fois avec un mécanisme parallèle.
async function countActiveRentalContractsForTenantScope({ scopeUserIds = [] } = {}) {
  if (!Array.isArray(scopeUserIds) || scopeUserIds.length === 0) return 0;
  const propertyIds = await Property.find({ owner: { $in: scopeUserIds } }).distinct('_id');
  if (propertyIds.length === 0) return 0;
  return Contrat.countDocuments({ bien: { $in: propertyIds }, type: 'location', statut: 'actif' });
}

async function getDashboardKpis({ scopeUserIds = [] } = {}) {
  const [propertyPortfolio, eventCount, usersCount, kpis, portfolioCount, rentalActiveContracts] = await Promise.all([
    getPropertyPortfolioForTenantScope({ scopeUserIds }),
    Event.countDocuments(),
    User.countDocuments(),
    userKpiService.getUserKpiSummary(),
    PortfolioItem.countDocuments({ isPublished: true }),
    countActiveRentalContractsForTenantScope({ scopeUserIds }),
  ]);

  return {
    Altimmo: propertyPortfolio.stats.total,
    MilaEvents: eventCount,
    Altcom: portfolioCount,
    Users: usersCount,
    Owners: kpis.proprietaires,
    RentalActiveContracts: rentalActiveContracts,
  };
}

module.exports = { getDashboardKpis };
