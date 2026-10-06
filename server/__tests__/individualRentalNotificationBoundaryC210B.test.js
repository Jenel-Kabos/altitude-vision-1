jest.mock('../models/RentalManagement');
jest.mock('../models/Property');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../services/notificationService', () => ({ notifyStaff: jest.fn().mockResolvedValue() }));
jest.mock('../services/rentalListingSyncService', () => ({ serializeRentalManagement: jest.fn((value) => value) }));
jest.mock('../services/rentalFinancialAutomationService', () => ({ contractAlertWindowDays: () => 30 }));
jest.mock('../services/rentalAssetOnboardingService', () => ({}));
jest.mock('../services/rentalOwnerFinancialService', () => ({ getOwnerPaymentPage: jest.fn() }));

const RentalManagement = require('../models/RentalManagement');
const Property = require('../models/Property');
const { notifyStaff } = require('../services/notificationService');
const ctrl = require('../controllers/rentalManagementController');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const rental = (property) => {
  const actionRequests = [];
  actionRequests.create = (value) => ({ _id: 'REQUEST-1', status: 'pending', ...value });
  return { _id: '507f1f77bcf86cd799439011', property, occupancyStatus: 'vacant', actionRequests, workflowHistory: [], save: jest.fn().mockResolvedValue() };
};

beforeEach(() => jest.clearAllMocks());

test('une demande sur Property individuelle est refusée sans notifyStaff', async () => {
  RentalManagement.findOne.mockResolvedValue(rental('507f1f77bcf86cd799439012'));
  Property.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012', tenant: null }) });
  const res = response();
  await ctrl.ownerRequest({ params: { id: '507f1f77bcf86cd799439011', action: 'report-maintenance' }, user: { id: '507f1f77bcf86cd799439013' }, body: { reason: 'Fuite' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INDIVIDUAL_DIRECT_MANAGEMENT_REQUIRED' }));
  expect(notifyStaff).not.toHaveBeenCalled();
});

test('une demande sur Property organisationnelle conserve notifyStaff', async () => {
  RentalManagement.findOne.mockResolvedValue(rental('507f1f77bcf86cd799439012'));
  Property.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012', tenant: '507f1f77bcf86cd799439014' }) });
  const res = response();
  await ctrl.ownerRequest({ params: { id: '507f1f77bcf86cd799439011', action: 'report-maintenance' }, user: { id: '507f1f77bcf86cd799439013' }, body: { reason: 'Fuite' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(notifyStaff).toHaveBeenCalledTimes(1);
});
