const express = require('express');
const request = require('supertest');

jest.mock('../models/Event', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/User', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/portfolioItemModel', () => ({ countDocuments: jest.fn() }));
jest.mock('../models/Property', () => ({ find: jest.fn() }));
jest.mock('../models/Contrat', () => ({ countDocuments: jest.fn() }));
jest.mock('../services/userKpiService', () => ({ getUserKpiSummary: jest.fn() }));
jest.mock('../services/propertyPortfolioService', () => ({ getPropertyPortfolioForTenantScope: jest.fn() }));
jest.mock('../controllers/authController', () => ({
  protect: (req, res, next) => next(),
  restrictTo: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../middleware/tenantContext', () => ({
  requireTenantScope: (req, res, next) => { req.tenantScopeUserIds = ['staff-1']; next(); },
}));

const Event = require('../models/Event');
const User = require('../models/User');
const PortfolioItem = require('../models/portfolioItemModel');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const userKpiService = require('../services/userKpiService');
const { getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');
const authController = require('../controllers/authController');
const { STAFF_ALL } = require('../utils/roles');
const dashboardRoutes = require('../routes/dashboardRoutes');
const restrictToWasConfiguredForAllStaff = authController.restrictTo.mock.calls.some(
  (roles) => JSON.stringify(roles) === JSON.stringify(STAFF_ALL),
);

const app = express();
app.use('/api/dashboard', dashboardRoutes);

function mockDashboardReads({ properties, events, users, owners, portfolio, rentalActiveContracts = 0 }) {
  getPropertyPortfolioForTenantScope.mockResolvedValue({ stats: { total: properties } });
  Event.countDocuments.mockResolvedValue(events);
  User.countDocuments.mockResolvedValue(users);
  userKpiService.getUserKpiSummary.mockResolvedValue({ proprietaires: owners });
  PortfolioItem.countDocuments.mockResolvedValue(portfolio);
  Property.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(rentalActiveContracts > 0 ? ['property-1'] : []) });
  Contrat.countDocuments.mockResolvedValue(rentalActiveContracts);
}

describe('GET /api/dashboard/stats — contrat de caractérisation ARCH-2F', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('conserve les gardes staff définies sur le routeur', () => {
    expect(restrictToWasConfiguredForAllStaff).toBe(true);
  });

  test('retourne le contrat exact avec une base vide et les filtres historiques', async () => {
    mockDashboardReads({ properties: 0, events: 0, users: 0, owners: 0, portfolio: 0 });

    const response = await request(app).get('/api/dashboard/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      data: {
        stats: {
          Altimmo: 0,
          MilaEvents: 0,
          Altcom: 0,
          Users: 0,
          Owners: 0,
          RentalActiveContracts: 0,
        },
      },
    });
    expect(getPropertyPortfolioForTenantScope).toHaveBeenCalledWith({ scopeUserIds: ['staff-1'] });
    expect(Event.countDocuments).toHaveBeenCalledWith();
    expect(User.countDocuments).toHaveBeenCalledWith();
    expect(userKpiService.getUserKpiSummary).toHaveBeenCalledWith();
    expect(PortfolioItem.countDocuments).toHaveBeenCalledWith({ isPublished: true });
  });

  test('préserve les six clés, leurs valeurs et leur ordre avec des données partielles', async () => {
    mockDashboardReads({ properties: 7, events: 2, users: 19, owners: 4, portfolio: 3, rentalActiveContracts: 5 });

    const response = await request(app).get('/api/dashboard/stats');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data.stats)).toEqual([
      'Altimmo',
      'MilaEvents',
      'Altcom',
      'Users',
      'Owners',
      'RentalActiveContracts',
    ]);
    expect(response.body.data.stats).toEqual({
      Altimmo: 7,
      MilaEvents: 2,
      Altcom: 3,
      Users: 19,
      Owners: 4,
      RentalActiveContracts: 5,
    });
  });

  test('préserve la réponse 500 historique lorsqu’une lecture échoue', async () => {
    mockDashboardReads({ properties: 7, events: 2, users: 19, owners: 4, portfolio: 3 });
    Event.countDocuments.mockRejectedValue(new Error('event count unavailable'));

    const response = await request(app).get('/api/dashboard/stats');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Erreur serveur lors du chargement des statistiques.',
      error: 'event count unavailable',
    });
  });

  // HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — la vraie surface live
  // (GET /api/dashboard/stats) fournit désormais le KPI attendu par le
  // widget "Contrats actifs" du dashboard Admin, avec la portée tenant déjà
  // résolue par `requireTenantScope` (jamais un second mécanisme).
  test('expose RentalActiveContracts avec la portée tenant déjà résolue par requireTenantScope', async () => {
    mockDashboardReads({ properties: 3, events: 0, users: 0, owners: 0, portfolio: 0, rentalActiveContracts: 3 });

    const response = await request(app).get('/api/dashboard/stats');

    expect(response.status).toBe(200);
    expect(response.body.data.stats.RentalActiveContracts).toBe(3);
    expect(Property.find).toHaveBeenCalledWith({ owner: { $in: ['staff-1'] } });
  });
});
