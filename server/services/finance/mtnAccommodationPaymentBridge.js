const Reservation = require('../../models/AccommodationReservation');
const NightLock = require('../../models/AccommodationNightLock');
const FinancialPayment = require('../../models/FinancialPayment');
const billing = require('./accommodationBillingService');
const { fail } = require('./financialError');
const mtnProvider = require('../payments/providers/mtn/mtnMoMoProvider');
const mtnClient = require('../payments/providers/mtn/mtnMoMoClient');
const logger = require('../../utils/logger');
const { notify } = require('../notificationService');
const { appendFinancialLedgerEntry } = require('./financialLedgerService');
const { runFinancialOperation } = require('./financialTransactionService');
const { ensureLatePaymentRefund } = require('./accommodationRefundService');
const { PAYMENT_PURPOSES, resolveServerPaymentAmount } = require('./accommodationStayBalanceService');

const actorId = (actor) => String(actor?.id || actor?._id || '');

async function assertPayableReservation({ reservationId, actor, paymentPurpose = PAYMENT_PURPOSES.GUARANTEE, now = new Date() }) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) fail('FINANCIAL_DOCUMENT_MISSING', 'Réservation introuvable.', 404);
  if (String(reservation.guest) !== actorId(actor)) fail('FINANCIAL_UNAUTHORIZED', 'Vous ne pouvez payer que votre propre réservation.', 403);
  const guaranteePayment = paymentPurpose === PAYMENT_PURPOSES.GUARANTEE;
  if (guaranteePayment && reservation.status !== 'pending_payment') fail('ACCOMMODATION_PAYMENT_NOT_PENDING', 'Cette réservation n’est plus en attente de paiement.', 409);
  if (!guaranteePayment && !['confirmed', 'checked_in'].includes(reservation.status)) fail('ACCOMMODATION_STAY_PAYMENT_NOT_ALLOWED', 'Le solde ne peut être payé que pour un séjour confirmé ou en cours.', 409);
  if (guaranteePayment && (!reservation.paymentExpiresAt || reservation.paymentExpiresAt <= now)) fail('PAYMENT_HOLD_EXPIRED', 'Le délai de paiement est expiré.', 409);
  if (reservation.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'Seul XAF est supporté.', 409);
  const lockQuery = guaranteePayment
    ? { lockType: 'hold', expiresAt: { $gt: now } }
    : { lockType: 'confirmed' };
  const held = await NightLock.countDocuments({ accommodation: reservation.accommodation, sourceType: 'reservation', sourceId: reservation._id, ...lockQuery });
  if (held !== reservation.nights) fail('PAYMENT_HOLD_LOST', 'Les dates de cette réservation ne sont plus détenues.', 409);
  return reservation;
}

async function initiateMtnAccommodationPayment({ reservationId, msisdn, actor, businessOperationKey, paymentPurpose = PAYMENT_PURPOSES.GUARANTEE, now = new Date() }) {
  const reservation = await assertPayableReservation({ reservationId, actor, paymentPurpose, now });
  const document = await billing.ensureAccommodationInvoice({ reservationId, actor });
  const amountMinor = Math.min(resolveServerPaymentAmount(reservation, paymentPurpose), Number(document.balanceMinor || 0));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('ACCOMMODATION_BALANCE_ALREADY_PAID', 'Aucun montant ne reste à payer pour cette opération.', 409);
  const normalizedMsisdn = mtnProvider.normalizeMsisdn(msisdn);
  const referenceId = mtnClient.generateReferenceId();
  const obligationKey = `accommodation-stay-payment:${reservation._id}:${Number(reservation.amountPaid || 0)}`;
  const { payment, created } = await billing.createAccommodationPayment({
    reservationId, amountMinor, method: 'mobile_money', reference: referenceId, actor, idempotencyKey: businessOperationKey,
    provider: 'mtn_direct', providerPaymentId: referenceId, paymentPurpose, obligationKey,
  });
  if (!created) return { payment, amountMinor: payment.amountMinor, nextAction: 'CHECK_STATUS' };
  try {
    await mtnProvider.initiatePayment({ referenceId, amountMinor, msisdn: normalizedMsisdn, externalId: String(payment._id), payerMessage: paymentPurpose === PAYMENT_PURPOSES.GUARANTEE ? 'Garantie réservation Altimmo' : 'Paiement séjour Altimmo', payeeNote: `Réservation ${reservation._id}` });
    return { payment, amountMinor, paymentPurpose, paymentExpiresAt: paymentPurpose === PAYMENT_PURPOSES.GUARANTEE ? reservation.paymentExpiresAt : null, nextAction: 'CONFIRM_ON_PHONE' };
  } catch (error) {
    logger.warn('mtn_accommodation.initiate.transport_error', { paymentId: String(payment._id), code: error.code });
    return { payment, amountMinor, paymentPurpose, paymentExpiresAt: paymentPurpose === PAYMENT_PURPOSES.GUARANTEE ? reservation.paymentExpiresAt : null, nextAction: 'CHECK_STATUS', transportError: error.code };
  }
}

async function markLatePaymentRefundRequired(payment, now, businessOperationKey) {
  return runFinancialOperation({ operationName: 'payment.accommodation.late_refund_required', transactionMode: 'auto' }, async ({ session }) => {
    const updated = await FinancialPayment.findOneAndUpdate(
      { _id: payment._id, status: 'pending' },
      { $set: { status: 'succeeded', confirmedAt: now, providerRefundStatus: 'refund_required', refundRequiredAt: now, 'providerMetadata.latePayment': true } },
      { new: true, session },
    );
    if (!updated) return FinancialPayment.findById(payment._id);
    await appendFinancialLedgerEntry({ eventType: 'payment.confirmed', domain: updated.domain, establishmentType: updated.establishmentType, establishmentId: updated.establishmentId, entityType: 'FinancialPayment', entityId: updated._id, relatedEntities: [{ entityType: 'AccommodationReservation', entityId: updated.subjectId }], actorType: 'provider', amountMinor: updated.amountMinor, currency: updated.currency, businessOperationKey: `${businessOperationKey}:late-confirmed`, previousState: { status: 'pending' }, newState: { status: 'succeeded', allocated: false } }, { session });
    await ensureLatePaymentRefund({ reservationId: updated.subjectId || payment.subjectId, paymentId: updated._id, session });
    return updated;
  });
}

async function reconcileMtnAccommodationPayment({ paymentId, actor, businessOperationKey, now = new Date() }) {
  const payment = await FinancialPayment.findById(paymentId);
  if (!payment || payment.provider !== 'mtn_direct' || payment.subjectType !== 'AccommodationReservation') fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement MTN hébergement introuvable.', 404);
  if (payment.status !== 'pending') return { payment, transition: 'none' };
  const remote = await mtnProvider.getStatus({ providerPaymentId: payment.providerPaymentId });
  if (remote.normalizedStatus === 'pending') return { payment, transition: 'none', remoteStatus: remote.status };
  if (remote.normalizedStatus === 'failed') {
    const failed = await FinancialPayment.findOneAndUpdate({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', failedAt: now }, $unset: { obligationKey: 1 } }, { new: true });
    return { payment: failed || payment, transition: 'failed', remoteStatus: remote.status };
  }
  const reservation = await Reservation.findById(payment.subjectId);
  const guaranteePayment = (payment.metadata?.paymentPurpose || PAYMENT_PURPOSES.GUARANTEE) === PAYMENT_PURPOSES.GUARANTEE;
  if (!reservation || reservation.status === 'expired' || reservation.status === 'cancelled' || (guaranteePayment && (!reservation.paymentExpiresAt || reservation.paymentExpiresAt <= now))) {
    const late = await markLatePaymentRefundRequired(payment, now, businessOperationKey);
    return { payment: late, transition: 'late_payment_refund_required', remoteStatus: remote.status };
  }
  try {
    const result = await billing.confirmAndAllocateAccommodationPayment({ paymentId: payment._id, actor, idempotencyKey: businessOperationKey });
    if (result.reservation.status === 'confirmed') {
      const claimed = await Reservation.findOneAndUpdate({ _id: result.reservation._id, confirmationNotifiedAt: null }, { $set: { confirmationNotifiedAt: now } });
      if (claimed) await notify({ recipient: result.reservation.guest, type: 'accommodation_reservation_confirmed', title: 'Réservation confirmée', message: 'Votre paiement a été confirmé. Votre réservation est maintenant confirmée.', link: '/profile', entityType: 'AccommodationReservation', entityId: result.reservation._id, metadata: { businessOperationKey } }).catch(() => null);
    }
    return { ...result, transition: result.reservation.status === 'confirmed' ? 'confirmed' : 'payment_recorded', remoteStatus: remote.status };
  } catch (error) {
    if (!['ACCOMMODATION_LATE_PAYMENT_REFUND_REQUIRED', 'PAYMENT_HOLD_EXPIRED', 'PAYMENT_HOLD_LOST'].includes(error.code)) throw error;
    const late = await markLatePaymentRefundRequired(payment, now, businessOperationKey);
    return { payment: late, transition: 'late_payment_refund_required', remoteStatus: remote.status };
  }
}

module.exports = { initiateMtnAccommodationPayment, reconcileMtnAccommodationPayment, assertPayableReservation };
