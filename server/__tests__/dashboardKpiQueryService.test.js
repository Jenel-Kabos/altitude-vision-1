jest.mock('../models/Property', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/Event', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/User', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/portfolioItemModel', () => ({ countDocuments: jest.fn() }));
jest.mock('../services/userKpiService', () => ({ getUserKpiSummary: jest.fn() }));

const Property = require('../models/Property');
const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const userKpiService = require('../services/userKpiService');
const { getDashboardKpis } = require('../services/dashboardKpiQueryService');

describe('dashboardKpiQueryService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('agrège les lectures historiques sans modifier leur portée', async () => {
    Property.countDocuments.mockResolvedValue(8);
    Event.countDocuments.mockResolvedValue(3);
    User.countDocuments.mockResolvedValue(21);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 5 });
    PortfolioItem.countDocuments.mockResolvedValue(4);

    await expect(getDashboardKpis()).resolves.toEqual({
      Altimmo: 8,
      MilaEvents: 3,
      Altcom: 4,
      Users: 21,
      Owners: 5,
    });
    expect(Property.countDocuments).toHaveBeenCalledWith();
    expect(Event.countDocuments).toHaveBeenCalledWith();
    expect(User.countDocuments).toHaveBeenCalledWith();
    expect(userKpiService.getUserKpiSummary).toHaveBeenCalledWith();
    expect(PortfolioItem.countDocuments).toHaveBeenCalledWith({ isPublished: true });
  });

  test('retourne cinq zéros lorsque les sources sont vides', async () => {
    Property.countDocuments.mockResolvedValue(0);
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
    Property.countDocuments.mockResolvedValue(8);
    Event.countDocuments.mockRejectedValue(new Error('event count unavailable'));
    User.countDocuments.mockResolvedValue(21);
    userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: 5 });
    PortfolioItem.countDocuments.mockResolvedValue(4);

    await expect(getDashboardKpis()).rejects.toThrow('event count unavailable');
  });
});
