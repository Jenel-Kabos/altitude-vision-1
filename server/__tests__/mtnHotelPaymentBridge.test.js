// PAY-4 — orchestrateur MTN/Financial Core : ownership, montant, idempotence,
// timeout, réconciliation, et surtout la preuve anti-P0 (un callback forgé
// ne confirme jamais rien sans une vraie corroboration MTN).
jest.mock('../models/HotelReservation');
jest.mock('../models/FinancialDocument');
jest.mock('../models/FinancialPayment');
jest.mock('../services/finance/financialPaymentService');
jest.mock('../services/payments/providers/mtn/mtnMoMoProvider');
jest.mock('../services/payments/providers/mtn/mtnMoMoClient', () => ({ generateReferenceId: jest.fn(() => 'generated-ref') }));

const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const FinancialPayment = require('../models/FinancialPayment');
const { createHotelPayment, confirmHotelPayment, failHotelPayment } = require('../services/finance/financialPaymentService');
const mtnMoMoProvider = require('../services/payments/providers/mtn/mtnMoMoProvider');
const {
  initiateMtnHotelPayment, reconcileMtnHotelPayment,
} = require('../services/finance/mtnHotelPaymentBridge');

const HOTEL_ID = 'hotel-1';
const RESERVATION_ID = 'res-1';
const DOCUMENT_ID = 'doc-1';
const OWNER_ID = 'client-owner';
const OTHER_CLIENT_ID = 'client-other';

function reservationFixture(overrides = {}) {
  return { _id: RESERVATION_ID, hotel: HOTEL_ID, guestUser: OWNER_ID, guest: { firstName: 'A', lastName: 'B' }, ...overrides };
}
function documentFixture(overrides = {}) {
  return { _id: DOCUMENT_ID, domain: 'hotel', status: 'issued', currency: 'XAF', balanceMinor: 100000, documentNumber: 'FAC-1', subjectId: RESERVATION_ID, ...overrides };
}
function paymentFixture(overrides = {}) {
  return { _id: 'pay-1', provider: 'mtn_direct', providerPaymentId: 'ref-1', status: 'pending', amountMinor: 40000, currency: 'XAF', establishmentId: HOTEL_ID, metadata: {}, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  HotelReservation.findById.mockResolvedValue(reservationFixture());
  FinancialDocument.findOne.mockResolvedValue(documentFixture());
});

describe('mtnHotelPaymentBridge — ownership (PAY-4 §36/§37, IDOR)', () => {
  test('un client qui n’est pas le titulaire de la réservation est refusé, même staffAuthorized=false', async () => {
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: OTHER_CLIENT_ID }, businessOperationKey: 'key-1',
    })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    expect(createHotelPayment).not.toHaveBeenCalled();
  });

  test('le titulaire de la réservation est autorisé', async () => {
    mtnMoMoProvider.normalizeMsisdn.mockReturnValue('242060000000');
    createHotelPayment.mockResolvedValue({ payment: paymentFixture(), created: true });
    mtnMoMoProvider.initiatePayment.mockResolvedValue({ providerPaymentId: 'ref-1', normalizedStatus: 'pending' });

    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-2',
    })).resolves.toMatchObject({ nextAction: 'CONFIRM_ON_PHONE' });
  });

  test('un staff autorisé (staffAuthorized=true) peut initier au nom du client, même sans être le titulaire', async () => {
    mtnMoMoProvider.normalizeMsisdn.mockReturnValue('242060000000');
    createHotelPayment.mockResolvedValue({ payment: paymentFixture(), created: true });
    mtnMoMoProvider.initiatePayment.mockResolvedValue({ providerPaymentId: 'ref-1', normalizedStatus: 'pending' });

    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: 'staff-1' }, businessOperationKey: 'key-3', staffAuthorized: true,
    })).resolves.toMatchObject({ nextAction: 'CONFIRM_ON_PHONE' });
  });
});

describe('mtnHotelPaymentBridge — amount tampering (PAY-4 §16/§33/§34)', () => {
  test('un montant supérieur au solde de la facture est refusé — jamais transmis à MTN', async () => {
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 999999, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-4',
    })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_OVERPAYMENT' });
    expect(mtnMoMoProvider.initiatePayment).not.toHaveBeenCalled();
  });

  test('un montant partiel valide (paiement partiel) est accepté (PAY-4 §33)', async () => {
    mtnMoMoProvider.normalizeMsisdn.mockReturnValue('242060000000');
    createHotelPayment.mockResolvedValue({ payment: paymentFixture({ amountMinor: 40000 }), created: true });
    mtnMoMoProvider.initiatePayment.mockResolvedValue({ providerPaymentId: 'ref-1', normalizedStatus: 'pending' });
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-5',
    })).resolves.toBeDefined();
    expect(createHotelPayment).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountMinor: 40000 }) }));
  });

  test('un montant nul ou négatif est refusé', async () => {
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 0, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-6',
    })).rejects.toMatchObject({ code: 'FINANCIAL_INVALID_AMOUNT' });
  });
});

describe('mtnHotelPaymentBridge — idempotence initiation (PAY-4 §18/§28)', () => {
  test('un rejeu de la même intention (même businessOperationKey) ne rappelle jamais RequestToPay', async () => {
    mtnMoMoProvider.normalizeMsisdn.mockReturnValue('242060000000');
    createHotelPayment.mockResolvedValue({ payment: paymentFixture(), created: false }); // déjà existant

    const result = await initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'same-key',
    });

    expect(mtnMoMoProvider.initiatePayment).not.toHaveBeenCalled();
    expect(result.nextAction).toBe('CONFIRM_ON_PHONE');
  });

  test('un timeout réseau après création du paiement laisse le paiement pending, sans nouvelle tentative automatique (PAY-4 §28)', async () => {
    mtnMoMoProvider.normalizeMsisdn.mockReturnValue('242060000000');
    createHotelPayment.mockResolvedValue({ payment: paymentFixture(), created: true });
    mtnMoMoProvider.initiatePayment.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'MTN_MOMO_TIMEOUT' }));

    const result = await initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 40000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-timeout',
    });

    expect(result.nextAction).toBe('CHECK_STATUS');
    expect(mtnMoMoProvider.initiatePayment).toHaveBeenCalledTimes(1); // jamais retenté ici
  });
});

describe('mtnHotelPaymentBridge — réconciliation (PAY-4 §22/§24/§25) — cœur anti-P0', () => {
  test('statut distant PENDING → aucune transition, jamais de confirmation prématurée', async () => {
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ status: 'pending' }));
    mtnMoMoProvider.getStatus.mockResolvedValue({ status: 'PENDING', normalizedStatus: 'pending' });

    const result = await reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: 'staff-1' }, businessOperationKey: 'recon-1' });

    expect(result.transition).toBe('none');
    expect(confirmHotelPayment).not.toHaveBeenCalled();
    expect(failHotelPayment).not.toHaveBeenCalled();
  });

  test('statut distant SUCCESSFUL → confirmHotelPayment (fonction canonique) appelée, jamais réimplémentée ici', async () => {
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ status: 'pending' }));
    mtnMoMoProvider.getStatus.mockResolvedValue({ status: 'SUCCESSFUL', normalizedStatus: 'succeeded' });
    confirmHotelPayment.mockResolvedValue({ payment: paymentFixture({ status: 'succeeded' }), confirmed: true });

    const result = await reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: 'staff-1' }, businessOperationKey: 'recon-2' });

    expect(confirmHotelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'pay-1' }));
    expect(result.transition).toBe('confirmed');
  });

  test('statut distant FAILED → failHotelPayment appelée, motif transmis', async () => {
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ status: 'pending' }));
    mtnMoMoProvider.getStatus.mockResolvedValue({ status: 'FAILED', reason: 'NOT_ENOUGH_FUNDS', normalizedStatus: 'failed' });
    failHotelPayment.mockResolvedValue({ payment: paymentFixture({ status: 'failed' }), failed: true });

    const result = await reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: 'staff-1' }, businessOperationKey: 'recon-3' });

    expect(failHotelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'pay-1', reason: 'NOT_ENOUGH_FUNDS' }));
    expect(result.transition).toBe('failed');
  });

  test('paiement déjà succeeded → aucune nouvelle interrogation MTN, jamais de régression (PAY-4 §24)', async () => {
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ status: 'succeeded' }));
    const result = await reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: 'staff-1' }, businessOperationKey: 'recon-4' });
    expect(mtnMoMoProvider.getStatus).not.toHaveBeenCalled();
    expect(result.transition).toBe('none');
  });

  test('ANTI-P0 : un "callback" dont le corps prétend SUCCESSFUL ne confirme PAS le paiement si la corroboration MTN réelle renvoie PENDING', async () => {
    // Ceci simule exactement l'attaque CinetPay (PAY-1 §9) transposée à MTN :
    // le corps de la requête ment, mais reconcileMtnHotelPayment n'utilise
    // JAMAIS ce corps — seulement mtnMoMoProvider.getStatus (la vraie source).
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ status: 'pending' }));
    mtnMoMoProvider.getStatus.mockResolvedValue({ status: 'PENDING', normalizedStatus: 'pending' }); // la VRAIE réponse MTN, malgré un corps de callback forgé ailleurs

    const result = await reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: null }, businessOperationKey: 'anti-p0' });

    expect(confirmHotelPayment).not.toHaveBeenCalled();
    expect(result.transition).toBe('none');
  });

  test('provider différent de mtn_direct est refusé — pas de réconciliation croisée entre providers', async () => {
    FinancialPayment.findById.mockResolvedValue(paymentFixture({ provider: 'manual' }));
    await expect(reconcileMtnHotelPayment({ paymentId: 'pay-1', actor: { id: 'staff-1' }, businessOperationKey: 'recon-5' }))
      .rejects.toMatchObject({ code: 'FINANCIAL_PROVIDER_UNKNOWN' });
  });
});

describe('mtnHotelPaymentBridge — préconditions facture (PAY-4 §36)', () => {
  test('facture non émise → refus, jamais de paiement initié', async () => {
    FinancialDocument.findOne.mockResolvedValue(documentFixture({ status: 'draft' }));
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 10000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-draft',
    })).rejects.toMatchObject({ code: 'FINANCIAL_DOCUMENT_NOT_ISSUED' });
  });

  test('devise non XAF → refus explicite', async () => {
    FinancialDocument.findOne.mockResolvedValue(documentFixture({ currency: 'EUR' }));
    await expect(initiateMtnHotelPayment({
      reservationId: RESERVATION_ID, documentId: DOCUMENT_ID, amountMinor: 10000, msisdn: '242060000000',
      actor: { id: OWNER_ID }, businessOperationKey: 'key-eur',
    })).rejects.toMatchObject({ code: 'FINANCIAL_CURRENCY_UNSUPPORTED' });
  });
});
