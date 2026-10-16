// F-U1.C — Dépenses sous mandat : double plafond, autorisation du propriétaire,
// justification.
//
// Contrôle des plafonds (snapshot de la version du mandat en vigueur) :
//   - plafond par intervention : cumul de TOUTES les dépenses réservées sur le
//     même ticket d'intervention (anti-fractionnement) ;
//   - plafond mensuel cumulatif : cumul des dépenses réservées sur le bien et le
//     mois contractuel (fuseau WAT).
// Les deux réservations sont conditionnelles et atomiques, dans une même
// transaction : soit les deux passent, soit aucune n'est conservée et la
// dépense attend l'autorisation préalable du propriétaire.
//
// Seule une dépense justifiée est déductible ; l'assiette de la commission de
// 10 % n'est jamais réduite par les dépenses.
//
// F-U1.G : la décision appartient au propriétaire ou à son représentant
// habilité (ownerAuthorityService) ; un écrit n'a d'effet qu'après
// authentification par une personne habilitée distincte.

const crypto = require('crypto');
const mongoose = require('mongoose');
const MandateExpense = require('../../../models/MandateExpense');
const ExpenseAuthorization = require('../../../models/ExpenseAuthorization');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const RentalMaintenanceTicket = require('../../../models/RentalMaintenanceTicket');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { contractMonthKey } = require('./mandateTermsService');
const { assertMandateOperableAt } = require('./managementMandateService');
const { normalizeEvidence } = require('./financialBeneficiaryService');
const { accrueObligationLine } = require('./ownerFundsService');
const counters = require('./financialLimitCounterService');
const authz = require('./contractualFinanceAuthorizationService');
const { resolveOwnerAuthority, authorizeMandateRead } = require('./ownerAuthorityService');
const { assertDistinctHumans } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;
const S = C.EXPENSE_STATUSES;

const interventionKey = (expense) => `expense:intervention:${expense.mandate}:${expense.intervention}`;
const monthKeyOf = (expense) => `expense:month:${expense.mandate}:${expense.property}:${expense.monthKey}`;
const counterEntries = (expense) => [
  { key: interventionKey(expense), scopeType: 'EXPENSE_INTERVENTION' },
  { key: monthKeyOf(expense), scopeType: 'EXPENSE_MONTH' },
];
const hashPayload = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

function expenseLedger(session, expense, { eventType, actorId, amountMinor, key, previousState, newState, metadata }) {
  return appendFinancialLedgerEntry({
    eventType, domain: 'rental', establishmentType: 'Property', establishmentId: expense.property,
    entityType: 'MandateExpense', entityId: expense._id,
    relatedEntities: [{ entityType: 'ManagementMandate', entityId: expense.mandate }, { entityType: 'RentalMaintenanceTicket', entityId: expense.intervention }],
    actorType: 'user', actorId, amountMinor, currency: expense.currency, businessOperationKey: key, previousState, newState, metadata,
  }, { session });
}

async function loadExpense(expenseId) {
  const expense = mongoose.isValidObjectId(expenseId) ? await MandateExpense.findById(expenseId) : null;
  if (!expense) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Dépense inaccessible.', 404);
  return expense;
}

async function requestExpense({ actor, mandateId, interventionId, category, description, amountMinor, idempotencyKey, at = new Date() }) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  const authority = await authz.authorizeOnResource(actor, CAP.EXPENSE_REQUEST, mandate);
  if (!idempotencyKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant invalide.', 422);
  if (!String(category || '').trim() || !String(description || '').trim()) fail('EXPENSE_DETAILS_REQUIRED', 'Catégorie et description requises.', 422);
  const payloadHash = hashPayload({ interventionId: String(interventionId), category, description, amountMinor });
  const existing = await MandateExpense.findOne({ mandate: mandate._id, idempotencyKey }).select('+payloadHash');
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre contenu.', 409);
    return { expense: existing, replayed: true };
  }
  const { version, terms } = await assertMandateOperableAt(mandate, at);
  if (terms.offer !== C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) fail('MANDATE_OFFER_NO_EXPENSE_MANDATE', 'Une gestion autonome ne donne pas mandat de dépense.', 409);
  const ticket = mongoose.isValidObjectId(interventionId) ? await RentalMaintenanceTicket.findById(interventionId).select('property').lean() : null;
  if (!ticket || String(ticket.property) !== String(mandate.property)) fail('EXPENSE_INTERVENTION_MISMATCH', 'L’intervention doit concerner le bien sous mandat.', 422);

  const draft = {
    mandataryType: mandate.mandataryType, tenant: mandate.tenant || null, mandate: mandate._id, mandateVersion: version._id,
    termsHash: version.termsHash, capsSnapshot: terms.expenseCaps, property: mandate.property, owner: mandate.owner,
    intervention: ticket._id, category: String(category).trim(), description: String(description).trim(), currency: terms.currency,
    requestedAmountMinor: amountMinor, monthKey: contractMonthKey(at), requestedBy: authority.userId, idempotencyKey, payloadHash,
  };
  await counters.ensureCounters(counterEntries(draft));

  return runFinancialOperation({ operationName: 'mandate.expense.request', transactionMode: 'transactional' }, async ({ session }) => {
    const caps = terms.expenseCaps;
    const interventionBefore = await counters.readReserved(interventionKey(draft), session);
    const monthBefore = await counters.readReserved(monthKeyOf(draft), session);
    const breaches = [];
    const interventionOk = await counters.tryReserve({ key: interventionKey(draft), amountMinor, capMinor: caps.perInterventionMinor, session });
    if (!interventionOk) breaches.push(C.EXPENSE_CAP_BREACHES.PER_INTERVENTION);
    const monthOk = interventionOk
      ? await counters.tryReserve({ key: monthKeyOf(draft), amountMinor, capMinor: caps.monthlyCumulativeMinor, session })
      : null;
    if (interventionOk && !monthOk) {
      await counters.release({ key: interventionKey(draft), amountMinor, session });
      breaches.push(C.EXPENSE_CAP_BREACHES.MONTHLY);
    } else if (!interventionOk && monthBefore + amountMinor > caps.monthlyCumulativeMinor) {
      breaches.push(C.EXPENSE_CAP_BREACHES.MONTHLY);
    }
    const status = breaches.length ? S.PENDING_OWNER_AUTHORIZATION : S.COMMITTED;
    const [expense] = await MandateExpense.create([{
      ...draft, status, capBreaches: breaches, reservedAmountMinor: status === S.COMMITTED ? amountMinor : 0,
      capObservation: { interventionReservedBeforeMinor: interventionBefore, monthReservedBeforeMinor: monthBefore },
      history: [{ from: null, to: status, action: 'request', actor: authority.userId, amountMinor }],
    }], { session });
    await expenseLedger(session, expense, {
      eventType: status === S.COMMITTED ? 'mandate.expense.committed' : 'mandate.expense.owner_authorization_required',
      actorId: authority.userId, amountMinor, key: `mandate.expense.request:${expense._id}`, newState: { status, capBreaches: breaches },
      metadata: { termsHash: version.termsHash, caps },
    });
    return { expense, replayed: false };
  });
}

// Débloque une dépense en attente : réservation hors plafond, couverte par
// l'autorisation effective du propriétaire pour CETTE dépense uniquement.
async function applyOwnerApproval({ expense, authorizationDraft, actorId }) {
  await counters.ensureCounters(counterEntries(expense));
  return runFinancialOperation({ operationName: 'mandate.expense.authorize', transactionMode: 'transactional' }, async ({ session }) => {
    const [authorization] = await ExpenseAuthorization.create([authorizationDraft], { session });
    const updated = await MandateExpense.findOneAndUpdate(
      { _id: expense._id, status: S.PENDING_OWNER_AUTHORIZATION },
      {
        $set: { status: S.AUTHORIZED, authorization: authorization._id, reservedAmountMinor: expense.requestedAmountMinor },
        $push: { history: { from: S.PENDING_OWNER_AUTHORIZATION, to: S.AUTHORIZED, action: `owner_authorization:${authorizationDraft.mode}`, actor: actorId, amountMinor: expense.requestedAmountMinor } },
      },
      { new: true, session },
    );
    if (!updated) fail('EXPENSE_INVALID_TRANSITION', 'La dépense n’est plus en attente d’autorisation.', 409);
    await counters.forceReserve({ key: interventionKey(expense), amountMinor: expense.requestedAmountMinor, session });
    await counters.forceReserve({ key: monthKeyOf(expense), amountMinor: expense.requestedAmountMinor, session });
    await expenseLedger(session, updated, {
      eventType: 'mandate.expense.owner_authorized', actorId, amountMinor: expense.requestedAmountMinor,
      key: `mandate.expense.authorize:${expense._id}`, previousState: { status: S.PENDING_OWNER_AUTHORIZATION }, newState: { status: S.AUTHORIZED },
      metadata: { authorizationId: authorization._id, mode: authorizationDraft.mode },
    });
    return { expense: updated, authorization, unlocked: true };
  });
}

async function applyOwnerRefusal({ expense, authorizationDraft, actorId }) {
  return runFinancialOperation({ operationName: 'mandate.expense.refuse', transactionMode: 'transactional' }, async ({ session }) => {
    const [authorization] = await ExpenseAuthorization.create([authorizationDraft], { session });
    const updated = await MandateExpense.findOneAndUpdate(
      { _id: expense._id, status: S.PENDING_OWNER_AUTHORIZATION },
      { $set: { status: S.REFUSED, authorization: authorization._id }, $push: { history: { from: S.PENDING_OWNER_AUTHORIZATION, to: S.REFUSED, action: `owner_refusal:${authorizationDraft.mode}`, actor: actorId } } },
      { new: true, session },
    );
    if (!updated) fail('EXPENSE_INVALID_TRANSITION', 'La dépense n’est plus en attente d’autorisation.', 409);
    return { expense: updated, authorization, unlocked: false };
  });
}

function baseAuthorization(expense) {
  return {
    expense: expense._id, mandate: expense.mandate, property: expense.property, intervention: expense.intervention,
    owner: expense.owner, onBehalfOf: expense.owner, currency: expense.currency, decidedAt: new Date(),
  };
}

async function loadPendingWithMandate(expense) {
  if (expense.status !== S.PENDING_OWNER_AUTHORIZATION) fail('EXPENSE_INVALID_TRANSITION', 'La dépense n’est pas en attente d’autorisation.', 409);
  const mandate = await ManagementMandate.findById(expense.mandate).lean();
  await assertMandateOperableAt(mandate, new Date());
  return mandate;
}

// Mode A — le propriétaire (ou son représentant habilité) décide dans Altimmo.
// Aucune capacité staff ou plateforme ne permet d'emprunter ce chemin.
async function decideExpenseInApp({ actor, expenseId, decision, maxAmountMinor, comment }) {
  const expense = await loadExpense(expenseId);
  const mandate = await ManagementMandate.findById(expense.mandate).lean();
  const owner = await resolveOwnerAuthority({ actor, mandate, power: C.OWNER_POWERS.EXPENSE_DECISION });
  await loadPendingWithMandate(expense);
  await assertDistinctHumans({ demandeur: expense.requestedBy, décideur: owner.actorId });
  const draft = {
    ...baseAuthorization(expense), mode: C.EXPENSE_AUTHORIZATION_MODES.IN_APP, phase: 'DECISION',
    decidedBy: owner.actorId, representation: owner.representation, effective: true, comment,
  };
  if (decision === 'refuse') return applyOwnerRefusal({ expense, actorId: owner.actorId, authorizationDraft: { ...draft, decision: 'refused' } });
  if (decision !== 'approve') fail('EXPENSE_DECISION_INVALID', 'Décision invalide.', 422);
  if (!Number.isSafeInteger(maxAmountMinor) || maxAmountMinor < expense.requestedAmountMinor) {
    fail('EXPENSE_AUTHORIZATION_AMOUNT_INSUFFICIENT', 'Le montant maximal autorisé doit couvrir la dépense demandée.', 422);
  }
  return applyOwnerApproval({ expense, actorId: owner.actorId, authorizationDraft: { ...draft, decision: 'approved', maxAmountMinor } });
}

// Mode B, étape 1 — un agent du mandataire SOUMET l'écrit du propriétaire.
// Aucun effet : la dépense reste en attente.
async function submitWrittenAuthorization({ actor, expenseId, decision = 'approve', document, scope, maxAmountMinor, comment }) {
  const expense = await loadExpense(expenseId);
  const authority = await authz.authorizeOnResource(actor, CAP.EXPENSE_REQUEST, expense);
  const mandate = await loadPendingWithMandate(expense);
  if (!String(document?.documentRef || '').trim() || !String(document?.signatoryName || '').trim() || !document?.signedAt) {
    fail('WRITTEN_AUTHORIZATION_DOCUMENT_REQUIRED', 'Document signé, signataire et date requis.', 422);
  }
  const signedAt = new Date(document.signedAt);
  if (Number.isNaN(signedAt.getTime()) || signedAt > new Date()) fail('WRITTEN_AUTHORIZATION_DOCUMENT_REQUIRED', 'Date de signature invalide.', 422);
  if (!['approve', 'refuse'].includes(decision)) fail('EXPENSE_DECISION_INVALID', 'Décision invalide.', 422);
  const scopeMatches = String(scope?.mandateId) === String(expense.mandate)
    && String(scope?.propertyId) === String(expense.property)
    && String(scope?.interventionId) === String(expense.intervention);
  if (!scopeMatches) fail('WRITTEN_AUTHORIZATION_SCOPE_MISMATCH', 'L’écrit doit viser exactement ce mandat, ce bien et cette intervention.', 422);
  if (decision === 'approve' && (!Number.isSafeInteger(maxAmountMinor) || maxAmountMinor < expense.requestedAmountMinor)) {
    fail('EXPENSE_AUTHORIZATION_AMOUNT_INSUFFICIENT', 'Le montant maximal autorisé doit couvrir la dépense demandée.', 422);
  }
  let signatory = 'OWNER'; let signatoryRepresentation = null;
  if (document.signatoryRepresentationId) {
    // Écrit signé par un représentant : sa procuration doit couvrir ce pouvoir.
    const rep = await resolveOwnerAuthority({ actor: { _id: document.signatoryUserId }, mandate, power: C.OWNER_POWERS.EXPENSE_DECISION });
    if (rep.principal !== 'REPRESENTATIVE' || String(rep.representation) !== String(document.signatoryRepresentationId)) {
      fail('WRITTEN_AUTHORIZATION_SIGNATORY_INVALID', 'Le signataire n’est pas un représentant habilité pour cette dépense.', 403);
    }
    signatory = 'REPRESENTATIVE'; signatoryRepresentation = rep.representation;
  }
  return ExpenseAuthorization.create({
    ...baseAuthorization(expense), mode: C.EXPENSE_AUTHORIZATION_MODES.VERIFIED_WRITTEN, phase: 'WRITTEN_SUBMISSION',
    decision: decision === 'approve' ? 'approved' : 'refused', maxAmountMinor: Number.isSafeInteger(maxAmountMinor) ? maxAmountMinor : null,
    decidedBy: authority.userId, effective: false, comment,
    written: { documentRef: String(document.documentRef).trim(), sha256: document.sha256, signedAt, signatoryName: String(document.signatoryName).trim(), signatory, signatoryRepresentation },
  });
}

// Mode B, étape 2 — une personne titulaire de la capacité sensible
// WRITTEN_AUTHORIZATION_VERIFY, distincte du soumissionnaire, du demandeur
// de la dépense et du propriétaire, AUTHENTIFIE l'écrit. Seul `verified`
// débloque ; toute autre issue reste historisée sans effet.
async function authenticateWrittenAuthorization({ actor, submissionId, verification }) {
  const submission = mongoose.isValidObjectId(submissionId) ? await ExpenseAuthorization.findById(submissionId).lean() : null;
  if (!submission || submission.phase !== 'WRITTEN_SUBMISSION') fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Soumission inaccessible.', 404);
  const expense = await loadExpense(submission.expense);
  const authority = await authz.authorizeOnResource(actor, CAP.WRITTEN_AUTHORIZATION_VERIFY, expense);
  if (!C.WRITTEN_AUTHORIZATION_VERIFICATION_RESULTS.includes(verification?.result) || !String(verification?.method || '').trim()) {
    fail('WRITTEN_AUTHORIZATION_VERIFICATION_REQUIRED', 'Résultat et méthode de vérification requis.', 422);
  }
  await assertDistinctHumans({
    authentificateur: authority.userId, soumissionnaire: submission.decidedBy, demandeur: expense.requestedBy, propriétaire: expense.owner,
  }, { actor: 'authentificateur' });
  const pending = expense.status === S.PENDING_OWNER_AUTHORIZATION;
  const effective = verification.result === 'verified' && pending;
  const draft = {
    ...baseAuthorization(expense), mode: C.EXPENSE_AUTHORIZATION_MODES.VERIFIED_WRITTEN, phase: 'WRITTEN_AUTHENTICATION',
    submission: submission._id, decision: submission.decision, maxAmountMinor: submission.maxAmountMinor,
    representation: submission.written?.signatoryRepresentation || null, decidedBy: authority.userId, effective,
    written: { ...submission.written, verification: { result: verification.result, method: String(verification.method).trim(), notes: verification.notes, verifiedBy: authority.userId, verifiedAt: new Date() } },
  };
  if (!effective) {
    try {
      const authorization = await ExpenseAuthorization.create(draft);
      return { expense, authorization, unlocked: false, reason: pending ? 'WRITTEN_AUTHORIZATION_NOT_VERIFIED' : 'EXPENSE_NOT_PENDING' };
    } catch (error) {
      if (error?.code === 11000) fail('WRITTEN_AUTHORIZATION_ALREADY_AUTHENTICATED', 'Cet écrit a déjà été authentifié.', 409);
      throw error;
    }
  }
  await loadPendingWithMandate(expense);
  try {
    return submission.decision === 'approved'
      ? await applyOwnerApproval({ expense, authorizationDraft: draft, actorId: authority.userId })
      : await applyOwnerRefusal({ expense, authorizationDraft: draft, actorId: authority.userId });
  } catch (error) {
    if (error?.code === 'FINANCIAL_IDEMPOTENCY_CONFLICT' || error?.code === 11000) fail('WRITTEN_AUTHORIZATION_ALREADY_AUTHENTICATED', 'Cet écrit a déjà été authentifié.', 409);
    throw error;
  }
}

async function listExpensesForMandate({ actor, mandateId }) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  if (!mandate) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Mandat inaccessible.', 404);
  await authorizeMandateRead(actor, mandate);
  return MandateExpense.find({ mandate: mandate._id }).sort({ createdAt: -1 }).lean();
}

async function justifyExpense({ actor, expenseId, actualAmountMinor, evidence, at = new Date() }) {
  const expense = await loadExpense(expenseId);
  const authority = await authz.authorizeOnResource(actor, CAP.EXPENSE_JUSTIFY, expense);
  if (!C.RESERVED_EXPENSE_STATUSES.includes(expense.status)) fail('EXPENSE_INVALID_TRANSITION', 'Seule une dépense engagée ou autorisée peut être justifiée.', 409);
  if (!Number.isSafeInteger(actualAmountMinor) || actualAmountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant justifié invalide.', 422);
  if (actualAmountMinor > expense.reservedAmountMinor) fail('EXPENSE_ACTUAL_EXCEEDS_COMMITMENT', 'Le montant réel dépasse l’engagement : une nouvelle demande est requise.', 409);
  const proofs = normalizeEvidence(evidence, { required: true });
  const version = await ManagementMandateVersion.findById(expense.mandateVersion).lean();
  const mandate = await ManagementMandate.findById(expense.mandate).lean();
  const surplus = expense.reservedAmountMinor - actualAmountMinor;
  return runFinancialOperation({ operationName: 'mandate.expense.justify', transactionMode: 'transactional' }, async ({ session }) => {
    const updated = await MandateExpense.findOneAndUpdate(
      { _id: expense._id, status: expense.status },
      {
        $set: { status: S.JUSTIFIED, justifiedAmountMinor: actualAmountMinor, reservedAmountMinor: actualAmountMinor, justifiedBy: authority.userId, justifiedAt: at },
        $push: { evidence: { $each: proofs }, history: { from: expense.status, to: S.JUSTIFIED, action: 'justify', actor: authority.userId, amountMinor: actualAmountMinor } },
      },
      { new: true, session },
    );
    if (!updated) fail('EXPENSE_INVALID_TRANSITION', 'La dépense a changé entre-temps.', 409);
    if (surplus > 0) {
      await counters.release({ key: interventionKey(expense), amountMinor: surplus, session });
      await counters.release({ key: monthKeyOf(expense), amountMinor: surplus, session });
    }
    await expenseLedger(session, updated, {
      eventType: 'mandate.expense.justified', actorId: authority.userId, amountMinor: actualAmountMinor,
      key: `mandate.expense.justify:${expense._id}`, previousState: { status: expense.status }, newState: { status: S.JUSTIFIED },
    });
    const agency = version.terms.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION;
    const obligation = await accrueObligationLine({
      mandate, terms: version.terms, at, sourceKey: `expense:${expense._id}`, session,
      type: agency ? C.OBLIGATION_TYPES.OWNER_PAYOUT : C.OBLIGATION_TYPES.COMMISSION_RECEIVABLE,
      line: {
        key: `expense:${expense._id}`, sourceType: 'MandateExpense', sourceId: expense._id,
        kind: agency ? C.OBLIGATION_LINE_KINDS.EXPENSE_DEDUCTION : C.OBLIGATION_LINE_KINDS.EXPENSE_RECOVERABLE,
        amountMinor: agency ? -actualAmountMinor : actualAmountMinor,
      },
    });
    return { expense: updated, obligation };
  });
}

async function cancelExpense({ actor, expenseId, reason }) {
  const expense = await loadExpense(expenseId);
  const authority = await authz.authorizeOnResource(actor, CAP.EXPENSE_REQUEST, expense);
  if (!String(reason || '').trim()) fail('EXPENSE_REASON_REQUIRED', 'Un motif est requis.', 422);
  if (![S.PENDING_OWNER_AUTHORIZATION, S.COMMITTED, S.AUTHORIZED].includes(expense.status)) fail('EXPENSE_INVALID_TRANSITION', 'Dépense non annulable.', 409);
  return runFinancialOperation({ operationName: 'mandate.expense.cancel', transactionMode: 'transactional' }, async ({ session }) => {
    const updated = await MandateExpense.findOneAndUpdate(
      { _id: expense._id, status: expense.status },
      { $set: { status: S.CANCELLED, reservedAmountMinor: 0 }, $push: { history: { from: expense.status, to: S.CANCELLED, action: 'cancel', actor: authority.userId, comment: reason } } },
      { new: true, session },
    );
    if (!updated) fail('EXPENSE_INVALID_TRANSITION', 'La dépense a changé entre-temps.', 409);
    if (expense.reservedAmountMinor > 0) {
      await counters.release({ key: interventionKey(expense), amountMinor: expense.reservedAmountMinor, session });
      await counters.release({ key: monthKeyOf(expense), amountMinor: expense.reservedAmountMinor, session });
    }
    await expenseLedger(session, updated, {
      eventType: 'mandate.expense.cancelled', actorId: authority.userId, amountMinor: expense.reservedAmountMinor,
      key: `mandate.expense.cancel:${expense._id}`, previousState: { status: expense.status }, newState: { status: S.CANCELLED }, metadata: { reason },
    });
    return updated;
  });
}

module.exports = {
  requestExpense, decideExpenseInApp, submitWrittenAuthorization, authenticateWrittenAuthorization,
  justifyExpense, cancelExpense, listExpensesForMandate,
};
