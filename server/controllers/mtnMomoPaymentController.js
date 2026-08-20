// PAY-4 — contrôleurs HTTP pour le paiement hôtelier MTN MoMo Direct. Aucune
// logique financière ici : chaque handler charge le contexte, vérifie
// l'autorisation, puis délègue entièrement à `mtnHotelPaymentBridge`
// (mandat §7 : transport/logique financière/HTTP strictement séparés).
const HotelReservation = require('../models/HotelReservation');
const FinancialPayment = require('../models/FinancialPayment');
const authz = require('../services/finance/financialAuthorizationService');
const { fail } = require('../services/finance/financialError');
const { initiateMtnHotelPayment, reconcileMtnHotelPayment } = require('../services/finance/mtnHotelPaymentBridge');
const mtnMoMoProvider = require('../services/payments/providers/mtn/mtnMoMoProvider');

const requiredOperationKey = (req) => {
  const key = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (!String(key || '').trim()) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Une clé d’idempotence est obligatoire.');
  return String(key).trim();
};

// PAY-4 §39 — projection sûre : jamais `providerMetadata` (select:false déjà
// au niveau schéma), jamais le payloadHash, jamais un dump brut MTN.
const safePayment = (payment) => ({
  id: payment._id, status: payment.status, provider: payment.provider, method: payment.method,
  amountMinor: payment.amountMinor, currency: payment.currency, paymentReference: payment.paymentReference,
  createdAt: payment.createdAt, confirmedAt: payment.confirmedAt || null, failedAt: payment.failedAt || null,
});

const NEXT_ACTION_MESSAGE = {
  CONFIRM_ON_PHONE: 'Confirmez le paiement sur votre téléphone (code MTN MoMo).',
  CHECK_STATUS: 'Statut à vérifier — utilisez "Vérifier le paiement".',
};

// POST /api/financial/hotel/payments/mtn/initiate
// PAY-4 §36 — le client authentifié peut initier pour SA propre réservation
// (ownership vérifiée dans le bridge) ; un staff autorisé (déjà couvert par
// `financial.payment.create`) peut l'initier au comptoir pour un client.
exports.initiate = async (req, res, next) => {
  try {
    const { reservationId, documentId, amountMinor, msisdn } = req.body;
    if (!reservationId || !documentId || !amountMinor || !msisdn) {
      fail('FINANCIAL_INVALID_AMOUNT', 'reservationId, documentId, amountMinor et msisdn sont requis.');
    }
    const reservation = await HotelReservation.findById(reservationId).select('hotel guestUser');
    if (!reservation) fail('FINANCIAL_DOCUMENT_MISSING', 'Réservation introuvable.', 404);
    let staffAuthorized = false;
    try { await authz.assertCanCreateFinancialPayment(req.user, reservation.hotel); staffAuthorized = true; } catch { /* le client peut rester autorisé via ownership, tranché dans le bridge */ }

    const result = await initiateMtnHotelPayment({
      reservationId, documentId, amountMinor, msisdn, actor: req.user,
      businessOperationKey: requiredOperationKey(req), staffAuthorized,
    });

    // PAY-4 §41 — jamais "paiement réussi" avant confirmation finale.
    res.status(201).json({
      status: 'success',
      data: {
        paymentId: result.payment._id, provider: 'mtn_direct', status: result.payment.status,
        nextAction: result.nextAction, message: NEXT_ACTION_MESSAGE[result.nextAction] || null,
      },
    });
  } catch (e) { next(e); }
};

// POST /api/financial/hotel/payments/:paymentId/mtn/check-status
// PAY-4 §25 — action utilisateur explicite "Vérifier le paiement", toujours
// une vraie GET status inquiry MTN, jamais une confiance en un état local.
exports.checkStatus = async (req, res, next) => {
  try {
    const payment = await FinancialPayment.findById(req.params.paymentId);
    if (!payment || payment.provider !== 'mtn_direct') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement MTN introuvable.', 404);
    const actorId = String(req.user.id || req.user._id || '');
    const isOwner = payment.payer?.userId && String(payment.payer.userId) === actorId;
    if (!isOwner) await authz.assertCanViewFinancialPayment(req.user, payment.establishmentId);
    const result = await reconcileMtnHotelPayment({ paymentId: payment._id, actor: req.user, businessOperationKey: requiredOperationKey(req) });
    res.json({ status: 'success', data: { payment: safePayment(result.payment), transition: result.transition } });
  } catch (e) { next(e); }
};

// POST /api/payments/providers/mtn/callback — PUBLIC, aucun JWT (MTN ne
// s'authentifie pas comme un utilisateur applicatif). PAY-4 §21/§22 :
// n'extrait qu'une référence, ne fait JAMAIS confiance à `body.status` —
// corrobore systématiquement via une GET status inquiry avant toute
// confirmation (voir mtnHotelPaymentBridge.reconcileMtnHotelPayment).
exports.callback = async (req, res) => {
  try {
    const { referenceId } = mtnMoMoProvider.extractCallbackReference(req);
    const payment = await FinancialPayment.findOne({ provider: 'mtn_direct', providerPaymentId: referenceId });
    if (!payment) { res.status(200).json({ received: true }); return; } // référence inconnue : accusé réception neutre, aucune fuite d'information
    // Acteur système : aucun utilisateur authentifié n'est à l'origine d'un
    // callback provider (voir PAY4_MTN_MOMO_REPORT.md §38, limite documentée :
    // le ledger existant attribue `actorType: 'user'` même ici, la fonction
    // canonique n'étant pas modifiée pour ce sprint — mandat §30).
    await reconcileMtnHotelPayment({ paymentId: payment._id, actor: { id: null }, businessOperationKey: `mtn-callback:${referenceId}` });
    res.status(200).json({ received: true });
  } catch {
    // PAY-4 §21 — MTN ne retente pas le callback : on ne doit jamais renvoyer
    // une erreur qui laisserait croire à un problème transitoire à corriger
    // par un retry côté MTN (il n'y en aura pas). 200 systématique ; la
    // vérité reste la GET status inquiry (réconciliation), jamais ce webhook.
    res.status(200).json({ received: true, note: 'processed_with_deferred_reconciliation' });
  }
};
