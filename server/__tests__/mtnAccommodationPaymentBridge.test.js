jest.mock('../models/AccommodationReservation');
jest.mock('../models/AccommodationNightLock');
jest.mock('../models/FinancialPayment');
jest.mock('../services/finance/accommodationBillingService');
jest.mock('../services/payments/providers/mtn/mtnMoMoProvider');
jest.mock('../services/payments/providers/mtn/mtnMoMoClient');
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/finance/financialLedgerService', () => ({ appendFinancialLedgerEntry: jest.fn().mockResolvedValue({}) }));
jest.mock('../services/finance/financialTransactionService', () => ({ runFinancialOperation: jest.fn((_options, operation) => operation({ session: null, transactional: false })) }));
jest.mock('../services/finance/accommodationRefundService', () => ({ ensureLatePaymentRefund: jest.fn().mockResolvedValue({ _id: 'refund-1' }) }));

const Reservation = require('../models/AccommodationReservation');
const NightLock = require('../models/AccommodationNightLock');
const FinancialPayment = require('../models/FinancialPayment');
const billing = require('../services/finance/accommodationBillingService');
const provider = require('../services/payments/providers/mtn/mtnMoMoProvider');
const client = require('../services/payments/providers/mtn/mtnMoMoClient');
const bridge = require('../services/finance/mtnAccommodationPaymentBridge');
const refunds = require('../services/finance/accommodationRefundService');

const reservation = (overrides = {}) => ({
  _id: 'reservation-1', accommodation: 'accommodation-1', guest: 'user-1',
  status: 'pending_payment', paymentExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  nights: 2, total: 100000, remainingAmount: 100000, amountPaid: 0, currency: 'XAF',
  pricingSnapshot: { nightlyRate: 50000, total: 100000, requiredToConfirm: 50000 }, ...overrides,
});

describe('mtnAccommodationPaymentBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Reservation.findById.mockResolvedValue(reservation());
    NightLock.countDocuments.mockResolvedValue(2);
    billing.ensureAccommodationInvoice.mockResolvedValue({ _id: 'document-1', status: 'issued', currency: 'XAF', balanceMinor: 100000 });
    client.generateReferenceId.mockReturnValue('provider-ref-1');
    provider.normalizeMsisdn.mockReturnValue('242060000000');
    provider.initiatePayment.mockResolvedValue({ providerStatus: 'PENDING', normalizedStatus: 'pending' });
    billing.createAccommodationPayment.mockResolvedValue({ payment: { _id: 'payment-1', status: 'pending', providerPaymentId: 'provider-ref-1' }, created: true });
  });

  test('le montant est la garantie serveur, jamais un montant client', async () => {
    await bridge.initiateMtnAccommodationPayment({ reservationId: 'reservation-1', msisdn: '060000000', actor: { id: 'user-1' }, businessOperationKey: 'pay-1' });
    expect(billing.createAccommodationPayment).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: 'reservation-1', amountMinor: 50000, provider: 'mtn_direct', providerPaymentId: 'provider-ref-1',
    }));
    expect(provider.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 50000 }));
  });

  test('un client étranger et une réservation expirée sont refusés avant tout appel provider', async () => {
    await expect(bridge.initiateMtnAccommodationPayment({ reservationId: 'reservation-1', msisdn: '060000000', actor: { id: 'other' }, businessOperationKey: 'pay-2' }))
      .rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    Reservation.findById.mockResolvedValue(reservation({ paymentExpiresAt: new Date(Date.now() - 1) }));
    await expect(bridge.initiateMtnAccommodationPayment({ reservationId: 'reservation-1', msisdn: '060000000', actor: { id: 'user-1' }, businessOperationKey: 'pay-3' }))
      .rejects.toMatchObject({ code: 'PAYMENT_HOLD_EXPIRED' });
    expect(provider.initiatePayment).not.toHaveBeenCalled();
  });

  test('STAY-04/06/15: le serveur calcule le solde complet ou la prochaine nuit sans montant client', async () => {
    Reservation.findById.mockResolvedValue(reservation({ status: 'confirmed', amountPaid: 50000, remainingAmount: 50000 }));
    await bridge.initiateMtnAccommodationPayment({ reservationId: 'reservation-1', msisdn: '060000000', actor: { id: 'user-1' }, businessOperationKey: 'balance-1', paymentPurpose: 'remaining_balance', amountMinor: 1 });
    expect(billing.createAccommodationPayment).toHaveBeenLastCalledWith(expect.objectContaining({ amountMinor: 50000, paymentPurpose: 'remaining_balance' }));
    jest.clearAllMocks(); Reservation.findById.mockResolvedValue(reservation({ status: 'confirmed', nights: 5, total: 250000, amountPaid: 50000, pricingSnapshot: { nightlyRate: 50000, total: 250000, requiredToConfirm: 50000 } })); NightLock.countDocuments.mockResolvedValue(5); billing.ensureAccommodationInvoice.mockResolvedValue({ balanceMinor: 200000 }); client.generateReferenceId.mockReturnValue('provider-ref-2'); provider.normalizeMsisdn.mockReturnValue('242060000000'); billing.createAccommodationPayment.mockResolvedValue({ payment: { _id: 'payment-2', status: 'pending' }, created: true });
    await bridge.initiateMtnAccommodationPayment({ reservationId: 'reservation-1', msisdn: '060000000', actor: { id: 'user-1' }, businessOperationKey: 'night-2', paymentPurpose: 'next_night' });
    expect(billing.createAccommodationPayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 50000, paymentPurpose: 'next_night' }));
  });

  test('la réconciliation confirme uniquement après statut MTN interrogé', async () => {
    FinancialPayment.findById.mockResolvedValue({ _id: 'payment-1', provider: 'mtn_direct', status: 'pending', subjectType: 'AccommodationReservation', subjectId: 'reservation-1', providerPaymentId: 'provider-ref-1' });
    provider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
    billing.confirmAndAllocateAccommodationPayment.mockResolvedValue({ payment: { status: 'succeeded' }, reservation: { status: 'confirmed' } });
    Reservation.findOneAndUpdate.mockResolvedValue(null);
    const result = await bridge.reconcileMtnAccommodationPayment({ paymentId: 'payment-1', actor: { id: null }, businessOperationKey: 'callback-1' });
    expect(provider.getStatus).toHaveBeenCalledWith({ providerPaymentId: 'provider-ref-1' });
    expect(billing.confirmAndAllocateAccommodationPayment).toHaveBeenCalled();
    expect(result.transition).toBe('confirmed');
  });

  test('un paiement tardif ne confirme pas et est marqué refund_required', async () => {
    FinancialPayment.findById.mockResolvedValue({ _id: 'payment-1', provider: 'mtn_direct', status: 'pending', subjectType: 'AccommodationReservation', subjectId: 'reservation-1', providerPaymentId: 'provider-ref-1' });
    Reservation.findById.mockResolvedValue(reservation({ status: 'expired', paymentExpiresAt: new Date(Date.now() - 1000) }));
    provider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
    FinancialPayment.findOneAndUpdate.mockResolvedValue({ _id: 'payment-1', status: 'succeeded', providerRefundStatus: 'refund_required' });
    const result = await bridge.reconcileMtnAccommodationPayment({ paymentId: 'payment-1', actor: { id: null }, businessOperationKey: 'callback-late' });
    expect(billing.confirmAndAllocateAccommodationPayment).not.toHaveBeenCalled();
    expect(FinancialPayment.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ _id: 'payment-1', status: 'pending' }), expect.objectContaining({ $set: expect.objectContaining({ providerRefundStatus: 'refund_required' }) }), expect.any(Object));
    expect(refunds.ensureLatePaymentRefund).toHaveBeenCalledWith(expect.objectContaining({ reservationId: 'reservation-1', paymentId: 'payment-1' }));
    expect(result.transition).toBe('late_payment_refund_required');
  });
});
