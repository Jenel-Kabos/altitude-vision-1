// F-U1.E — Gouvernance des remboursements selon le risque.
//
// Étend le modèle FinancialRefund existant (sous-document `governance` et
// statuts additionnels), sans toucher au cycle historique des remboursements
// hôteliers/hébergement. Règles :
//   - politique par activité ; sans seuil validé, la politique est
//     `unconfigured` et TOUT remboursement exige la double validation ;
//   - certains signaux imposent la double validation quel que soit le montant ;
//     suspicion de fraude / anomalie majeure → blocage jusqu'à résolution ;
//   - l'initiateur n'approuve jamais sa propre demande ; une même personne
//     n'approuve jamais deux fois ; chaque décision est historisée (append-only) ;
//   - les autorisations sont revérifiées avant la mise en attente d'exécution ;
//   - le montant demandé ne dépasse jamais le solde encore remboursable,
//     contrôlé sous verrou transactionnel ;
//   - aucune exécution réelle : executeGovernedRefund échoue toujours (501).

const mongoose = require('mongoose');
const FinancialRefund = require('../../../models/FinancialRefund');
const FinancialRefundPolicy = require('../../../models/FinancialRefundPolicy');
const FinancialRefundApproval = require('../../../models/FinancialRefundApproval');
const FinancialPayment = require('../../../models/FinancialPayment');
const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialBeneficiary = require('../../../models/FinancialBeneficiary');
const PaymentAllocation = require('../../../models/PaymentAllocation');
const MandateCollection = require('../../../models/MandateCollection');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { supportsRefund } = require('../paymentProviderRegistry');
const counters = require('./financialLimitCounterService');
const ManagementMandate = require('../../../models/ManagementMandate');
const authz = require('./contractualFinanceAuthorizationService');
const { resolveOwnerAuthority } = require('./ownerAuthorityService');
const { assertDistinctHumans } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
// Remboursements qui consomment le solde remboursable d'un paiement.
const REFUND_CONSUMING_STATUSES = Object.freeze(['requested', 'pending_approval', 'approved', 'awaiting_execution', 'processing', 'completed', 'to_reconcile', 'blocked']);
const OPEN_GOVERNED_STATUSES = Object.freeze(['pending_approval', 'approved', 'awaiting_execution']);

// ─── Politique ──────────────────────────────────────────────────────────

const unconfiguredSnapshot = (activity, currency) => Object.freeze({
  policyId: null, version: null, status: C.REFUND_POLICY_STATUSES.UNCONFIGURED, activity, currency,
  standardApprovalMaxMinor: null, additionalDualApprovalSignals: [], ownerConsentRequired: false,
});

async function draftRefundPolicy({ actor, activity, currency, standardApprovalMaxMinor = null, additionalDualApprovalSignals = [], ownerConsentRequired, decisionReference }) {
  const authority = await authz.assertContractualCapability(actor, CAP.REFUND_POLICY_MANAGE);
  if (!Object.values(C.REFUND_ACTIVITIES).includes(activity)) fail('REFUND_POLICY_INVALID', 'Activité invalide.', 422);
  if (typeof ownerConsentRequired !== 'boolean') fail('REFUND_POLICY_INVALID', 'ownerConsentRequired doit être explicite.', 422);
  if (standardApprovalMaxMinor != null && (!Number.isSafeInteger(standardApprovalMaxMinor) || standardApprovalMaxMinor <= 0)) {
    fail('REFUND_POLICY_INVALID', 'Le seuil doit être un montant entier strictement positif.', 422);
  }
  const signals = [...new Set(additionalDualApprovalSignals)];
  if (signals.some((signal) => !Object.values(C.REFUND_SIGNALS).includes(signal))) fail('REFUND_POLICY_INVALID', 'Signal de risque inconnu.', 422);
  const scope = { scopeType: authority.plane === 'PLATFORM' ? C.MANDATARY_TYPES.PLATFORM : C.MANDATARY_TYPES.TENANT, tenant: authority.tenantId || null, activity };
  const last = await FinancialRefundPolicy.findOne(scope).sort({ version: -1 }).lean();
  return FinancialRefundPolicy.create({
    ...scope, version: (last?.version || 0) + 1, status: C.REFUND_POLICY_STATUSES.UNCONFIGURED, currency,
    standardApprovalMaxMinor, additionalDualApprovalSignals: signals, ownerConsentRequired, decisionReference, createdBy: authority.userId,
  });
}

async function activateRefundPolicy({ actor, policyId }) {
  const policy = mongoose.isValidObjectId(policyId) ? await FinancialRefundPolicy.findById(policyId) : null;
  const authority = await authz.authorizeOnResource(actor, CAP.REFUND_POLICY_MANAGE, policy, { mandataryType: policy?.scopeType });
  if (policy.status !== C.REFUND_POLICY_STATUSES.UNCONFIGURED) fail('REFUND_POLICY_INVALID_TRANSITION', 'Seule une politique en brouillon peut être activée.', 409);
  if (policy.standardApprovalMaxMinor == null) fail('REFUND_POLICY_THRESHOLD_NOT_VALIDATED', 'Aucun seuil validé : la politique reste non configurée.', 409);
  if (!String(policy.decisionReference || '').trim()) fail('REFUND_POLICY_DECISION_REQUIRED', 'La référence de la décision validant le seuil est requise.', 422);
  await assertDistinctHumans({ activateur: authority.userId, rédacteur: policy.createdBy });
  return runFinancialOperation({ operationName: 'refund.policy.activate', transactionMode: 'transactional' }, async ({ session }) => {
    await FinancialRefundPolicy.updateMany(
      { scopeType: policy.scopeType, tenant: policy.tenant, activity: policy.activity, status: C.REFUND_POLICY_STATUSES.ACTIVE },
      { $set: { status: C.REFUND_POLICY_STATUSES.RETIRED, retiredBy: authority.userId, retiredAt: new Date() } }, { session },
    );
    const activated = await FinancialRefundPolicy.findOneAndUpdate(
      { _id: policy._id, status: C.REFUND_POLICY_STATUSES.UNCONFIGURED },
      { $set: { status: C.REFUND_POLICY_STATUSES.ACTIVE, activatedBy: authority.userId, activatedAt: new Date() } }, { new: true, session },
    );
    if (!activated) fail('REFUND_POLICY_INVALID_TRANSITION', 'La politique a changé entre-temps.', 409);
    return activated;
  });
}

async function resolvePolicySnapshot({ tenantId, activity, currency }) {
  const policy = await FinancialRefundPolicy.findOne({ scopeType: C.MANDATARY_TYPES.TENANT, tenant: tenantId, activity, status: C.REFUND_POLICY_STATUSES.ACTIVE }).lean();
  if (!policy) return unconfiguredSnapshot(activity, currency);
  if (policy.currency !== currency) fail('FINANCIAL_CURRENCY_MISMATCH', 'Devise de la politique différente de celle du paiement.', 409);
  return Object.freeze({
    policyId: policy._id, version: policy.version, status: policy.status, activity, currency: policy.currency,
    standardApprovalMaxMinor: policy.standardApprovalMaxMinor, additionalDualApprovalSignals: policy.additionalDualApprovalSignals || [],
    ownerConsentRequired: policy.ownerConsentRequired,
  });
}

// Classification pure : les signaux déclarés par l'initiateur ne peuvent
// qu'aggraver la classification, jamais l'alléger.
function classifyRefund({ policySnapshot, amountMinor, beneficiarySameAsPayer, priorRefundCount = 0, declaredSignals = [] }) {
  const signals = new Set();
  declaredSignals.forEach((signal) => {
    if (!Object.values(C.REFUND_SIGNALS).includes(signal)) fail('REFUND_SIGNAL_INVALID', 'Signal de risque inconnu.', 422);
    signals.add(signal);
  });
  if (policySnapshot.status !== C.REFUND_POLICY_STATUSES.ACTIVE || policySnapshot.standardApprovalMaxMinor == null) signals.add(C.REFUND_SIGNALS.POLICY_UNCONFIGURED);
  else if (amountMinor > policySnapshot.standardApprovalMaxMinor) signals.add(C.REFUND_SIGNALS.AMOUNT_ABOVE_THRESHOLD);
  if (!beneficiarySameAsPayer) signals.add(C.REFUND_SIGNALS.BENEFICIARY_DIFFERS_FROM_PAYER);
  if (priorRefundCount > 0) signals.add(C.REFUND_SIGNALS.REPEATED_REFUNDS);
  const list = [...signals];
  const dualSignals = new Set([...C.ALWAYS_DUAL_APPROVAL_SIGNALS, ...(policySnapshot.additionalDualApprovalSignals || [])]);
  let classification = C.REFUND_CLASSIFICATIONS.STANDARD;
  if (list.some((signal) => C.BLOCKING_REFUND_SIGNALS.includes(signal))) classification = C.REFUND_CLASSIFICATIONS.BLOCKED;
  else if (list.some((signal) => dualSignals.has(signal))) classification = C.REFUND_CLASSIFICATIONS.DUAL_APPROVAL;
  return { signals: list, classification, requiredApprovals: classification === C.REFUND_CLASSIFICATIONS.STANDARD ? 1 : 2 };
}

// ─── Demande ────────────────────────────────────────────────────────────

const governedResource = (refundOrPayment) => ({ mandataryType: refundOrPayment?.tenant ? C.MANDATARY_TYPES.TENANT : null });

async function loadPaymentForRefund(financialPaymentId) {
  const payment = mongoose.isValidObjectId(financialPaymentId) ? await FinancialPayment.findById(financialPaymentId).lean() : null;
  if (!payment) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Paiement inaccessible.', 404);
  return payment;
}

async function sumConsumingRefunds(paymentId, session) {
  const rows = await FinancialRefund.aggregate([
    { $match: { financialPayment: paymentId, status: { $in: REFUND_CONSUMING_STATUSES } } },
    { $group: { _id: null, amount: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
  ]).session(session || null);
  return { amount: rows[0]?.amount || 0, count: rows[0]?.count || 0 };
}

async function refundableBalance(paymentId, { session } = {}) {
  const payment = await FinancialPayment.findById(paymentId).session(session || null).lean();
  const consumed = await sumConsumingRefunds(payment._id, session);
  return { payment, consumedMinor: consumed.amount, priorRefundCount: consumed.count, refundableMinor: Math.max(0, payment.amountMinor - consumed.amount) };
}

async function requestGovernedRefund({ actor, financialPaymentId, amountMinor, activity, reasonCode, reason, beneficiary = { sameAsPayer: true }, declaredSignals = [], idempotencyKey }) {
  const payment = await loadPaymentForRefund(financialPaymentId);
  if (!payment.tenant) {
    // Un paiement sans tenant n'est pas pour autant un paiement plateforme :
    // le périmètre doit être explicite avant toute gouvernance.
    fail('REFUND_SCOPE_UNRESOLVED', 'Périmètre du paiement non résolu : rattachement explicite requis.', 409);
  }
  const authority = await authz.authorizeOnResource(actor, CAP.REFUND_PREPARE, payment, governedResource(payment));
  if (!idempotencyKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  if (!Object.values(C.REFUND_ACTIVITIES).includes(activity)) fail('REFUND_ACTIVITY_INVALID', 'Activité invalide.', 422);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant invalide.', 422);
  if (!String(reason || '').trim()) fail('REFUND_REASON_REQUIRED', 'Le motif est requis.', 422);
  if (!['succeeded', 'partially_refunded'].includes(payment.status)) fail('REFUND_PAYMENT_NOT_REFUNDABLE', 'Seul un paiement confirmé est remboursable.', 409);
  const businessOperationKey = `governed-refund:${payment._id}:${idempotencyKey}`;
  const existing = await FinancialRefund.findOne({ domain: payment.domain, establishmentId: payment.establishmentId, businessOperationKey });
  if (existing) {
    if (existing.amountMinor !== amountMinor) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre contenu.', 409);
    return { refund: existing, replayed: true };
  }

  const sameAsPayer = beneficiary?.sameAsPayer !== false;
  let beneficiaryId = null;
  if (!sameAsPayer) {
    const record = mongoose.isValidObjectId(beneficiary?.beneficiaryId) ? await FinancialBeneficiary.findById(beneficiary.beneficiaryId).lean() : null;
    if (!record || idOf(record.tenant) !== idOf(payment.tenant)) fail('BENEFICIARY_SCOPE_MISMATCH', 'Bénéficiaire inaccessible.', 404);
    beneficiaryId = record._id;
  }
  const allocation = await PaymentAllocation.findOne({ financialPayment: payment._id, status: 'active' }).lean();
  const documentId = allocation?.financialDocument || payment.metadata?.financialDocumentId;
  const document = documentId ? await FinancialDocument.findById(documentId).lean() : null;
  if (!document || idOf(document.tenant) !== idOf(payment.tenant)) fail('REFUND_DOCUMENT_REQUIRED', 'Le paiement doit être rattaché à un document financier.', 409);

  const policySnapshot = await resolvePolicySnapshot({ tenantId: payment.tenant, activity, currency: payment.currency });
  let ownerConsent = { isRequired: false, owner: null, status: 'not_required' };
  if (policySnapshot.ownerConsentRequired) {
    const collection = await MandateCollection.findOne({ financialPayment: payment._id }).select('owner mandate').lean();
    if (!collection) fail('REFUND_OWNER_CONSENT_UNRESOLVED', 'Accord du propriétaire requis mais propriétaire non identifiable.', 409);
    ownerConsent = { isRequired: true, owner: collection.owner, mandate: collection.mandate, status: 'pending' };
  }
  const lockKey = `refund:payment:${payment._id}`;
  await counters.ensureCounters([{ key: lockKey, scopeType: 'REFUND_PAYMENT' }]);

  return runFinancialOperation({ operationName: 'refund.governed.request', transactionMode: 'transactional' }, async ({ session }) => {
    await counters.lock({ key: lockKey, session });
    const balance = await refundableBalance(payment._id, { session });
    if (amountMinor > balance.refundableMinor) fail('REFUND_EXCEEDS_REFUNDABLE', 'Montant supérieur au solde encore remboursable.', 409);
    const { signals, classification, requiredApprovals } = classifyRefund({
      policySnapshot, amountMinor, beneficiarySameAsPayer: sameAsPayer, priorRefundCount: balance.priorRefundCount, declaredSignals,
    });
    const status = classification === C.REFUND_CLASSIFICATIONS.BLOCKED ? 'blocked' : 'pending_approval';
    const [refund] = await FinancialRefund.create([{
      tenant: payment.tenant, domain: payment.domain, establishmentType: payment.establishmentType, establishmentId: payment.establishmentId,
      financialPayment: payment._id, financialDocument: document._id,
      subjectType: payment.subjectType || document.subjectType, subjectId: payment.subjectId || document.subjectId,
      amountMinor, currency: payment.currency, status, reasonCode: reasonCode || 'OTHER', reason: String(reason).trim(),
      provider: payment.provider || 'manual', providerRefundSupported: supportsRefund(payment.provider || 'manual'),
      requestedBy: authority.userId, businessOperationKey,
      governance: {
        activity, authorityPlane: authority.plane, policy: policySnapshot.policyId, policySnapshot, classification, signals,
        requiredApprovals, approvers: [], approvalCount: 0, approvalRound: 1,
        beneficiary: { sameAsPayer, beneficiaryId }, ownerConsent, executionEnabled: false,
        ...(status === 'blocked' ? { blockedBy: authority.userId, blockedAt: new Date() } : {}),
      },
    }], { session });
    await appendFinancialLedgerEntry({
      eventType: 'refund.governed.requested', domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId,
      entityType: 'FinancialRefund', entityId: refund._id, relatedEntities: [{ entityType: 'FinancialPayment', entityId: payment._id }],
      actorType: 'user', actorId: authority.userId, amountMinor: -amountMinor, currency: refund.currency,
      businessOperationKey: `${businessOperationKey}:ledger`, newState: { status, classification, signals, requiredApprovals },
    }, { session });
    return { refund, replayed: false };
  });
}

// ─── Décisions ──────────────────────────────────────────────────────────

async function loadGovernedRefund(refundId) {
  const refund = mongoose.isValidObjectId(refundId) ? await FinancialRefund.findById(refundId) : null;
  if (!refund?.governance) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Remboursement gouverné inaccessible.', 404);
  return refund;
}

function refundLedger(session, refund, { eventType, actorId, key, previousState, newState }) {
  return appendFinancialLedgerEntry({
    eventType, domain: refund.domain, establishmentType: refund.establishmentType, establishmentId: refund.establishmentId,
    entityType: 'FinancialRefund', entityId: refund._id, actorType: 'user', actorId, amountMinor: -refund.amountMinor,
    currency: refund.currency, businessOperationKey: key, previousState, newState,
  }, { session });
}

const consentSatisfied = (governance) => !governance.ownerConsent?.isRequired || governance.ownerConsent.status === 'given';

async function promoteIfComplete(refundId, session) {
  return FinancialRefund.findOneAndUpdate(
    {
      _id: refundId, status: 'pending_approval',
      $expr: { $gte: ['$governance.approvalCount', '$governance.requiredApprovals'] },
      $or: [{ 'governance.ownerConsent.isRequired': { $ne: true } }, { 'governance.ownerConsent.status': 'given' }],
    },
    { $set: { status: 'approved', approvedAt: new Date() } },
    { new: true, session },
  );
}

async function decideGovernedRefund({ actor, refundId, decision, comment }) {
  const refund = await loadGovernedRefund(refundId);
  const authority = await authz.authorizeOnResource(actor, CAP.FINANCIAL_APPROVE, refund, governedResource(refund));
  if (!['approve', 'refuse'].includes(decision)) fail('REFUND_DECISION_INVALID', 'Décision invalide.', 422);
  if (refund.status !== 'pending_approval') fail('FINANCIAL_REFUND_INVALID_TRANSITION', `Remboursement non décidable (${refund.status}).`, 409);
  if (String(refund.requestedBy) === String(authority.userId)) fail('REFUND_SELF_APPROVAL_FORBIDDEN', 'L’initiateur ne peut pas décider de sa propre demande.', 403);
  const round = refund.governance.approvalRound;
  if ((refund.governance.approvers || []).some((approver) => String(approver) === String(authority.userId))) {
    fail('REFUND_DUPLICATE_APPROVER', 'Cette personne a déjà approuvé ce remboursement.', 409);
  }
  // Identité humaine réelle : un second compte de l'initiateur ou d'un
  // approbateur précédent est refusé.
  await assertDistinctHumans({
    initiateur: refund.requestedBy, approbateur: [authority.userId, ...(refund.governance.approvers || [])],
    'consentement propriétaire': refund.governance.ownerConsent?.decidedBy,
  });
  return runFinancialOperation({ operationName: 'refund.governed.decide', transactionMode: 'transactional' }, async ({ session }) => {
    try {
      await FinancialRefundApproval.create([{
        refund: refund._id, approver: authority.userId, round, decision: decision === 'approve' ? 'approved' : 'refused',
        authorityPlane: authority.plane, comment, decidedAt: new Date(),
      }], { session });
    } catch (error) {
      if (error?.code === 11000) fail('REFUND_DUPLICATE_APPROVER', 'Cette personne a déjà décidé dans ce tour de validation.', 409);
      throw error;
    }
    if (decision === 'refuse') {
      const refused = await FinancialRefund.findOneAndUpdate(
        { _id: refund._id, status: 'pending_approval' },
        { $set: { status: 'refused', 'governance.refusedBy': authority.userId, 'governance.refusedAt': new Date() } }, { new: true, session },
      );
      if (!refused) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Le remboursement a changé entre-temps.', 409);
      await refundLedger(session, refused, { eventType: 'refund.governed.refused', actorId: authority.userId, key: `governed-refund:${refund._id}:refused`, previousState: { status: 'pending_approval' }, newState: { status: 'refused' } });
      return refused;
    }
    const counted = await FinancialRefund.findOneAndUpdate(
      { _id: refund._id, status: 'pending_approval', 'governance.approvalRound': round, 'governance.approvers': { $ne: authority.userId } },
      { $push: { 'governance.approvers': authority.userId }, $inc: { 'governance.approvalCount': 1 } }, { new: true, session },
    );
    if (!counted) fail('REFUND_DUPLICATE_APPROVER', 'Approbation déjà comptabilisée ou remboursement modifié.', 409);
    await refundLedger(session, counted, { eventType: 'refund.governed.approval_recorded', actorId: authority.userId, key: `governed-refund:${refund._id}:round${round}:approval:${authority.userId}`, newState: { approvalCount: counted.governance.approvalCount, requiredApprovals: counted.governance.requiredApprovals } });
    const promoted = await promoteIfComplete(refund._id, session);
    if (promoted) {
      await refundLedger(session, promoted, { eventType: 'refund.governed.approved', actorId: authority.userId, key: `governed-refund:${refund._id}:approved:round${round}`, previousState: { status: 'pending_approval' }, newState: { status: 'approved' } });
      return promoted;
    }
    return counted;
  });
}

// Consentement du propriétaire (ou de son représentant habilité, pouvoir
// REFUND_CONSENT) : autorité fondée sur le mandat lié au paiement, jamais
// remplaçable par une capacité staff ou plateforme.
async function recordOwnerRefundConsent({ actor, refundId, decision }) {
  const refund = await loadGovernedRefund(refundId);
  const consent = refund.governance.ownerConsent;
  if (!consent?.isRequired || consent.status !== 'pending') fail('REFUND_OWNER_CONSENT_NOT_PENDING', 'Aucun accord propriétaire attendu.', 409);
  const mandate = await ManagementMandate.findById(consent.mandate).lean();
  if (!mandate || String(mandate.owner) !== String(consent.owner)) fail('REFUND_OWNER_CONSENT_UNRESOLVED', 'Mandat du propriétaire introuvable.', 409);
  const owner = await resolveOwnerAuthority({ actor, mandate, power: C.OWNER_POWERS.REFUND_CONSENT });
  if (!['give', 'refuse'].includes(decision)) fail('REFUND_DECISION_INVALID', 'Décision invalide.', 422);
  await assertDistinctHumans({ initiateur: refund.requestedBy, approbateur: refund.governance.approvers || [], 'consentement propriétaire': owner.actorId });
  return runFinancialOperation({ operationName: 'refund.governed.owner_consent', transactionMode: 'transactional' }, async ({ session }) => {
    const common = { 'governance.ownerConsent.decidedAt': new Date(), 'governance.ownerConsent.decidedBy': owner.actorId, 'governance.ownerConsent.representation': owner.representation };
    const update = decision === 'give'
      ? { $set: { ...common, 'governance.ownerConsent.status': 'given' } }
      : { $set: { ...common, 'governance.ownerConsent.status': 'refused', status: 'refused', 'governance.refusedBy': owner.actorId, 'governance.refusedAt': new Date() } };
    const updated = await FinancialRefund.findOneAndUpdate({ _id: refund._id, 'governance.ownerConsent.status': 'pending', status: { $in: ['pending_approval', 'blocked'] } }, update, { new: true, session });
    if (!updated) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Le remboursement a changé entre-temps.', 409);
    await refundLedger(session, updated, { eventType: `refund.governed.owner_consent_${decision === 'give' ? 'given' : 'refused'}`, actorId: owner.actorId, key: `governed-refund:${refund._id}:owner_consent`, newState: { ownerConsent: updated.governance.ownerConsent.status, principal: owner.principal } });
    return (decision === 'give' && await promoteIfComplete(refund._id, session)) || updated;
  });
}

// Revérification complète avant la mise en attente d'exécution : chaque
// approbateur doit encore détenir la capacité, dans le même tenant.
async function releaseForExecution({ actor, refundId }) {
  const refund = await loadGovernedRefund(refundId);
  const authority = await authz.authorizeOnResource(actor, CAP.FINANCIAL_APPROVE, refund, governedResource(refund));
  if (refund.status !== 'approved') fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Seul un remboursement approuvé peut être mis en attente d’exécution.', 409);
  const { governance } = refund;
  if (!consentSatisfied(governance)) fail('REFUND_OWNER_CONSENT_REQUIRED', 'Accord du propriétaire requis.', 409);
  const approvals = await FinancialRefundApproval.find({ refund: refund._id, round: governance.approvalRound, decision: 'approved' }).lean();
  const approvers = new Set(approvals.map((item) => String(item.approver)));
  if (approvers.size < governance.requiredApprovals || approvers.has(String(refund.requestedBy))) fail('REFUND_APPROVALS_INVALID', 'Approbations insuffisantes ou irrégulières.', 409);
  await assertDistinctHumans({ initiateur: refund.requestedBy, approbateur: [...approvers] });
  for (const approverId of approvers) {
    const current = await authz.resolveContractualAuthority({ _id: approverId, platformTenant: refund.tenant });
    if (!current.capabilities.has(CAP.FINANCIAL_APPROVE)) fail('REFUND_APPROVER_NO_LONGER_AUTHORIZED', 'Un approbateur n’est plus habilité : nouvelle validation requise.', 409);
  }
  if (!governance.beneficiary.sameAsPayer) {
    const beneficiary = await FinancialBeneficiary.findById(governance.beneficiary.beneficiaryId).lean();
    if (beneficiary?.status !== C.BENEFICIARY_STATUSES.VERIFIED) fail('BENEFICIARY_NOT_VERIFIED', 'Le bénéficiaire du remboursement doit être vérifié.', 409);
  }
  return runFinancialOperation({ operationName: 'refund.governed.release', transactionMode: 'transactional' }, async ({ session }) => {
    const lockKey = `refund:payment:${refund.financialPayment}`;
    await counters.lock({ key: lockKey, session });
    const payment = await FinancialPayment.findById(refund.financialPayment).session(session).lean();
    const consumed = await sumConsumingRefunds(payment._id, session);
    if (consumed.amount > payment.amountMinor) fail('REFUND_EXCEEDS_REFUNDABLE', 'Le solde remboursable a été dépassé.', 409);
    const released = await FinancialRefund.findOneAndUpdate(
      { _id: refund._id, status: 'approved' },
      { $set: { status: 'awaiting_execution', 'governance.releasedForExecutionBy': authority.userId, 'governance.releasedForExecutionAt': new Date() } }, { new: true, session },
    );
    if (!released) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Le remboursement a changé entre-temps.', 409);
    await refundLedger(session, released, { eventType: 'refund.governed.awaiting_execution', actorId: authority.userId, key: `governed-refund:${refund._id}:release`, previousState: { status: 'approved' }, newState: { status: 'awaiting_execution', executionEnabled: false } });
    return released;
  });
}

async function flagRefundRisk({ actor, refundId, signal, reason }) {
  const refund = await loadGovernedRefund(refundId);
  const authority = await authz.authorizeOnResource(actor, CAP.REFUND_PREPARE, refund, governedResource(refund));
  if (!C.BLOCKING_REFUND_SIGNALS.includes(signal)) fail('REFUND_SIGNAL_INVALID', 'Seuls les signaux bloquants suspendent un remboursement.', 422);
  if (!String(reason || '').trim()) fail('REFUND_REASON_REQUIRED', 'Le motif est requis.', 422);
  const blocked = await FinancialRefund.findOneAndUpdate(
    { _id: refund._id, status: { $in: OPEN_GOVERNED_STATUSES } },
    { $set: { status: 'blocked', 'governance.classification': C.REFUND_CLASSIFICATIONS.BLOCKED, 'governance.blockedBy': authority.userId, 'governance.blockedAt': new Date(), comment: reason }, $addToSet: { 'governance.signals': signal } },
    { new: true },
  );
  if (!blocked) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Remboursement non bloquable dans son état actuel.', 409);
  await refundLedger(null, blocked, { eventType: 'refund.governed.blocked', actorId: authority.userId, key: `governed-refund:${refund._id}:blocked:${Date.now()}`, previousState: { status: refund.status }, newState: { status: 'blocked', signal } });
  return blocked;
}

// Résolution d'un blocage par une personne distincte de l'initiateur et de
// celle qui a bloqué. Levée → nouveau tour de DOUBLE validation complet.
async function resolveBlockedRefund({ actor, refundId, resolution, reason }) {
  const refund = await loadGovernedRefund(refundId);
  const authority = await authz.authorizeOnResource(actor, CAP.REFUND_POLICY_MANAGE, refund, governedResource(refund));
  if (refund.status !== 'blocked') fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Le remboursement n’est pas bloqué.', 409);
  if (!String(reason || '').trim()) fail('REFUND_REASON_REQUIRED', 'Le motif est requis.', 422);
  await assertDistinctHumans({ 'levée du blocage': authority.userId, initiateur: refund.requestedBy, 'auteur du blocage': refund.governance.blockedBy }, { actor: 'levée du blocage' });
  if (!['clear', 'refuse'].includes(resolution)) fail('REFUND_DECISION_INVALID', 'Résolution invalide.', 422);
  const update = resolution === 'clear'
    ? {
      $set: {
        status: 'pending_approval', 'governance.classification': C.REFUND_CLASSIFICATIONS.DUAL_APPROVAL, 'governance.requiredApprovals': 2,
        'governance.approvers': [], 'governance.approvalCount': 0, 'governance.unblockedBy': authority.userId, 'governance.unblockedAt': new Date(), comment: reason,
      },
      $inc: { 'governance.approvalRound': 1 },
      $pullAll: { 'governance.signals': C.BLOCKING_REFUND_SIGNALS },
    }
    : { $set: { status: 'refused', 'governance.refusedBy': authority.userId, 'governance.refusedAt': new Date(), comment: reason } };
  const updated = await FinancialRefund.findOneAndUpdate({ _id: refund._id, status: 'blocked' }, update, { new: true });
  if (!updated) fail('FINANCIAL_REFUND_INVALID_TRANSITION', 'Le remboursement a changé entre-temps.', 409);
  if (resolution === 'clear') {
    await FinancialRefund.updateOne({ _id: refund._id }, { $addToSet: { 'governance.signals': C.REFUND_SIGNALS.MANUAL_OVERRIDE } });
  }
  await refundLedger(null, updated, { eventType: `refund.governed.block_${resolution === 'clear' ? 'cleared' : 'refused'}`, actorId: authority.userId, key: `governed-refund:${refund._id}:resolve:${updated.governance.approvalRound}`, previousState: { status: 'blocked' }, newState: { status: updated.status } });
  return FinancialRefund.findById(refund._id);
}

// Lecture d'un remboursement gouverné dans le périmètre de l'acteur.
async function getGovernedRefund({ actor, refundId }) {
  const refund = await loadGovernedRefund(refundId);
  await authz.authorizeOnResource(actor, CAP.CONTRACT_READ, refund, governedResource(refund));
  const approvals = await FinancialRefundApproval.find({ refund: refund._id }).sort({ decidedAt: 1 }).lean();
  return { refund: refund.toObject(), approvals };
}

// Aucun remboursement réel n'est exécuté en F-U1.
function executeGovernedRefund() {
  fail('REFUND_EXECUTION_NOT_ENABLED', 'Aucune exécution réelle de remboursement n’est activée (F-U1).', 501);
}

module.exports = {
  draftRefundPolicy, activateRefundPolicy, resolvePolicySnapshot, classifyRefund, refundableBalance,
  requestGovernedRefund, decideGovernedRefund, recordOwnerRefundConsent, releaseForExecution,
  flagRefundRisk, resolveBlockedRefund, executeGovernedRefund, getGovernedRefund, REFUND_CONSUMING_STATUSES,
};
