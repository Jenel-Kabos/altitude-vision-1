// PAY-4 — orchestrateur du parcours "MTN MoMo Direct" pour le domaine Hôtel
// (seul domaine où le Financial Core est aujourd'hui canonique — PAY-1
// §18/§20). Ce fichier ne fait AUCUN appel réseau lui-même et ne réimplémente
// aucune décision financière : il appelle exclusivement `mtnMoMoProvider`
// (transport) et les services canoniques du Financial Core
// (`financialPaymentService`, `paymentAllocationService`), conformément au
// mandat PAY-4 §30/§7 (« le provider doit appeler le mécanisme canonique
// existant »).
//
// Parcours :
//   initiateMtnHotelPayment  → FinancialPayment pending + RequestToPay (202)
//   confirmMtnHotelPayment   → TOUJOURS une GET status inquiry MTN d'abord
//                               (jamais une confiance aveugle en un callback,
//                               PAY-4 §22) → transition pending→succeeded/failed
//                               via les fonctions canoniques existantes
const HotelReservation = require('../../models/HotelReservation');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialPayment = require('../../models/FinancialPayment');
const { createHotelPayment, confirmHotelPayment, failHotelPayment } = require('./financialPaymentService');
const { fail } = require('./financialError');
const mtnMoMoProvider = require('../payments/providers/mtn/mtnMoMoProvider');
const mtnClient = require('../payments/providers/mtn/mtnMoMoClient');
const logger = require('../../utils/logger');

// PAY-4 §36/§37 — un client ne peut initier un paiement MTN que pour SA
// propre réservation. Le staff autorisé (déjà couvert par
// `financial.payment.create`, financialAuthorizationService) peut aussi
// l'initier au nom d'un client au comptoir — cette fonction n'ajoute qu'un
// second chemin d'autorisation additif (auto-paiement), elle ne retire ni ne
// modifie aucune capacité IAM existante.
function assertActorCanPayReservation(actor, reservation, { staffAuthorized = false } = {}) {
  const actorId = String(actor.id || actor._id || '');
  const isOwnGuest = reservation.guestUser && String(reservation.guestUser) === actorId;
  if (!isOwnGuest && !staffAuthorized) {
    fail('FINANCIAL_UNAUTHORIZED', 'Vous ne pouvez initier un paiement que pour votre propre réservation.', 403);
  }
}

async function loadReservationAndDocument({ reservationId, documentId }) {
  const reservation = await HotelReservation.findById(reservationId);
  if (!reservation) fail('FINANCIAL_DOCUMENT_MISSING', 'Réservation introuvable.', 404);
  const document = await FinancialDocument.findOne({ _id: documentId, domain: 'hotel', subjectType: 'HotelReservation', subjectId: reservation._id });
  if (!document) fail('FINANCIAL_DOCUMENT_MISSING', 'Facture introuvable pour cette réservation.', 404);
  if (document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'La facture doit être émise avant tout paiement.', 409);
  if (document.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'Seul XAF est supporté pour le paiement hôtelier.', 409);
  return { reservation, document };
}

// PAY-4 §16 — le montant vient toujours du serveur (solde réel de la
// facture) ; le client ne peut demander qu'un montant positif ne dépassant
// jamais ce solde (paiement partiel autorisé, jamais un montant arbitraire
// supérieur à la dette réelle).
function assertRequestedAmountWithinBalance(requestedAmountMinor, document) {
  if (!Number.isSafeInteger(requestedAmountMinor) || requestedAmountMinor <= 0) {
    fail('FINANCIAL_INVALID_AMOUNT', 'Le montant doit être un entier strictement positif.');
  }
  if (requestedAmountMinor > document.balanceMinor) {
    fail('FINANCIAL_DOCUMENT_OVERPAYMENT', `Le montant dépasse le solde restant (${document.balanceMinor}).`, 409);
  }
}

async function initiateMtnHotelPayment({ reservationId, documentId, amountMinor, msisdn, actor, businessOperationKey, staffAuthorized = false }) {
  const { reservation, document } = await loadReservationAndDocument({ reservationId, documentId });
  assertActorCanPayReservation(actor, reservation, { staffAuthorized });
  assertRequestedAmountWithinBalance(amountMinor, document);
  // Validé avant toute écriture — un MSISDN invalide ne crée aucun paiement.
  const normalizedMsisdn = mtnMoMoProvider.normalizeMsisdn(msisdn);

  const referenceId = mtnClient.generateReferenceId();
  const { payment, created } = await createHotelPayment({
    data: {
      establishmentId: reservation.hotel, documentId: document._id, reservationId: reservation._id,
      amountMinor, currency: 'XAF', method: 'mobile_money', provider: 'mtn_direct', providerPaymentId: referenceId,
      reference: referenceId, payer: { name: reservation.guest?.firstName ? `${reservation.guest.firstName} ${reservation.guest.lastName || ''}`.trim() : undefined, phone: normalizedMsisdn, userId: reservation.guestUser || undefined },
    },
    actor, businessOperationKey,
  });

  if (!created) {
    // PAY-4 §18 — rejeu de la même intention (retry HTTP) : le paiement
    // existe déjà avec sa référence MTN déjà réservée. Ne JAMAIS rappeler
    // RequestToPay une seconde fois — l'appelant doit interroger le statut.
    logger.info('mtn_momo.initiate.idempotent_replay', { paymentId: String(payment._id), status: payment.status });
    return { payment, nextAction: payment.status === 'pending' ? 'CONFIRM_ON_PHONE' : 'CHECK_STATUS' };
  }

  try {
    await mtnMoMoProvider.initiatePayment({
      referenceId, amountMinor, msisdn: normalizedMsisdn, externalId: String(payment._id),
      payerMessage: `Paiement séjour — ${document.documentNumber || document._id}`,
      payeeNote: `Réservation ${reservation.reference || reservation._id}`,
    });
  } catch (error) {
    // PAY-4 §28 — timeout/erreur réseau après la persistance du paiement
    // `pending` + de sa référence : jamais recréer une seconde
    // RequestToPay. Le paiement reste `pending`, consultable via
    // `getMtnHotelPaymentStatus`/réconciliation.
    logger.warn('mtn_momo.initiate.transport_error', { paymentId: String(payment._id), code: error.code });
    return { payment, nextAction: 'CHECK_STATUS', transportError: error.code };
  }
  return { payment, nextAction: 'CONFIRM_ON_PHONE' };
}

// PAY-4 §22/§25 — corrobore TOUJOURS via une GET status inquiry MTN avant
// toute confirmation, que l'appel vienne d'un callback ou d'une action
// utilisateur "Vérifier le paiement" (§25). Un `body.status` de callback
// n'est jamais transmis directement à cette fonction.
async function reconcileMtnHotelPayment({ paymentId, actor, businessOperationKey }) {
  const payment = await FinancialPayment.findById(paymentId);
  if (!payment) fail('FINANCIAL_PAYMENT_NOT_AVAILABLE', 'Paiement introuvable.', 404);
  if (payment.provider !== 'mtn_direct') fail('FINANCIAL_PROVIDER_UNKNOWN', 'Ce paiement n’est pas un paiement MTN Direct.', 409);
  if (payment.status !== 'pending') {
    // PAY-4 §24 — déjà dans un état terminal (ou processing) : rien à faire,
    // jamais de régression.
    return { payment, transition: 'none' };
  }
  const remote = await mtnMoMoProvider.getStatus({ providerPaymentId: payment.providerPaymentId });
  if (remote.normalizedStatus === 'pending') return { payment, transition: 'none', remoteStatus: remote.status };
  if (remote.normalizedStatus === 'succeeded') {
    const { payment: confirmed } = await confirmHotelPayment({ paymentId, actor, businessOperationKey });
    return { payment: confirmed, transition: 'confirmed', remoteStatus: remote.status };
  }
  // 'failed' — seule autre valeur normalisée possible pour mtn_direct.
  const { payment: failedPayment } = await failHotelPayment({ paymentId, actor, reason: remote.reason, businessOperationKey });
  return { payment: failedPayment, transition: 'failed', remoteStatus: remote.status, reason: remote.reason };
}

// PAY-4 §21 — un callback n'extrait qu'une référence, jamais un statut de
// confiance. Le contrôleur route ceci vers `reconcileMtnHotelPayment` après
// avoir retrouvé le `paymentId` interne correspondant.
async function findMtnHotelPaymentByProviderReference(providerPaymentId) {
  const payment = await FinancialPayment.findOne({ provider: 'mtn_direct', providerPaymentId });
  if (!payment) fail('MTN_MOMO_CALLBACK_INVALID', 'Référence MTN inconnue.', 404);
  return payment;
}

module.exports = {
  initiateMtnHotelPayment, reconcileMtnHotelPayment, findMtnHotelPaymentByProviderReference,
  assertActorCanPayReservation, assertRequestedAmountWithinBalance,
};
