jest.mock('../models/Transaction');
jest.mock('../models/Property');
jest.mock('../models/User');
jest.mock('../models/Document');
jest.mock('../models/RealEstateReservation');
jest.mock('../services/notificationService', () => ({ notify: jest.fn(), notifyStaff: jest.fn() }));
jest.mock('../services/actionLogService', () => ({ logAction: jest.fn(), buildAuteur: jest.fn() }));
jest.mock('../services/finance/realEstateTransactionFinalizationService', () => ({ finalizeRealEstateTransaction: jest.fn() }));

const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Document = require('../models/Document');
const RealEstateReservation = require('../models/RealEstateReservation');
const controller = require('../controllers/transactionController');
const { finalizeRealEstateTransaction } = require('../services/finance/realEstateTransactionFinalizationService');

const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};

describe('transactionController — garde de finalisation', () => {
  afterEach(() => jest.clearAllMocks());

  test('refuse de finaliser tant que le paiement n’est pas confirmé', async () => {
    const tx = { _id: '507f1f77bcf86cd799439011', status: 'Paiement en attente', paymentStatus: 'en_attente' };
    finalizeRealEstateTransaction.mockRejectedValue(Object.assign(new Error('Le paiement doit être confirmé avant la finalisation.'), { code: 'PAYMENT_NOT_CONFIRMED', statusCode: 409 }));
    const res = response();

    await controller.finalizeTransaction({ params: { id: tx._id }, body: {}, user: { id: '507f1f77bcf86cd799439012' } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'PAYMENT_NOT_CONFIRMED' });
    expect(Property.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Document.create).not.toHaveBeenCalled();
  });
});

describe('transactionController — ouverture sécurisée du dossier immobilier', () => {
  const propertyId = '507f1f77bcf86cd799439021';
  const clientId = '507f1f77bcf86cd799439022';
  const ownerId = '507f1f77bcf86cd799439023';
  const selected = (value) => ({ select: jest.fn().mockResolvedValue(value) });

  afterEach(() => jest.clearAllMocks());

  test('refuse une transaction dont le type ne correspond pas au bien', async () => {
    Property.findById.mockReturnValue(selected({ _id: propertyId, status: 'location', statusAdmin: 'Validée', availability: 'Disponible', owner: ownerId }));
    User.findById.mockReturnValue(selected({ _id: clientId }));
    const res = response();

    await controller.createTransaction({ body: { propertyId, clientId, reservationId: '507f1f77bcf86cd799439024', finalAmount: 100000, transactionType: 'vente' }, user: { id: ownerId } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('TRANSACTION_TYPE_MISMATCH');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('convertit le verrou Mongo concurrent en conflit métier stable', async () => {
    const reservationId = '507f1f77bcf86cd799439024';
    Property.findById.mockReturnValue(selected({ _id: propertyId, status: 'vente', statusAdmin: 'Validée', availability: 'Réservé', owner: ownerId, reservationLock: { reservation: reservationId } }));
    User.findById.mockReturnValue(selected({ _id: clientId }));
    RealEstateReservation.findById.mockResolvedValue({ _id: reservationId, property: propertyId, client: clientId, type: 'sale', status: 'active', expiresAt: new Date(Date.now() + 60000) });
    Transaction.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 11000 }));
    const res = response();

    await controller.createTransaction({ body: { propertyId, clientId, reservationId, finalAmount: 100000, transactionType: 'vente' }, user: { id: ownerId } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('PROPERTY_TRANSACTION_ALREADY_OPEN');
  });
});
