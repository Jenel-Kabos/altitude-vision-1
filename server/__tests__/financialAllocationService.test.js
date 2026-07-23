jest.mock('../models/FinancialPayment');
jest.mock('../models/FinancialDocument');
jest.mock('../models/PaymentAllocation');
jest.mock('../services/finance/financialLedgerService', () => ({ appendFinancialLedgerEntry: jest.fn().mockResolvedValue({}) }));

const FinancialPayment = require('../models/FinancialPayment');
const FinancialDocument = require('../models/FinancialDocument');
const PaymentAllocation = require('../models/PaymentAllocation');
const ledger = require('../services/finance/financialLedgerService');
const { hashPayload } = require('../services/finance/financialIdempotencyService');
const { allocatePaymentToDocument, reversePaymentAllocation, derivePaymentStatus } = require('../services/finance/paymentAllocationService');

const actor = { id: '507f1f77bcf86cd799439015' };
const payment = (overrides = {}) => ({ _id: '507f1f77bcf86cd799439011', domain: 'hotel', establishmentType: 'Hotel', establishmentId: '507f1f77bcf86cd799439012', status: 'succeeded', currency: 'XAF', amountMinor: 100000, availableAmountMinor: 100000, allocatedAmountMinor: 0, ...overrides });
const document = (overrides = {}) => ({ _id: '507f1f77bcf86cd799439013', domain: 'hotel', establishmentType: 'Hotel', establishmentId: '507f1f77bcf86cd799439012', status: 'issued', currency: 'XAF', totalMinor: 100000, balanceMinor: 100000, amountAllocatedMinor: 0, paymentStatus: 'unpaid', save: jest.fn().mockResolvedValue(), ...overrides });
const input = { paymentId: '507f1f77bcf86cd799439011', documentId: '507f1f77bcf86cd799439013', amountMinor: 30000, businessOperationKey: 'alloc-1', actor };

describe('Financial Core — allocations', () => {
  beforeEach(() => { jest.clearAllMocks(); PaymentAllocation.findOne.mockResolvedValue(null); FinancialPayment.updateOne.mockResolvedValue({}); FinancialDocument.updateOne.mockResolvedValue({}); });
  test.each([[0, 'unpaid'], [1, 'partially_paid'], [100, 'paid'], [101, 'overpaid']])('dérive le statut %p → %s', (allocated, status) => expect(derivePaymentStatus(100, allocated)).toBe(status));
  test('alloue partiellement et journalise', async () => {
    const p = payment(); const d = document({ balanceMinor: 70000, amountAllocatedMinor: 30000 });
    FinancialPayment.findById.mockResolvedValue(p); FinancialDocument.findById.mockResolvedValue(document());
    FinancialPayment.findOneAndUpdate.mockResolvedValue({ ...p, availableAmountMinor: 70000, allocatedAmountMinor: 30000 }); FinancialDocument.findOneAndUpdate.mockResolvedValue(d);
    PaymentAllocation.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439014', ...input, domain: 'hotel', establishmentType: 'Hotel', establishmentId: p.establishmentId, currency: 'XAF' });
    await expect(allocatePaymentToDocument(input)).resolves.toMatchObject({ amountMinor: 30000 });
    expect(d.paymentStatus).toBe('partially_paid'); expect(ledger.appendFinancialLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'payment.allocated' }));
  });
  test('retourne une allocation idempotente sans réserver de montant', async () => {
    const payloadHash = hashPayload({ paymentId: input.paymentId, documentId: input.documentId, amountMinor: input.amountMinor });
    PaymentAllocation.findOne.mockResolvedValue({ _id: 'existing', metadata: { payloadHash } });
    await expect(allocatePaymentToDocument(input)).resolves.toEqual({ _id: 'existing', metadata: { payloadHash } });
    expect(FinancialPayment.findOneAndUpdate).not.toHaveBeenCalled();
  });
  test.each([
    [payment({ status: 'pending' }), document(), 'FINANCIAL_PAYMENT_NOT_ALLOCATABLE'],
    [payment({ currency: 'EUR' }), document(), 'FINANCIAL_CURRENCY_MISMATCH'],
    [payment({ establishmentId: '507f1f77bcf86cd799439099' }), document(), 'FINANCIAL_ESTABLISHMENT_MISMATCH'],
    [payment(), document({ status: 'draft' }), 'FINANCIAL_DOCUMENT_NOT_ISSUED'],
    [payment({ availableAmountMinor: 10 }), document(), 'FINANCIAL_PAYMENT_OVERALLOCATION'],
  ])('rejette les invariants paiement/facture', async (p, d, code) => {
    FinancialPayment.findById.mockResolvedValue(p); FinancialDocument.findById.mockResolvedValue(d);
    await expect(allocatePaymentToDocument(input)).rejects.toMatchObject({ code });
  });
  test('une course sur le paiement est rejetée atomiquement', async () => {
    FinancialPayment.findById.mockResolvedValue(payment()); FinancialDocument.findById.mockResolvedValue(document()); FinancialPayment.findOneAndUpdate.mockResolvedValue(null);
    await expect(allocatePaymentToDocument(input)).rejects.toMatchObject({ code: 'FINANCIAL_PAYMENT_OVERALLOCATION' });
  });
  test('une course sur la facture compense la réservation du paiement', async () => {
    FinancialPayment.findById.mockResolvedValue(payment()); FinancialDocument.findById.mockResolvedValue(document()); FinancialPayment.findOneAndUpdate.mockResolvedValue(payment({ availableAmountMinor: 70000 })); FinancialDocument.findOneAndUpdate.mockResolvedValue(null);
    await expect(allocatePaymentToDocument(input)).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_OVERPAYMENT' });
    expect(FinancialPayment.updateOne).toHaveBeenCalledWith({ _id: input.paymentId }, { $inc: { availableAmountMinor: 30000, allocatedAmountMinor: -30000 } });
  });
});

describe('Financial Core — renversement', () => {
  beforeEach(() => jest.clearAllMocks());
  test('renverse sans supprimer et crée une contre-écriture', async () => {
    const allocation = { _id: '507f1f77bcf86cd799439014', financialPayment: input.paymentId, financialDocument: input.documentId, domain: 'hotel', establishmentType: 'Hotel', establishmentId: '507f1f77bcf86cd799439012', currency: 'XAF', amountMinor: 30000, status: 'reversed', metadata: {}, save: jest.fn().mockResolvedValue() };
    PaymentAllocation.findOneAndUpdate.mockResolvedValue(allocation); FinancialPayment.findByIdAndUpdate.mockResolvedValue(payment()); FinancialDocument.findByIdAndUpdate.mockResolvedValue(document({ amountAllocatedMinor: 0 }));
    await expect(reversePaymentAllocation({ allocationId: allocation._id, reason: 'Erreur de saisie', businessOperationKey: 'reverse-1', actor })).resolves.toMatchObject({ allocation });
    expect(PaymentAllocation.deleteOne).not.toHaveBeenCalled(); expect(ledger.appendFinancialLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'payment.allocation_reversed', amountMinor: -30000 }));
  });
  test('rejette un double renversement non idempotent', async () => {
    PaymentAllocation.findOneAndUpdate.mockResolvedValue(null); PaymentAllocation.findById.mockResolvedValue({ status: 'reversed', metadata: { reversalOperationKey: 'other' } });
    await expect(reversePaymentAllocation({ allocationId: 'a', reason: 'x', businessOperationKey: 'reverse-2', actor })).rejects.toMatchObject({ code: 'FINANCIAL_ALLOCATION_ALREADY_REVERSED' });
  });
});
