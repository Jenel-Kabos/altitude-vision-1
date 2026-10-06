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
async function countActiveRentalContractsForTenantScope({ scopeUserIds = [], tenantId = null } = {}) {
  // C2.10A — en contexte tenant, la population des baux est Property.tenant = T
  // (même population que la Gestion locative, cf. rentalScopeService), indépendante des memberships
  // des propriétaires. Hors tenant, comportement historique inchangé.
  if (tenantId) {
    const tenantPropertyIds = await Property.find({ tenant: tenantId }).distinct('_id');
    return tenantPropertyIds.length
      ? Contrat.countDocuments({ bien: { $in: tenantPropertyIds }, type: 'location', statut: 'actif' })
      : 0;
  }
  if (!Array.isArray(scopeUserIds) || scopeUserIds.length === 0) return 0;
  const propertyIds = await Property.find({ owner: { $in: scopeUserIds } }).distinct('_id');
  if (propertyIds.length === 0) return 0;
  return Contrat.countDocuments({ bien: { $in: propertyIds }, type: 'location', statut: 'actif' });
}

async function getDashboardKpis({ scopeUserIds = [], tenantId = null } = {}) {
  if (tenantId) {
    const [propertyPortfolio, usersCount, ownerIds, rentalActiveContracts] = await Promise.all([
      getPropertyPortfolioForTenantScope({ scopeUserIds, tenantId }),
      User.countDocuments({ _id: { $in: scopeUserIds } }),
      userKpiService.getProprietaireUserIds(),
      countActiveRentalContractsForTenantScope({ scopeUserIds, tenantId }),
    ]);
    const scopedIds = new Set(scopeUserIds.map(String));
    return {
      Altimmo: propertyPortfolio.stats.total,
      // Event and PortfolioItem do not carry a certified tenant attribution.
      // They remain zero here rather than leaking global data into a tenant.
      MilaEvents: 0,
      Altcom: 0,
      Users: usersCount,
      Owners: ownerIds.filter((id) => scopedIds.has(String(id))).length,
      RentalActiveContracts: rentalActiveContracts,
    };
  }
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
