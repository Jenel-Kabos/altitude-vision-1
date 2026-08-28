jest.mock('../models/Event', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/User', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/portfolioItemModel', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/Property', () => ({ find: jest.fn() }));
jest.mock('../models/Contrat', () => ({ countDocuments: jest.fn() }));
jest.mock('../services/userKpiService', () => ({ getUserKpiSummary: jest.fn() }));
jest.mock('../services/propertyPortfolioService', () => ({ getPropertyPortfolioForTenantScope: jest.fn() }));

const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const userKpiService = require('../services/userKpiService');
const { getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');

describe('dashboardKpiQueryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Property.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue([]) });
    Contrat.countDocuments.mockResolvedValue(0);
  });

  test('utilise le total de la même projection tenant-scopée que « Tous les biens »', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 8 } });
    Event.countDocuments.mockResolvedValue(3);
    User.countDocuments.mockResolvedValue(21);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 5 });
    PortfolioItem.countDocuments.mockResolvedValue(4);
    Property.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(['property-1']) });
    Contrat.countDocuments.mockResolvedValue(2);

    await expect(getDashboardKpis({ scopeUserIds: ['staff-1'] })).resolves.toEqual({
      Altimmo: 8,
      MilaEvents: 3,
      Altcom: 4,
      Users: 21,
      Owners: 5,
      RentalActiveContracts: 2,
    });
    expect(getPropertyPortfolioForTenantScope).toHaveBeenCalledWith({ scopeUserIds: ['staff-1'] });
    expect(Event.countDocuments).toHaveBeenCalledWith();
    expect(User.countDocuments).toHaveBeenCalledWith();
    expect(userKpiService.getUserKpiSummary).toHaveBeenCalledWith();
    expect(PortfolioItem.countDocuments).toHaveBeenCalledWith({ isPublished: true });
    expect(Property.find).toHaveBeenCalledWith({ owner: { $in: ['staff-1'] } });
    expect(Contrat.countDocuments).toHaveBeenCalledWith({ bien: { $in: ['property-1'] }, type: 'location', statut: 'actif' });
  });

  test('retourne six zéros lorsque les sources sont vides', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 0 } });
    Event.countDocuments.mockResolvedValue(0);
    User.countDocuments.mockResolvedValue(0);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 0 });
    PortfolioItem.countDocuments.mockResolvedValue(0);

    await expect(getDashboardKpis()).resolves.toEqual({
      Altimmo: 0,
      MilaEvents: 0,
      Altcom: 0,
      Users: 0,
      Owners: 0,
      RentalActiveContracts: 0,
    });
  });

  test('propage une erreur de lecture à la frontière HTTP', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 8 } });
    Event.countDocuments.mockRejectedValue(new Error('event count unavailable'));
    User.countDocuments.mockResolvedValue(21);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 5 });
    PortfolioItem.countDocuments.mockResolvedValue(4);

    await expect(getDashboardKpis()).rejects.toThrow('event count unavailable');
  });

  // HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1
  test('RentalActiveContracts ne compte que les contrats locatifs actifs du scope tenant', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 1 } });
    Event.countDocuments.mockResolvedValue(0);
    User.countDocuments.mockResolvedValue(0);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 0 });
    PortfolioItem.countDocuments.mockResolvedValue(0);
    Property.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(['property-a']) });
    Contrat.countDocuments.mockResolvedValue(1);

    const result = await getDashboardKpis({ scopeUserIds: ['owner-a'] });

    expect(result.RentalActiveContracts).toBe(1);
    expect(Contrat.countDocuments).toHaveBeenCalledWith({ bien: { $in: ['property-a'] }, type: 'location', statut: 'actif' });
  });

  test('RentalActiveContracts vaut 0 sans scope tenant résolu (jamais un fallback global)', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 0 } });
    Event.countDocuments.mockResolvedValue(0);
    User.countDocuments.mockResolvedValue(0);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 0 });
    PortfolioItem.countDocuments.mockResolvedValue(0);

    const result = await getDashboardKpis({ scopeUserIds: [] });

    expect(result.RentalActiveContracts).toBe(0);
    expect(Property.find).not.toHaveBeenCalled();
    expect(Contrat.countDocuments).not.toHaveBeenCalled();
  });
});
