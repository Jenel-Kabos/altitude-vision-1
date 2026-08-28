jest.mock('../models/Event', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/User', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/portfolioItemModel', () => ({ countDocuments: jest.fn() }));
jest.mock('../services/userKpiService', () => ({ getUserKpiSummary: jest.fn() }));
jest.mock('../services/propertyPortfolioService', () => ({ getPropertyPortfolioForTenantScope: jest.fn() }));

const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const userKpiService = require('../services/userKpiService');
const { getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');

describe('dashboardKpiQueryService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('utilise le total de la même projection tenant-scopée que « Tous les biens »', async () => {
    getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: 8 } });
    Event.countDocuments.mockResolvedValue(3);
    User.countDocuments.mockResolvedValue(21);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 5 });
    PortfolioItem.countDocuments.mockResolvedValue(4);

    await expect(getDashboardKpis({ scopeUserIds: ['staff-1'] })).resolves.toEqual({
      Altimmo: 8,
      MilaEvents: 3,
      Altcom: 4,
      Users: 21,
      Owners: 5,
    });
    expect(getPropertyPortfolioForTenantScope).toHaveBeenCalledWith({ scopeUserIds: ['staff-1'] });
    expect(Event.countDocuments).toHaveBeenCalledWith();
    expect(User.countDocuments).toHaveBeenCalledWith();
    expect(userKpiService.getUserKpiSummary).toHaveBeenCalledWith();
    expect(PortfolioItem.countDocuments).toHaveBeenCalledWith({ isPublished: true });
  });

  test('retourne cinq zéros lorsque les sources sont vides', async () => {
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
});
