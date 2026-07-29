const mockChain = (value = []) => ({ distinct: jest.fn().mockResolvedValue(value), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) });
const mockModel = () => ({ aggregate: jest.fn().mockResolvedValue([]), countDocuments: jest.fn().mockResolvedValue(0), find: jest.fn(() => mockChain()) });

jest.mock('../models/Property', () => mockModel());
jest.mock('../models/Accommodation', () => mockModel());
jest.mock('../models/Hotel', () => mockModel());
jest.mock('../models/Transaction', () => mockModel());
jest.mock('../models/Visite', () => mockModel());
jest.mock('../models/RentalManagement', () => mockModel());
jest.mock('../models/Contrat', () => mockModel());
jest.mock('../models/Paiement', () => mockModel());
jest.mock('../models/RentalMaintenanceTicket', () => ({ ...mockModel(), OPEN_RENTAL_MAINTENANCE_STATUSES: ['ouvert'] }));
jest.mock('../models/HotelReservation', () => mockModel());
jest.mock('../models/Room', () => mockModel());
jest.mock('../models/HousekeepingTask', () => mockModel());
jest.mock('../models/MaintenanceTicket', () => ({ ...mockModel(), OPEN_MAINTENANCE_STATUSES: ['open'] }));
jest.mock('../models/AccommodationReservation', () => mockModel());
jest.mock('../models/AccommodationNightLock', () => mockModel());
jest.mock('../models/FinancialDocument', () => mockModel());
jest.mock('../models/PaymentAllocation', () => mockModel());
jest.mock('../models/FinancialPayment', () => mockModel());
jest.mock('../models/FinancialRefund', () => mockModel());

const controller = require('../controllers/dashboardAnalyticsController');

const execute = async (module) => {
  const req = { params: { module }, user: { role: 'Admin' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.getModuleAnalytics(req, res);
  return res.json.mock.calls[0][0];
};

describe('dashboardAnalyticsController', () => {
  test.each(['sales', 'rentals', 'accommodations', 'hotels'])('%s retourne des KPI numériques cohérents quand les collections sont vides', async (module) => {
    const body = await execute(module);
    expect(body.status).toBe('success');
    expect(Object.values(body.data.kpis).every((value) => typeof value === 'number' && value === 0)).toBe(true);
  });

  test('Accommodation documente la formule d’occupation et la nature des revenus', async () => {
    const body = await execute('accommodations');
    expect(body.data.occupancyFormula).toMatch(/Nuits verrouillées/);
    expect(body.data.revenueBasis).toMatch(/séparément/);
  });

  test('un module inconnu est refusé', async () => {
    const req = { params: { module: 'unknown' }, user: { role: 'Admin' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.getModuleAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('les permissions restent propres au domaine', async () => {
    const req = { params: { module: 'sales' }, user: { role: 'Secretaire' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.getModuleAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
