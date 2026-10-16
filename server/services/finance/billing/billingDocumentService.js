// F-U2.5 / F-U2.6 — Documents de facturation unifiés, sur le noyau existant.
//
// Réutilise FinancialDocument / FinancialDocumentLine / FinancialSequence /
// FinancialLedgerEntry / calculateDocumentTotals / runFinancialOperation.
// Le brouillon EST l'obligation : sa `businessOperationKey` (unique par
// domaine) interdit toute double génération pour une même source et période.
//
// Émission : identité légale vérifiée obligatoire, snapshot `seller` +
// `metadata.issuer` figés, numérotation continue PAR ÉMETTEUR LÉGAL (série
// FinancialSequence domaine `billing`, établissement `LegalIssuer`).
// Après émission, aucune modification libre : correction par avoir
// uniquement, dans la limite du solde non réglé (un remboursement relèverait
// d'un autre circuit).

const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialDocumentLine = require('../../../models/FinancialDocumentLine');
const { fail } = require('../financialError');
const { calculateDocumentTotals } = require('../financialDocumentService');
const { getNextFinancialDocumentNumber } = require('../financialSequenceService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { runFinancialOperation } = require('../financialTransactionService');
const { assertAmountMinor } = require('../moneyService');
const { resolveIssuer } = require('./billingIssuerService');
const { BILLING_KINDS } = require('../../../constants/billingConstants');

const inSession = (query, session) => (session ? query.session(session) : query);
const DAY = 86400000;

function ledger(session, document, { eventType, actorId, key, previousState, newState, amountMinor = document.totalMinor, metadata }) {
  return appendFinancialLedgerEntry({
    eventType, domain: document.domain, establishmentType: document.establishmentType, establishmentId: document.establishmentId,
    entityType: 'FinancialDocument', entityId: document._id, relatedEntities: [{ entityType: document.subjectType, entityId: document.subjectId }],
    actorType: 'user', actorId, amountMinor, currency: document.currency, businessOperationKey: key, previousState, newState, metadata,
  }, { session });
}

// Création idempotente d'un brouillon. `lines` : { lineType, description,
// quantity, unitAmountMinor, sourceType, sourceId, serviceDate? }.
async function createBillingDraft({ draft, lines, actorId, session = null }) {
  const existing = await inSession(FinancialDocument.findOne({ domain: draft.domain, businessOperationKey: draft.businessOperationKey }), session);
  if (existing) return { document: existing, created: false };
  const calculated = calculateDocumentTotals(lines);
  let document;
  try {
    [document] = await FinancialDocument.create([{
      ...draft, documentType: draft.documentType || 'invoice', status: 'draft', paymentStatus: 'unpaid',
      ...calculated.totals, balanceMinor: calculated.totals.totalMinor, createdBy: actorId, updatedBy: actorId,
      metadata: { ...(draft.metadata || {}), linesFinalized: true },
    }], { session });
  } catch (error) {
    if (error?.code === 11000) return { document: await inSession(FinancialDocument.findOne({ domain: draft.domain, businessOperationKey: draft.businessOperationKey }), session), created: false };
    throw error;
  }
  await FinancialDocumentLine.insertMany(calculated.lines.map((line, index) => ({ ...line, financialDocument: document._id, lineNumber: index + 1, createdBy: actorId })), { session });
  await ledger(session, document, { eventType: 'financial_document.draft_created', actorId, key: `${draft.businessOperationKey}:draft`, newState: { status: 'draft', billingKind: draft.metadata?.billingKind } });
  return { document, created: true };
}

async function issueBillingDocumentCore({ documentId, actorId, session, now = new Date() }) {
  const document = await inSession(FinancialDocument.findById(documentId), session);
  if (!document) fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Document introuvable.', 404);
  if (document.status === 'issued') return document;
  if (document.status !== 'draft') fail('FINANCIAL_INVALID_TRANSITION', `Émission impossible depuis « ${document.status} ».`, 409);
  const issuer = await resolveIssuer(document.metadata?.issuerPlan);
  const lines = await inSession(FinancialDocumentLine.find({ financialDocument: documentId }), session);
  const { totals } = calculateDocumentTotals(lines.map((line) => line.toObject()));
  if (Object.entries(totals).some(([key, value]) => Number(document[key]) !== value)) fail('FINANCIAL_DOCUMENT_TOTAL_MISMATCH', 'Les totaux du document sont incohérents.', 409);
  const year = now.getUTCFullYear();
  const next = await getNextFinancialDocumentNumber({
    domain: 'billing', establishmentType: 'LegalIssuer', establishmentId: issuer.sequenceAnchor,
    documentType: document.documentType, year, establishmentCode: String(issuer.sequenceAnchor).slice(-6), session,
  });
  const issued = await FinancialDocument.findOneAndUpdate(
    { _id: documentId, status: 'draft' },
    {
      $set: {
        status: 'issued', documentNumber: next.formattedNumber, sequenceValue: next.sequenceValue, sequenceYear: year,
        issueDate: now, issuedAt: now, issuedBy: actorId, updatedBy: actorId, seller: issuer.seller,
        'metadata.issuer': { identityId: issuer.identityId, version: issuer.version, scope: issuer.scope, tenant: issuer.tenant, snapshotAt: now },
      },
    },
    { new: true, session },
  );
  if (!issued) fail('FINANCIAL_DOCUMENT_STATE_CHANGED', 'Le document a changé pendant l’émission.', 409);
  await ledger(session, issued, { eventType: 'financial_document.issued', actorId, key: `document:${issued._id}:issued`, previousState: { status: 'draft' }, newState: { status: 'issued', documentNumber: issued.documentNumber, issuerIdentityVersion: issuer.version } });
  return issued;
}

const issueBillingDocument = ({ documentId, actorId, now }) => runFinancialOperation(
  { operationName: 'billing.document.issue', transactionMode: 'transactional' },
  ({ session }) => issueBillingDocumentCore({ documentId, actorId, session, now }),
);

async function cancelBillingDraft({ documentId, actorId, reason }) {
  if (!String(reason || '').trim()) fail('BILLING_REASON_REQUIRED', 'Motif requis.', 422);
  const cancelled = await FinancialDocument.findOneAndUpdate(
    // F-U2.11 — une échéance de suivi portant des paiements n'est pas annulable.
    { _id: documentId, status: 'draft', amountAllocatedMinor: { $in: [0, null] } },
    { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: actorId, cancellationReason: reason } },
    { new: true },
  );
  if (!cancelled) fail('FINANCIAL_DOCUMENT_IMMUTABLE', 'Seul un brouillon peut être annulé ; un document émis se corrige par avoir.', 409);
  await ledger(null, cancelled, { eventType: 'financial_document.cancelled', actorId, key: `document:${cancelled._id}:cancelled`, previousState: { status: 'draft' }, newState: { status: 'cancelled', reason } });
  return cancelled;
}

// Avoir : correction d'un document émis, dans la limite du solde NON réglé.
async function issueCreditNote({ documentId, amountMinor, reason, actorId, idempotencyKey, now = new Date() }) {
  if (!String(reason || '').trim()) fail('BILLING_REASON_REQUIRED', 'Motif de l’avoir requis.', 422);
  if (!idempotencyKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  assertAmountMinor(amountMinor);
  if (amountMinor <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant d’avoir invalide.', 422);
  const original = await FinancialDocument.findById(documentId);
  if (!original || original.documentType !== 'invoice') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Facture introuvable.', 404);
  const key = `credit-note:${original._id}:${idempotencyKey}`;
  const replay = await FinancialDocument.findOne({ domain: original.domain, businessOperationKey: key });
  if (replay) {
    if (replay.totalMinor !== amountMinor) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre montant.', 409);
    return { creditNote: replay, invoice: original, replayed: true };
  }
  if (original.status !== 'issued') fail('FINANCIAL_INVALID_TRANSITION', 'Seule une facture émise peut faire l’objet d’un avoir.', 409);
  if (amountMinor > original.balanceMinor) fail('BILLING_CREDIT_EXCEEDS_UNPAID_BALANCE', 'L’avoir dépasse le solde non réglé : un remboursement relèverait d’un autre circuit.', 409);
  return runFinancialOperation({ operationName: 'billing.credit_note', transactionMode: 'transactional' }, async ({ session }) => {
    const { document: draft } = await createBillingDraft({
      session, actorId,
      draft: {
        tenant: original.tenant, domain: original.domain, establishmentType: original.establishmentType, establishmentId: original.establishmentId,
        documentType: 'credit_note', currency: original.currency, subjectType: 'FinancialDocument', subjectId: original._id,
        customer: original.customer?.toObject ? original.customer.toObject() : original.customer, businessOperationKey: key,
        metadata: { billingKind: BILLING_KINDS.CREDIT_NOTE, scope: original.metadata?.scope, creditsDocument: original._id, creditsDocumentNumber: original.documentNumber, reason, issuerPlan: original.metadata?.issuerPlan, parties: original.metadata?.parties },
      },
      lines: [{ lineType: 'adjustment', description: `Avoir sur facture ${original.documentNumber} — ${reason}`, quantity: 1, unitAmountMinor: amountMinor, sourceType: 'FinancialDocument', sourceId: original._id }],
    });
    const creditNote = await issueBillingDocumentCore({ documentId: draft._id, actorId, session, now });
    const creditedBefore = Number(original.metadata?.creditedMinor || 0);
    const credited = creditedBefore + amountMinor;
    const fullyCredited = credited === original.totalMinor;
    const updated = await FinancialDocument.findOneAndUpdate(
      { _id: original._id, status: 'issued', balanceMinor: { $gte: amountMinor } },
      {
        $inc: { balanceMinor: -amountMinor },
        $set: { 'metadata.creditedMinor': credited, ...(fullyCredited ? { status: 'credited' } : {}), updatedBy: actorId },
        $push: { 'metadata.creditNotes': { documentId: creditNote._id, documentNumber: creditNote.documentNumber, amountMinor, at: now } },
      },
      { new: true, session },
    );
    if (!updated) fail('FINANCIAL_DOCUMENT_STATE_CHANGED', 'La facture a changé pendant l’établissement de l’avoir.', 409);
    const netDue = updated.totalMinor - credited;
    const allocated = updated.amountAllocatedMinor || 0;
    updated.paymentStatus = allocated <= 0 ? 'unpaid' : allocated < netDue ? 'partially_paid' : 'paid';
    await updated.save({ session });
    await ledger(session, updated, { eventType: 'financial_document.credited', actorId, key: `${key}:applied`, amountMinor: -amountMinor, previousState: { balanceMinor: original.balanceMinor }, newState: { balanceMinor: updated.balanceMinor, status: updated.status, creditNote: creditNote.documentNumber } });
    return { creditNote, invoice: updated, replayed: false };
  });
}

// Statut de présentation dérivé (jamais stocké : pas de valeur périmée).
function lifecycleOf(document, now = new Date()) {
  if (document.status === 'draft') return 'draft';
  if (document.status === 'cancelled') return 'cancelled';
  if (document.status === 'credited') return 'credited';
  if (document.documentType === 'credit_note') return 'issued';
  if (document.balanceMinor <= 0) return 'paid';
  if (document.dueDate && new Date(document.dueDate) < now) return 'overdue';
  return document.amountAllocatedMinor > 0 ? 'partially_paid' : 'issued';
}

function serializeBillingDocument(document, { lines } = {}) {
  const d = document.toObject ? document.toObject() : document;
  return {
    id: d._id, documentType: d.documentType, documentNumber: d.documentNumber, status: d.status, lifecycle: lifecycleOf(d),
    billingKind: d.metadata?.billingKind || null, domain: d.domain, currency: d.currency,
    period: d.metadata?.period || null, servicePeriodStart: d.servicePeriodStart, servicePeriodEnd: d.servicePeriodEnd,
    issueDate: d.issueDate, dueDate: d.dueDate, totalMinor: d.totalMinor, amountAllocatedMinor: d.amountAllocatedMinor,
    creditedMinor: d.metadata?.creditedMinor || 0, balanceMinor: d.balanceMinor, paymentStatus: d.paymentStatus,
    customer: d.customer ? { name: d.customer.name } : null, seller: d.status === 'draft' ? null : d.seller,
    parties: d.metadata?.parties || null, issuer: d.metadata?.issuer ? { scope: d.metadata.issuer.scope, version: d.metadata.issuer.version } : null,
    ...(lines ? { lines: lines.map((line) => ({ lineType: line.lineType, description: line.description, quantity: line.quantity, unitAmountMinor: line.unitAmountMinor, totalMinor: line.totalMinor })) } : {}),
  };
}

module.exports = {
  createBillingDraft, issueBillingDocument, issueBillingDocumentCore, cancelBillingDraft, issueCreditNote,
  lifecycleOf, serializeBillingDocument, DAY,
};
