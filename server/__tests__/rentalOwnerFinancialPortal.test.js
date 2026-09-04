jest.mock('../models/RentalManagement');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/RentalPaymentReceipt');

const RentalManagement = require('../models/RentalManagement');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
const { getOwnerPaymentPage } = require('../services/rentalOwnerFinancialService');

const OWNER = '507f1f77bcf86cd799439011';
const OTHER_OWNER = '507f1f77bcf86cd799439012';
const PROPERTY = '607f1f77bcf86cd799439011';
const LEASE = '707f1f77bcf86cd799439011';

const query = (value) => ({ select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) });

describe('rental owner financial projection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('résout exclusivement les dossiers gérés du propriétaire authentifié', async () => {
    RentalManagement.find = jest.fn().mockReturnValue(query([{ _id: 'RM1', property: PROPERTY }]));
    Contrat.find = jest.fn().mockReturnValue(query([{ _id: LEASE, bien: PROPERTY, type: 'location', statut: 'actif' }]));
    Paiement.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
    Paiement.countDocuments = jest.fn().mockResolvedValue(0);
    Paiement.aggregate = jest.fn().mockResolvedValue([]);
    RentalPaymentReceipt.find = jest.fn().mockReturnValue(query([]));

    await getOwnerPaymentPage(OWNER, { page: 1, limit: 5, ownerId: OTHER_OWNER });

    expect(RentalManagement.find).toHaveBeenCalledWith(expect.objectContaining({ owner: OWNER, $or: expect.arrayContaining([{ managementActivated: true }]) }));
    expect(RentalManagement.find).not.toHaveBeenCalledWith(expect.objectContaining({ owner: OTHER_OWNER }));
  });

  test('summary global ne dépend pas de la page courante', async () => {
    RentalManagement.find = jest.fn().mockReturnValue(query([{ _id: 'RM1', property: PROPERTY }]));
    Contrat.find = jest.fn().mockReturnValue(query([{ _id: LEASE, bien: PROPERTY, type: 'location', statut: 'resilie' }]));
    const rows = Array.from({ length: 5 }, (_, index) => ({ _id: `P${index}`, contrat: LEASE, montantTotal: 100, montantRecu: 50, penaliteMontant: 0 }));
    Paiement.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(rows) });
    Paiement.countDocuments = jest.fn().mockResolvedValue(12);
    Paiement.aggregate = jest.fn().mockResolvedValue([{ du: 1200, recu: 600, penalites: 0, restant: 600 }]);
    RentalPaymentReceipt.find = jest.fn().mockReturnValue(query([]));

    const result = await getOwnerPaymentPage(OWNER, { page: 2, limit: 5 });
    expect(result.items).toHaveLength(5);
    expect(result.summary).toEqual({ du: 1200, recu: 600, penalites: 0, restant: 600 });
    expect(result.pagination.total).toBe(12);
  });
});
