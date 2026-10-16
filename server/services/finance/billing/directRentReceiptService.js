// F-U2.12 — Circuit de preuve des encaissements directs (bailleur sans
// organisation). Statuts : DECLARED → EVIDENCE_SUBMITTED → UNDER_REVIEW →
// CONFIRMED | CONTESTED | CANCELLED.
//   - bailleur : déclare, ajoute des RÉFÉRENCES vérifiables, annule (correction) ;
//     ne confirme jamais lui-même ;
//   - locataire du bail : confirme ou conteste (contrôle indépendant) ;
//   - revue plateforme (`billing.manage`, contexte PLATFORM) : instruit et
//     tranche — Altitude Vision ne revoit ces encaissements qu'au titre de sa
//     propre facturation du 1 %.
// Une même référence de transaction ne justifie qu'un encaissement (index unique).
// Aucun fichier n'est accepté (stockage de justificatifs non admissible).

const mongoose = require('mongoose');
const Receipt = require('../../../models/DirectRentReceipt');
const PaymentAllocation = require('../../../models/PaymentAllocation');
const { fail } = require('../financialError');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const FinancialPayment = require('../../../models/FinancialPayment');
const { allocatePaymentToDocument, reversePaymentAllocation } = require('../paymentAllocationService');
const { runFinancialOperation } = require('../financialTransactionService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { resolveLocataireForUser } = require('../../tenantLinkService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const OPEN = ['DECLARED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW'];
const normalizeKey = (kind, reference) => `${kind}:${String(reference).trim().toUpperCase().replace(/\s+/g, '')}`;

async function load(receiptId) {
  const receipt = mongoose.isValidObjectId(receiptId) ? await Receipt.findById(receiptId).lean() : null;
  if (!receipt) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Encaissement inaccessible.', 404);
  return receipt;
}

function assertOwner(actor, receipt) {
  const actorId = idOf(actor);
  if (!actorId || String(receipt.owner) !== actorId) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Encaissement inaccessible.', 404);
  return actorId;
}

async function transition(receipt, from, set, action, actorId, reason, extra = {}, session = null) {
  const updated = await Receipt.findOneAndUpdate(
    { _id: receipt._id, status: { $in: from } },
    { $set: set, $push: { history: { action, actor: actorId, at: new Date(), reason: reason || null } }, ...extra },
    { new: true, session },
  ).lean();
  if (!updated) fail('DIRECT_RECEIPT_INVALID_TRANSITION', 'Opération impossible dans l’état actuel de l’encaissement.', 409);
  return updated;
}

// Création à l'enregistrement d'un loyer reçu (même transaction que le paiement).
async function declareReceipt({ session, payment, document, ownerId, locataireId, evidence = null }) {
  const evidenceEntry = evidence ? validateEvidence(evidence, ownerId) : null;
  const [receipt] = await Receipt.create([{
    payment: payment._id, document: document._id, lease: document.subjectType === 'Contrat' ? document.subjectId : null, property: document.establishmentId,
    owner: ownerId, locataire: locataireId || null, amountMinor: payment.amountMinor, receivedAt: payment.receivedAt,
    status: evidenceEntry ? 'EVIDENCE_SUBMITTED' : 'DECLARED',
    ...(evidenceEntry ? { evidence: [evidenceEntry.entry], evidenceKeys: [evidenceEntry.key] } : {}),
    history: [{ action: 'declared', actor: ownerId, at: new Date() }, ...(evidenceEntry ? [{ action: 'evidence_submitted', actor: ownerId, at: new Date() }] : [])],
  }], { session }).catch((error) => {
    if (error?.code === 11000) fail('DIRECT_RECEIPT_EVIDENCE_ALREADY_USED', 'Cette référence de transaction justifie déjà un autre encaissement.', 409);
    throw error;
  });
  return receipt;
}

function validateEvidence({ kind, reference }, actorId) {
  if (!Receipt.EVIDENCE_KINDS.includes(kind)) fail('DIRECT_RECEIPT_EVIDENCE_INVALID', 'Type de preuve attendu : référence prestataire, Mobile Money, bancaire ou autre référence.', 422);
  const ref = String(reference || '').trim();
  if (ref.length < 4 || ref.length > 120) fail('DIRECT_RECEIPT_EVIDENCE_INVALID', 'Référence de transaction invalide.', 422);
  return { entry: { kind, reference: ref, submittedAt: new Date(), submittedBy: actorId }, key: normalizeKey(kind, ref) };
}

async function submitEvidence({ actor, receiptId, kind, reference }) {
  const receipt = await load(receiptId);
  const actorId = assertOwner(actor, receipt);
  const { entry, key } = validateEvidence({ kind, reference }, actorId);
  try {
    return await transition(receipt, ['DECLARED', 'EVIDENCE_SUBMITTED'], { status: 'EVIDENCE_SUBMITTED' }, 'evidence_submitted', actorId, kind, { $addToSet: { evidenceKeys: key }, $push: { evidence: entry, history: { action: 'evidence_submitted', actor: actorId, at: new Date(), reason: kind } } });
  } catch (error) {
    if (error?.code === 11000) fail('DIRECT_RECEIPT_EVIDENCE_ALREADY_USED', 'Cette référence de transaction justifie déjà un autre encaissement.', 409);
    throw error;
  }
}

// F-U2.13 — confirmation indépendante = effet financier : paiement en
// attente → confirmé (daté de la réception déclarée, attestée par le
// contrôle), écriture au ledger, affectation à l'échéance ; une transaction.
async function confirmWithFinancialEffect(receipt, confirmation, action, actorId, reason) {
  return runFinancialOperation({ operationName: 'rental.direct_receipt.confirm', transactionMode: 'transactional' }, async ({ session }) => {
    const updated = await transition(receipt, OPEN, { status: 'CONFIRMED', confirmation }, action, actorId, reason, {}, session);
    const payment = await FinancialPayment.findOneAndUpdate({ _id: receipt.payment, status: 'pending' }, { $set: { status: 'succeeded', confirmedAt: receipt.receivedAt, confirmedBy: actorId } }, { new: true, session });
    if (!payment) fail('FINANCIAL_PAYMENT_INVALID_TRANSITION', 'Paiement déjà traité.', 409);
    await appendFinancialLedgerEntry({ eventType: 'payment.confirmed', domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId, entityType: 'FinancialPayment', entityId: payment._id, relatedEntities: [{ entityType: 'FinancialDocument', entityId: receipt.document }], actorType: 'user', actorId, amountMinor: payment.amountMinor, currency: payment.currency, businessOperationKey: `direct-receipt-confirm:${receipt._id}`, previousState: { status: 'pending' }, newState: { status: 'succeeded' }, metadata: { basis: confirmation.basis, source: 'OWNER_DECLARED_RECEIPT' } }, { session });
    await allocatePaymentToDocument({ paymentId: payment._id, documentId: receipt.document, amountMinor: payment.amountMinor, businessOperationKey: `direct-receipt-allocate:${receipt._id}`, actor: { _id: actorId }, session });
    return updated;
  });
}

// Contestation d'un encaissement déjà confirmé : contrepassation tracée de
// l'affectation (aucune suppression, aucun remboursement).
async function reverseIfConfirmed(receipt, actorId, reason) {
  if (receipt.status !== 'CONFIRMED') return;
  const allocation = await PaymentAllocation.findOne({ financialPayment: receipt.payment, status: 'active' }).lean();
  if (allocation) await reversePaymentAllocation({ allocationId: allocation._id, reason: `Encaissement direct contesté : ${reason}`, businessOperationKey: `direct-receipt-contest:${receipt._id}`, actor: { _id: actorId }, transactionMode: 'transactional' });
}

// Contrôle indépendant n° 1 : le locataire du bail.
async function tenantRespond({ userId, receiptId, decision, reason = null }) {
  const receipt = await load(receiptId);
  const locataire = await resolveLocataireForUser(userId);
  if (!locataire || !receipt.locataire || String(locataire._id) !== String(receipt.locataire)) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Encaissement inaccessible.', 404);
  if (decision === 'confirm') return confirmWithFinancialEffect(receipt, { basis: 'TENANT_CONFIRMATION', by: userId, at: new Date(), note: reason }, 'confirmed_by_tenant', userId, reason);
  if (decision === 'contest') {
    if (!String(reason || '').trim()) fail('DIRECT_RECEIPT_REASON_REQUIRED', 'Motif de contestation requis.', 422);
    const updated = await transition(receipt, [...OPEN, 'CONFIRMED'], { status: 'CONTESTED', contest: { by: userId, at: new Date(), reason } }, 'contested_by_tenant', userId, reason);
    await reverseIfConfirmed(receipt, userId, reason);
    return updated;
  }
  return fail('BILLING_DECISION_INVALID', 'Décision invalide.', 422);
}

// Contrôle indépendant n° 2 : revue plateforme habilitée (jamais le bailleur).
async function platformReview({ actor, receiptId, decision, note = null }) {
  const receipt = await load(receiptId);
  const authority = await authz.assertContractualCapability(actor, CAP.BILLING_MANAGE);
  if (authority.plane !== 'PLATFORM') fail('FINANCIAL_UNAUTHORIZED', 'Revue réservée à la vue plateforme Altitude Vision.', 403);
  if (String(authority.userId) === String(receipt.owner)) fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Le bailleur ne peut pas confirmer son propre encaissement.', 403);
  if (decision === 'start') return transition(receipt, ['EVIDENCE_SUBMITTED'], { status: 'UNDER_REVIEW' }, 'review_started', authority.userId, note);
  if (decision === 'confirm') {
    if (!(receipt.evidence || []).length) fail('DIRECT_RECEIPT_EVIDENCE_REQUIRED', 'Aucune référence vérifiable : confirmation impossible.', 409);
    if (!['EVIDENCE_SUBMITTED', 'UNDER_REVIEW'].includes(receipt.status)) fail('DIRECT_RECEIPT_INVALID_TRANSITION', 'Opération impossible dans l’état actuel de l’encaissement.', 409);
    return confirmWithFinancialEffect(receipt, { basis: 'PLATFORM_REVIEW', by: authority.userId, at: new Date(), note }, 'confirmed_by_platform', authority.userId, note);
  }
  if (decision === 'contest') {
    if (!String(note || '').trim()) fail('DIRECT_RECEIPT_REASON_REQUIRED', 'Motif requis.', 422);
    const updated = await transition(receipt, [...OPEN, 'CONFIRMED'], { status: 'CONTESTED', contest: { by: authority.userId, at: new Date(), reason: note } }, 'contested_by_platform', authority.userId, note);
    await reverseIfConfirmed(receipt, authority.userId, note);
    return updated;
  }
  return fail('BILLING_DECISION_INVALID', 'Décision invalide.', 422);
}

// Correction par le bailleur : annulation tracée d'une déclaration non
// confirmée (ou contestée). Un encaissement confirmé ne s'annule pas par le
// bailleur seul (contestation par le locataire ou la plateforme).
async function cancelReceipt({ actor, receiptId, reason }) {
  const receipt = await load(receiptId);
  const actorId = assertOwner(actor, receipt);
  if (!String(reason || '').trim()) fail('DIRECT_RECEIPT_REASON_REQUIRED', 'Motif requis.', 422);
  const updated = await transition(receipt, [...OPEN, 'CONTESTED'], { status: 'CANCELLED', cancellation: { by: actorId, at: new Date(), reason } }, 'cancelled_by_owner', actorId, reason);
  await FinancialPayment.updateOne({ _id: receipt.payment, status: 'pending' }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
  return updated;
}

async function listForPlatform({ actor, status = null }) {
  const authority = await authz.assertContractualCapability(actor, CAP.BILLING_MANAGE);
  if (authority.plane !== 'PLATFORM') fail('FINANCIAL_UNAUTHORIZED', 'Revue réservée à la vue plateforme Altitude Vision.', 403);
  const filter = status ? { status } : { status: { $in: ['EVIDENCE_SUBMITTED', 'UNDER_REVIEW'] } };
  return (await Receipt.find(filter).sort({ createdAt: 1 }).limit(200).lean()).map(publicReceipt);
}

const publicReceipt = (r) => ({ id: r._id, document: r.document, lease: r.lease, amountMinor: r.amountMinor, receivedAt: r.receivedAt, status: r.status, evidence: (r.evidence || []).map(({ kind, reference, submittedAt }) => ({ kind, reference, submittedAt })), confirmation: r.confirmation, contest: r.contest, cancellation: r.cancellation, history: r.history });

module.exports = { declareReceipt, submitEvidence, tenantRespond, platformReview, cancelReceipt, listForPlatform, publicReceipt };
