// F-U2 — Surface HTTP v1 de la facturation unifiée. Acteur reconstruit
// depuis l'identité authentifiée et le contexte serveur ; corps filtrés par
// liste blanche ; aucun champ d'autorité (tenant, rôle, émetteur) lu du client.
const { fail } = require('../services/finance/financialError');
const operations = require('../services/finance/billing/billingOperationsService');
const rent = require('../services/finance/billing/rentBillingService');
const commission = require('../services/finance/billing/commissionBillingService');
const subscription = require('../services/finance/billing/subscriptionBillingService');
const autonomous = require('../services/finance/billing/autonomousBillingService');
const rentCollection = require('../services/finance/billing/rentCollectionService');
const ownerTracking = require('../services/finance/billing/ownerRentTrackingService');
const directReceipts = require('../services/finance/billing/directRentReceiptService');
const leasePolicies = require('../services/finance/billing/leasePolicyService');
const { issuerReadiness } = require('../services/finance/billing/billingIssuerService');
const { serializeBillingDocument } = require('../services/finance/billing/billingDocumentService');
const authz = require('../services/finance/contractual/contractualFinanceAuthorizationService');

const actorOf = (req) => ({ _id: req.user?._id, role: req.user?.role, platformTenant: req.platformTenant || null, tenantContextSource: req.tenantContextSource || null });
const handle = (fn, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ status: 'success', data: await fn(req) }); } catch (error) { next(error); }
};
const created = ({ document, created: isNew }) => ({ document: serializeBillingDocument(document), created: isNew });

exports.ownerDashboard = handle((req) => operations.ownerDashboard({ actor: actorOf(req) }));
exports.administrationDashboard = handle((req) => operations.administrationDashboard({ actor: actorOf(req) }));
exports.getDocument = handle((req) => operations.getBillingDocument({ actor: actorOf(req), documentId: req.params.documentId }));
exports.generateRentInvoice = handle(async (req) => created(await rent.generateRentInvoice({ actor: actorOf(req), leaseId: req.body?.leaseId, period: req.body?.period, prorataClauseReference: req.body?.prorataClauseReference })), 201);
exports.generateCommissionInvoice = handle(async (req) => created(await commission.generateCommissionInvoice({ actor: actorOf(req), mandateId: req.body?.mandateId })), 201);
exports.generateSubscriptionInvoice = handle(async (req) => created(await subscription.generateSubscriptionInvoice({ actor: actorOf(req), subscriptionType: req.body?.subscriptionType, subscriptionId: req.body?.subscriptionId, period: req.body?.period })), 201);
exports.issueDocument = handle((req) => operations.issueDocument({ actor: actorOf(req), documentId: req.params.documentId }));
exports.cancelDraft = handle((req) => operations.cancelDraft({ actor: actorOf(req), documentId: req.params.documentId, reason: req.body?.reason }));
exports.creditDocument = handle((req) => {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'En-tête Idempotency-Key obligatoire.', 422);
  return operations.creditDocument({ actor: actorOf(req), documentId: req.params.documentId, amountMinor: req.body?.amountMinor, reason: req.body?.reason, idempotencyKey: key });
}, 201);
// Préparation de l'émission : l'émetteur du contexte courant dispose-t-il
// d'une identité légale vérifiée ? (aucune donnée légale renvoyée au-delà du nom)
exports.issuerReadiness = handle(async (req) => {
  const authority = await authz.assertContractualCapability(actorOf(req), authz.CONTRACTUAL_CAPABILITIES.CONTRACT_READ);
  return issuerReadiness(authority.plane === 'PLATFORM' ? { role: 'PLATFORM' } : { role: 'TENANT', tenantId: authority.tenantId });
});

// F-U2.9 — Gestion autonome Altimmo : grille publique, synthèse du titulaire,
// facture mensuelle (abonnement + 1 %), devis Grand portefeuille.
exports.autonomousPricing = handle(async () => autonomous.publicPricing());
exports.autonomousSummary = handle((req) => autonomous.autonomousSummary({ actor: actorOf(req) }));
exports.generateAutonomousInvoice = handle(async (req) => created(await autonomous.generateAutonomousInvoice({ actor: actorOf(req), subscriptionType: req.body?.subscriptionType, subscriptionId: req.body?.subscriptionId, period: req.body?.period })), 201);
exports.preparePortfolioQuote = handle((req) => autonomous.prepareQuote({ actor: actorOf(req), subscriptionType: req.body?.subscriptionType, subscriptionId: req.body?.subscriptionId, monthlyPriceMinor: req.body?.monthlyPriceMinor, effectiveFrom: req.body?.effectiveFrom, decisionReference: req.body?.decisionReference }), 201);
exports.acceptPortfolioQuote = handle((req) => autonomous.decideQuote({ actor: actorOf(req), quoteId: req.params.quoteId, decision: 'accept' }));
exports.rejectPortfolioQuote = handle((req) => autonomous.decideQuote({ actor: actorOf(req), quoteId: req.params.quoteId, decision: 'reject' }));

// F-U2.10 — Recouvrement locatif : vue gestionnaire (périmètre résolu par le
// serveur), vue propriétaire (lecture seule), décisions sur signalement,
// envoi de mise en demeure (refusé tant que la validation juridique manque).
exports.collectionOverview = handle((req) => rentCollection.collectionOverview({ actor: actorOf(req) }));
exports.ownerCollection = handle((req) => rentCollection.ownerCollection({ actor: actorOf(req) }));
exports.decideDifficultyReport = handle((req) => rentCollection.decideDifficultyReport({ actor: actorOf(req), reportId: req.params.reportId, decision: req.body?.decision, reason: req.body?.reason, approvedPaymentDate: req.body?.approvedPaymentDate }));
exports.sendFormalNotice = handle((req) => rentCollection.sendFormalNotice({ actor: actorOf(req), caseId: req.params.caseId }));

// F-U2.11 — bailleur sans organisation : échéance de suivi (jamais émise) et
// enregistrement d'un loyer reçu directement (idempotent).
exports.generateOwnerTrackingDue = handle(async (req) => created(await ownerTracking.generateOwnerTrackingRentDue({ actor: actorOf(req), leaseId: req.body?.leaseId, period: req.body?.period, prorataClauseReference: req.body?.prorataClauseReference })), 201);
exports.recordOwnerRentReceipt = handle(async (req) => {
  const { payment, replayed } = await ownerTracking.recordOwnerRentReceipt({
    actor: actorOf(req), documentId: req.params.documentId, amountMinor: req.body?.amountMinor, receivedAt: req.body?.receivedAt, method: req.body?.method,
    reference: req.body?.reference, rentMinor: req.body?.rentMinor ?? null, evidence: req.body?.evidence || null, idempotencyKey: req.headers['idempotency-key'],
  });
  return { payment: { id: payment._id, amountMinor: payment.amountMinor, confirmedAt: payment.confirmedAt, method: payment.method }, replayed };
}, 201);

// F-U2.12 — décision de sortie de bail (dates distinctes, fondement du prorata).
exports.recordLeaseExit = handle((req) => rent.recordLeaseExit({
  actor: actorOf(req), leaseId: req.body?.leaseId, obligationEndDate: req.body?.obligationEndDate, prorataBasis: req.body?.prorataBasis, basisReference: req.body?.basisReference,
  physicalDepartureDate: req.body?.physicalDepartureDate, keysReturnedDate: req.body?.keysReturnedDate, contractualEndDate: req.body?.contractualEndDate, agreementEffectiveDate: req.body?.agreementEffectiveDate,
}), 201);

// F-U2.12 — circuit de preuve des encaissements directs.
exports.submitDirectReceiptEvidence = handle((req) => directReceipts.submitEvidence({ actor: actorOf(req), receiptId: req.params.receiptId, kind: req.body?.kind, reference: req.body?.reference }).then(directReceipts.publicReceipt));
exports.cancelDirectReceipt = handle((req) => directReceipts.cancelReceipt({ actor: actorOf(req), receiptId: req.params.receiptId, reason: req.body?.reason }).then(directReceipts.publicReceipt));
exports.reviewDirectReceipt = handle((req) => directReceipts.platformReview({ actor: actorOf(req), receiptId: req.params.receiptId, decision: req.body?.decision, note: req.body?.note }).then(directReceipts.publicReceipt));
exports.listDirectReceiptsForReview = handle((req) => directReceipts.listForPlatform({ actor: actorOf(req), status: req.query?.status || null }));

// F-U2.13 — politiques contractuelles versionnées des baux.
exports.createLeasePolicy = handle(async (req) => leasePolicies.publicPolicy(await leasePolicies.createPolicy({
  actor: actorOf(req), leaseId: req.body?.leaseId, type: req.body?.type, terms: req.body?.terms, effectiveFrom: req.body?.effectiveFrom,
  documentReference: req.body?.documentReference, ownerRecordedAcceptance: req.body?.ownerRecordedAcceptance || null,
})), 201);
exports.listLeasePolicies = handle((req) => leasePolicies.listLeasePolicies({ actor: actorOf(req), leaseId: req.params.leaseId }));
