// F-U2.6 / F-U2.7 — Opérations et lectures sur les documents de facturation.
//
// Autorité : périmètre figé dans le document (`metadata.scope`), jamais
// déduit d'un tenant absent. Lecture : capacité `contractual.read` dans le
// périmètre, ou partie concernée (propriétaire bénéficiaire, client).
// Émission : `contractual.billing.issue`. Avoir : habilitation sensible
// `contractual.financial.approve`, par une personne distincte de l'émetteur
// de la facture.

const mongoose = require('mongoose');
const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialDocumentLine = require('../../../models/FinancialDocumentLine');
const MandateCollection = require('../../../models/MandateCollection');
const C = require('../../../constants/contractualFinanceConstants');
const { BILLING_KINDS } = require('../../../constants/billingConstants');
const { fail } = require('../financialError');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { assertDistinctHumans } = require('../contractual/humanIdentityService');
const billing = require('./billingDocumentService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const BILLING_KIND_VALUES = Object.values(BILLING_KINDS);
const notFound = () => fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Document inaccessible.', 404);

async function loadBillingDocument(documentId) {
  const document = mongoose.isValidObjectId(documentId) ? await FinancialDocument.findById(documentId) : null;
  if (!document || !BILLING_KIND_VALUES.includes(document.metadata?.billingKind) || !document.metadata?.scope) notFound();
  return document;
}

const scopeResource = (document) => ({ mandataryType: document.metadata.scope.mandataryType, tenant: document.metadata.scope.tenant || null });

function isConcernedParty(document, actorId) {
  const parties = document.metadata?.parties || {};
  return [parties.economicBeneficiary?.userId, parties.serviceProvider?.userId, document.customer?.userId].some((id) => id && String(id) === actorId);
}

async function getBillingDocument({ actor, documentId }) {
  const document = await loadBillingDocument(documentId);
  if (!isConcernedParty(document, idOf(actor))) await authz.authorizeOnResource(actor, CAP.CONTRACT_READ, scopeResource(document));
  const lines = await FinancialDocumentLine.find({ financialDocument: document._id }).sort('lineNumber').lean();
  return billing.serializeBillingDocument(document, { lines });
}

async function issueDocument({ actor, documentId }) {
  const document = await loadBillingDocument(documentId);
  const authority = await authz.authorizeOnResource(actor, CAP.BILLING_ISSUE, scopeResource(document));
  // F-U2.11 — une échéance de suivi n'est jamais une facture ; un prorata de
  // février (règle déduite) n'est pas émis tant qu'il n'est pas validé.
  if (document.metadata?.trackingObligation) fail('RENT_TRACKING_OBLIGATION_NOT_ISSUABLE', 'Échéance de suivi : aucune facture légale ne peut être émise sans émetteur habilité.', 409);
  if (document.metadata?.proration?.ruleStatus === 'DERIVED') fail('RENT_PRORATA_RULE_NOT_VALIDATED_FOR_ISSUE', 'Prorata de février (règle déduite) : émission soumise à validation contractuelle.', 409);
  return billing.serializeBillingDocument(await billing.issueBillingDocument({ documentId: document._id, actorId: authority.userId }));
}

async function cancelDraft({ actor, documentId, reason }) {
  const document = await loadBillingDocument(documentId);
  const authority = await authz.authorizeOnResource(actor, CAP.BILLING_MANAGE, scopeResource(document));
  return billing.serializeBillingDocument(await billing.cancelBillingDraft({ documentId: document._id, actorId: authority.userId, reason }));
}

async function creditDocument({ actor, documentId, amountMinor, reason, idempotencyKey }) {
  const document = await loadBillingDocument(documentId);
  const authority = await authz.authorizeOnResource(actor, CAP.FINANCIAL_APPROVE, scopeResource(document));
  await assertDistinctHumans({ approbateur: authority.userId, 'émetteur de la facture': document.issuedBy }, { actor: 'approbateur' });
  const result = await billing.issueCreditNote({ documentId: document._id, amountMinor, reason, actorId: authority.userId, idempotencyKey });
  return { creditNote: billing.serializeBillingDocument(result.creditNote), invoice: billing.serializeBillingDocument(result.invoice), replayed: result.replayed };
}

function summarize(documents) {
  const invoices = documents.filter((doc) => doc.documentType === 'invoice' && doc.status !== 'cancelled');
  const sum = (list, field) => list.reduce((total, doc) => total + (Number(doc[field]) || 0), 0);
  const byKind = (kind) => invoices.filter((doc) => doc.metadata?.billingKind === kind);
  const issued = invoices.filter((doc) => doc.status !== 'draft');
  const overdue = issued.filter((doc) => billing.lifecycleOf(doc) === 'overdue');
  return {
    rentExpectedMinor: sum(byKind(BILLING_KINDS.RENT), 'totalMinor'),
    rentPaidAllocatedMinor: sum(byKind(BILLING_KINDS.RENT), 'amountAllocatedMinor'),
    commissionsInvoicedMinor: sum(byKind(BILLING_KINDS.MANAGEMENT_COMMISSION).filter((doc) => doc.status !== 'draft'), 'totalMinor'),
    subscriptionsInvoicedMinor: sum(byKind(BILLING_KINDS.SUBSCRIPTION).filter((doc) => doc.status !== 'draft'), 'totalMinor'),
    autonomousInvoicedMinor: sum(byKind(BILLING_KINDS.AUTONOMOUS_SUBSCRIPTION).filter((doc) => doc.status !== 'draft'), 'totalMinor'),
    unpaidMinor: sum(issued, 'balanceMinor'),
    overdueMinor: sum(overdue, 'balanceMinor'),
    overdueCount: overdue.length,
    documentCount: documents.length,
  };
}

const present = (documents) => ({ summary: summarize(documents), documents: documents.slice(0, 200).map((doc) => billing.serializeBillingDocument(doc)) });
const kindFilter = { 'metadata.billingKind': { $in: BILLING_KIND_VALUES } };

// Propriétaire (relation directe, sans organisation requise).
async function ownerDashboard({ actor }) {
  const userId = idOf(actor);
  if (!userId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const ownerId = new mongoose.Types.ObjectId(userId);
  const documents = await FinancialDocument.find({
    ...kindFilter, status: { $ne: 'cancelled' },
    $or: [{ 'metadata.parties.economicBeneficiary.userId': ownerId }, { 'customer.userId': ownerId }],
  }).sort({ createdAt: -1 }).lean();
  // Loyers effectivement encaissés et confirmés / rapprochés (constatations F-U1).
  const collections = await MandateCollection.find({ owner: ownerId, status: { $in: [C.COLLECTION_RECORD_STATUSES.CONFIRMED, C.COLLECTION_RECORD_STATUSES.RECONCILED] } }).select('grossAmountMinor breakdown.commissionMinor').lean();
  const result = present(documents);
  result.summary.rentCollectedConfirmedMinor = collections.reduce((total, item) => total + item.grossAmountMinor, 0);
  result.summary.commissionsAcquiredMinor = collections.reduce((total, item) => total + (item.breakdown?.commissionMinor || 0), 0);
  return result;
}

// Organisation (contexte TENANT) ou Altitude Vision (contexte PLATFORM) ;
// contexte non résolu : refus.
async function administrationDashboard({ actor }) {
  const authority = await authz.assertContractualCapability(actor, CAP.CONTRACT_READ);
  const filter = authority.plane === 'TENANT'
    ? { ...kindFilter, 'metadata.scope.mandataryType': 'TENANT', 'metadata.scope.tenant': new mongoose.Types.ObjectId(String(authority.tenantId)) }
    : { ...kindFilter, 'metadata.scope.mandataryType': 'PLATFORM' };
  const documents = await FinancialDocument.find(filter).sort({ createdAt: -1 }).lean();
  return { plane: authority.plane, ...present(documents) };
}

module.exports = { getBillingDocument, issueDocument, cancelDraft, creditDocument, ownerDashboard, administrationDashboard, summarize };
