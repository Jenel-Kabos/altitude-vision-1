// F-U2.11 — Suivi locatif autonome d'un bailleur personne physique sans
// organisation ni mandat. Séparation stricte :
//   1. échéance de SUIVI   : brouillon figé `trackingObligation` (jamais émis) ;
//   2. facture légale      : impossible ici (aucun émetteur habilité inventé) ;
//   3. paiement confirmé   : FinancialPayment déclaré et confirmé par le bailleur
//                            (fonds reçus directement, aucun mouvement plateforme) ;
//   4. recouvrement        : rentCollectionService (même moteur canonique).
// F-U2.12 — chaque loyer reçu crée un encaissement direct (DirectRentReceipt)
// DÉCLARÉ : utilisé pour le suivi locatif ; il n'entre dans la base du 1 %
// qu'après confirmation indépendante (directRentReceiptService).

const mongoose = require('mongoose');
const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialPayment = require('../../../models/FinancialPayment');
const { FINANCIAL_PAYMENT_METHODS } = require('../../../constants/financialConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { generateOwnerTrackingRentDue } = require('./rentBillingService');
const { DUE_FILTER } = require('./rentCollectionService');
const Contrat = require('../../../models/Contrat');
const { declareReceipt } = require('./directRentReceiptService');

async function loadOwnTrackingDue(actorId, documentId) {
  const document = mongoose.isValidObjectId(documentId) ? await FinancialDocument.findOne({ _id: documentId, ...DUE_FILTER, 'metadata.trackingObligation': true }).lean() : null;
  if (!document || !actorId || String(document.metadata?.ownerScope) !== String(actorId)) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Échéance inaccessible.', 404);
  return document;
}

// Loyer reçu directement par le bailleur. Idempotent par clé ; date de
// réception ≤ maintenant ; montant ≤ solde ; instruction d'imputation
// facultative (`rentMinor` = part loyer), sinon imputation selon rentPosition.
async function recordOwnerRentReceipt({ actor, documentId, amountMinor, receivedAt, method = 'cash', reference = null, rentMinor = null, evidence = null, idempotencyKey, now = new Date() }) {
  const actorId = authz.idOf(actor);
  const document = await loadOwnTrackingDue(actorId, documentId);
  const key = String(idempotencyKey || '').trim();
  if (!key) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'En-tête Idempotency-Key obligatoire.', 422);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant invalide.', 422);
  if (!FINANCIAL_PAYMENT_METHODS.includes(method)) fail('FINANCIAL_PAYMENT_METHOD_INVALID', 'Mode de paiement invalide.', 422);
  const received = receivedAt ? new Date(receivedAt) : new Date(now);
  if (Number.isNaN(received.getTime()) || received > new Date(now)) fail('RENT_RECEIPT_DATE_INVALID', 'Date de réception invalide (future ou mal formée).', 422);
  if (rentMinor != null && (!Number.isSafeInteger(rentMinor) || rentMinor < 0 || rentMinor > amountMinor)) fail('RENT_IMPUTATION_INVALID', 'Part loyer invalide.', 422);
  const paymentReference = `OWNER-${key}`.slice(0, 120);
  const existing = await FinancialPayment.findOne({ domain: 'rental', establishmentId: document.establishmentId, paymentReference }).lean();
  if (existing) {
    if (existing.amountMinor !== amountMinor || String(existing.metadata?.financialDocument) !== String(document._id)) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Cette clé correspond à un autre encaissement.', 409);
    return { payment: existing, replayed: true };
  }
  if (amountMinor > document.balanceMinor) fail('FINANCIAL_DOCUMENT_OVERPAYMENT', 'Le montant dépasse le solde de l’échéance.', 409);
  // F-U2.13 — DÉCLARATION : paiement en attente (`pending`), non affecté ; il
  // ne solde rien tant qu'une confirmation indépendante n'a pas eu lieu.
  return runFinancialOperation({ operationName: 'rental.owner_receipt.declare', transactionMode: 'transactional' }, async ({ session }) => {
    const [payment] = await FinancialPayment.create([{
      tenant: null, domain: 'rental', establishmentType: 'Property', establishmentId: document.establishmentId, paymentReference, status: 'pending', method, provider: 'manual',
      currency: 'XAF', amountMinor, availableAmountMinor: amountMinor, receivedAt: received, createdBy: actorId,
      metadata: {
        source: 'OWNER_DECLARED_RECEIPT', financialDocument: document._id, ownerReference: reference ? String(reference).slice(0, 200) : null, recordedAt: new Date(now),
        ...(rentMinor != null ? { rentImputation: { financialDocument: document._id, rentMinor, source: 'OWNER_INSTRUCTION' } } : {}),
      },
    }], { session });
    const lease = document.subjectType === 'Contrat' ? await Contrat.findById(document.subjectId).select('locataire').session(session).lean() : null;
    const receipt = await declareReceipt({ session, payment, document, ownerId: actorId, locataireId: lease?.locataire || null, evidence });
    return { payment: payment.toObject(), receipt: receipt.toObject(), replayed: false };
  });
}

module.exports = { generateOwnerTrackingRentDue, recordOwnerRentReceipt };
