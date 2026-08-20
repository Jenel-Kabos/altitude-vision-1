// PAY-4 — contrôleur HTTP : le callback ne fait jamais confiance au corps
// de la requête, et check-status applique une vérification d'ownership.
jest.mock('../models/HotelReservation');
jest.mock('../models/FinancialPayment');
jest.mock('../services/finance/financialAuthorizationService');
jest.mock('../services/finance/mtnHotelPaymentBridge');
jest.mock('../services/payments/providers/mtn/mtnMoMoProvider');

const FinancialPayment = require('../models/FinancialPayment');
const authz = require('../services/finance/financialAuthorizationService');
const bridge = require('../services/finance/mtnHotelPaymentBridge');
const mtnMoMoProvider = require('../services/payments/providers/mtn/mtnMoMoProvider');
const ctrl = require('../controllers/mtnMomoPaymentController');

const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};

describe('mtnMomoPaymentController.callback — jamais de confiance dans le corps (PAY-4 §21/§22)', () => {
  afterEach(() => jest.clearAllMocks());

  test('un callback forgé (référence connue, statut prétendu SUCCESSFUL) déclenche seulement la réconciliation — jamais une confirmation directe du body', async () => {
    mtnMoMoProvider.extractCallbackReference.mockReturnValue({ referenceId: 'ref-1', trusted: false });
    FinancialPayment.findOne.mockResolvedValue({ _id: 'pay-1' });
    bridge.reconcileMtnHotelPayment.mockResolvedValue({ transition: 'none' });

    const req = { headers: {}, body: { externalId: 'ref-1', status: 'SUCCESSFUL', amount: '999999999' } };
    const res = response();
    await ctrl.callback(req, res);

    expect(bridge.reconcileMtnHotelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'pay-1' }));
    // Le contrôleur ne lit jamais body.status pour décider quoi que ce soit :
    // seul reconcileMtnHotelPayment (qui rappelle MTN) peut confirmer.
    expect(res.statusCode).toBe(200);
  });

  test('une référence inconnue répond 200 neutre sans fuite d’information ni erreur', async () => {
    mtnMoMoProvider.extractCallbackReference.mockReturnValue({ referenceId: 'ref-inconnue', trusted: false });
    FinancialPayment.findOne.mockResolvedValue(null);
    const req = { headers: {}, body: {} };
    const res = response();
    await ctrl.callback(req, res);
    expect(res.statusCode).toBe(200);
    expect(bridge.reconcileMtnHotelPayment).not.toHaveBeenCalled();
  });

  test('un callback totalement invalide (aucune référence) ne fait jamais planter la route — toujours 200, MTN ne retente pas (§21)', async () => {
    mtnMoMoProvider.extractCallbackReference.mockImplementation(() => { throw Object.assign(new Error('no ref'), { code: 'MTN_MOMO_CALLBACK_INVALID' }); });
    const req = { headers: {}, body: {} };
    const res = response();
    await ctrl.callback(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('mtnMomoPaymentController.checkStatus — ownership (PAY-4 §37, IDOR)', () => {
  afterEach(() => jest.clearAllMocks());

  test('un tiers sans droit de vue financière est refusé (403)', async () => {
    FinancialPayment.findById.mockResolvedValue({ _id: 'pay-1', provider: 'mtn_direct', establishmentId: 'hotel-1', payer: { userId: 'owner-1' } });
    authz.assertCanViewFinancialPayment.mockRejectedValue(Object.assign(new Error('forbidden'), { code: 'FINANCIAL_UNAUTHORIZED', statusCode: 403 }));

    const req = { params: { paymentId: 'pay-1' }, headers: { 'idempotency-key': 'k1' }, user: { id: 'other-user' } };
    const res = response();
    const next = jest.fn();
    await ctrl.checkStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FINANCIAL_UNAUTHORIZED' }));
    expect(bridge.reconcileMtnHotelPayment).not.toHaveBeenCalled();
  });

  test('le titulaire du paiement (payer.userId) peut vérifier sans passer par la capacité staff', async () => {
    FinancialPayment.findById.mockResolvedValue({ _id: 'pay-1', provider: 'mtn_direct', establishmentId: 'hotel-1', payer: { userId: 'owner-1' } });
    bridge.reconcileMtnHotelPayment.mockResolvedValue({ payment: { _id: 'pay-1', status: 'pending', provider: 'mtn_direct', method: 'mobile_money', amountMinor: 1000, currency: 'XAF', paymentReference: 'r' }, transition: 'none' });

    const req = { params: { paymentId: 'pay-1' }, headers: { 'idempotency-key': 'k1' }, user: { id: 'owner-1' } };
    const res = response();
    await ctrl.checkStatus(req, res, jest.fn());

    expect(authz.assertCanViewFinancialPayment).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
