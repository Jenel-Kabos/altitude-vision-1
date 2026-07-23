jest.mock('../models/HotelReservation');
jest.mock('../models/FinancialDocument');
jest.mock('../models/FinancialPayment');
jest.mock('../models/PaymentAllocation');
jest.mock('../services/finance/financialAuthorizationService');
jest.mock('../services/finance/financialReconciliationService');

const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const PaymentAllocation = require('../models/PaymentAllocation');
const authz = require('../services/finance/financialAuthorizationService');
const reconciliation = require('../services/finance/financialReconciliationService');
const { evaluateHotelCheckoutFinancialReadiness, BLOCKERS, WARNINGS } = require('../services/finance/hotelCheckoutFinancialReadinessService');

const RESERVATION_ID = '507f1f77bcf86cd799439011';
const HOTEL_ID = '507f1f77bcf86cd799439012';
const DOCUMENT_ID = '507f1f77bcf86cd799439013';
const chain = (value) => ({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) });
const reservation = { _id: RESERVATION_ID, hotel: HOTEL_ID, currency: 'XAF', status: 'checked_in' };
const document = { _id: DOCUMENT_ID, domain: 'hotel', establishmentId: HOTEL_ID, status: 'issued', currency: 'XAF', totalMinor: 10000, amountAllocatedMinor: 10000, balanceMinor: 0, paymentStatus: 'paid', metadata: { linesFinalized: true } };

describe('evaluation financiere du check-out (lecture seule)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HotelReservation.findById.mockReturnValue(chain(reservation));
    FinancialDocument.findOne.mockReturnValue(chain(document));
    PaymentAllocation.find.mockReturnValue(chain([{ _id: 'a', financialPayment: 'p', financialDocument: DOCUMENT_ID, establishmentId: HOTEL_ID, domain: 'hotel', currency: 'XAF', amountMinor: 10000, status: 'active' }]));
    FinancialPayment.find.mockImplementation((filter) => chain(filter?._id ? [{ _id: 'p', establishmentId: HOTEL_ID, domain: 'hotel', currency: 'XAF', status: 'succeeded', amountMinor: 10000 }] : []));
    authz.assertCanViewHotelCheckoutFinancials.mockResolvedValue({ _id: HOTEL_ID });
    reconciliation.scanFinancialConsistency.mockResolvedValue({ issues: [] });
  });

  test('retourne ready pour un document XAF emis, paye et coherent', async () => {
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: { id: 'actor' } });
    expect(result).toMatchObject({ allowed: true, status: 'ready', blockers: [], warnings: [] });
    expect(result.financialSnapshot).toMatchObject({ reservationId: RESERVATION_ID, establishmentId: HOTEL_ID, documentId: DOCUMENT_ID, balanceMinor: 0 });
  });

  test('bloque un document absent', async () => {
    FinancialDocument.findOne.mockReturnValue(chain(null));
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContainEqual({ code: BLOCKERS.DOCUMENT_MISSING });
    expect(PaymentAllocation.find).not.toHaveBeenCalled();
  });

  test.each([
    [{ status: 'draft' }, BLOCKERS.DOCUMENT_NOT_ISSUED],
    [{ balanceMinor: 1 }, BLOCKERS.BALANCE_REMAINING],
    [{ paymentStatus: 'unpaid' }, BLOCKERS.PAYMENT_NOT_SETTLED],
    [{ currency: 'EUR' }, BLOCKERS.CURRENCY_UNSUPPORTED],
    [{ metadata: { linesFinalized: false } }, BLOCKERS.LINES_NOT_FINALIZED],
  ])('classe le cas bloquant %s', async (change, expectedCode) => {
    FinancialDocument.findOne.mockReturnValue(chain({ ...document, ...change }));
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    expect(result.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: expectedCode })]));
    expect(result.status).toBe('blocked');
  });

  test('bloque les allocations inter-etablissements et paiements pending', async () => {
    PaymentAllocation.find.mockReturnValue(chain([{ _id: 'a', financialPayment: 'p', establishmentId: 'other', domain: 'hotel', currency: 'XAF' }]));
    FinancialPayment.find.mockReturnValueOnce(chain([{ _id: 'p', establishmentId: HOTEL_ID, domain: 'hotel', currency: 'XAF', status: 'pending' }])).mockReturnValueOnce(chain([]));
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    expect(result.blockers.map(({ code }) => code)).toEqual(expect.arrayContaining([BLOCKERS.ALLOCATION_INCONSISTENT, BLOCKERS.PAYMENT_NOT_SETTLED]));
  });

  test('bloque une anomalie critique et avertit pour une anomalie non critique', async () => {
    reconciliation.scanFinancialConsistency.mockResolvedValue({ issues: [{ code: 'CRIT', severity: 'critical' }, { code: 'WARN', severity: 'high' }] });
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: BLOCKERS.RECONCILIATION_CRITICAL }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: WARNINGS.RECONCILIATION_WARNING }));
  });

  test('un paiement confirme non alloue avertit sans bloquer', async () => {
    FinancialPayment.find.mockImplementation((filter) => chain(filter?._id ? [{ _id: 'p', establishmentId: HOTEL_ID, domain: 'hotel', currency: 'XAF', status: 'succeeded', amountMinor: 10000 }] : [{ _id: 'extra', availableAmountMinor: 1000 }]));
    const result = await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    expect(result).toMatchObject({ allowed: true, status: 'warning' });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: WARNINGS.UNALLOCATED_CONFIRMED_PAYMENT }));
  });

  test('derive la portee et refuse un establishment falsifie', async () => {
    await expect(evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {}, establishmentId: '507f1f77bcf86cd799439099' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    expect(authz.assertCanViewHotelCheckoutFinancials).toHaveBeenCalledWith({}, HOTEL_ID);
    expect(FinancialDocument.findOne).not.toHaveBeenCalled();
  });

  test('ne realise aucune mutation', async () => {
    await evaluateHotelCheckoutFinancialReadiness({ reservationId: RESERVATION_ID, actor: {} });
    for (const Model of [HotelReservation, FinancialDocument, FinancialPayment, PaymentAllocation]) {
      expect(Model.create).not.toHaveBeenCalled();
      expect(Model.updateOne).not.toHaveBeenCalled();
      expect(Model.findByIdAndUpdate).not.toHaveBeenCalled();
    }
  });
});
