// F-U2.2 — Facturation de la commission de gestion déléguée (10 %).
//
// La commission n'est JAMAIS tirée d'une facture de loyer émise : elle naît
// uniquement d'un encaissement constaté (F-U1) —
//   - AGENCY_COLLECTION : MandateCollection `confirmed` (FinancialPayment
//     confirmé), commission = 10 % du montant encaissé (paiement partiel →
//     commission proportionnelle) ;
//   - OWNER_DIRECT : MandateCollection `reconciled` uniquement (déclaration et
//     confirmation propriétaire exclues).
// Le montant facturé est celui figé dans la constatation (version du mandat
// applicable au paiement) ; les frais de transaction n'y sont jamais mêlés.
// Chaque constatation n'est facturée qu'une fois (contrôle sous verrou).
// Une gestion autonome ne produit aucune commission.

const crypto = require('crypto');
const mongoose = require('mongoose');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const MandateCollection = require('../../../models/MandateCollection');
const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialDocumentLine = require('../../../models/FinancialDocumentLine');
const User = require('../../../models/User');
const C = require('../../../constants/contractualFinanceConstants');
const { BILLING_KINDS } = require('../../../constants/billingConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const counters = require('../contractual/financialLimitCounterService');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { createBillingDraft } = require('./billingDocumentService');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;
const BILLABLE = Object.freeze([C.COLLECTION_RECORD_STATUSES.CONFIRMED, C.COLLECTION_RECORD_STATUSES.RECONCILED]);

async function invoicedCollectionIds(collectionIds, session) {
  const lines = await FinancialDocumentLine.find({ sourceType: 'MandateCollection', sourceId: { $in: collectionIds } }).select('sourceId financialDocument').session(session || null).lean();
  if (!lines.length) return new Set();
  const live = await FinancialDocument.find({ _id: { $in: lines.map((line) => line.financialDocument) }, status: { $ne: 'cancelled' } }).select('_id').session(session || null).lean();
  const liveIds = new Set(live.map((doc) => String(doc._id)));
  return new Set(lines.filter((line) => liveIds.has(String(line.financialDocument))).map((line) => String(line.sourceId)));
}

async function generateCommissionInvoice({ actor, mandateId }) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  const authority = await authz.authorizeOnResource(actor, CAP.BILLING_MANAGE, mandate);
  const current = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
  if (current?.terms?.offer !== C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    fail('MANDATE_OFFER_NO_DELEGATED_COMMISSION', 'Une gestion autonome par abonnement ne génère aucune commission de gestion.', 409);
  }
  const lockKey = `commission:${mandate._id}`;
  await counters.ensureCounters([{ key: lockKey, scopeType: 'BILLING_LOCK' }]);
  const owner = await User.findById(mandate.owner).select('name email phone').lean();

  return runFinancialOperation({ operationName: 'billing.commission.generate', transactionMode: 'transactional' }, async ({ session }) => {
    await counters.lock({ key: lockKey, session });
    const collections = await MandateCollection.find({ mandate: mandate._id, status: { $in: BILLABLE } }).sort({ paidAt: 1 }).session(session).lean();
    const already = await invoicedCollectionIds(collections.map((item) => item._id), session);
    const pending = collections.filter((item) => !already.has(String(item._id)) && Number(item.breakdown?.commissionMinor) > 0);
    if (!pending.length) fail('BILLING_NOTHING_TO_INVOICE', 'Aucune commission acquise non encore facturée.', 409);
    const runKey = crypto.createHash('sha256').update(pending.map((item) => String(item._id)).join(',')).digest('hex').slice(0, 24);
    return createBillingDraft({
      session, actorId: authority.userId,
      lines: pending.map((item) => ({
        lineType: 'commission', quantity: 1, unitAmountMinor: item.breakdown.commissionMinor, sourceType: 'MandateCollection', sourceId: item._id, serviceDate: item.paidAt,
        description: `Commission de gestion ${item.breakdown.commissionBasisPoints / 100} % — loyer ${String(item.rentPeriod.month).padStart(2, '0')}/${item.rentPeriod.year} (${item.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION ? 'encaissé par le mandataire' : 'payé au propriétaire, rapproché'})`,
      })),
      draft: {
        tenant: mandate.tenant || null, domain: 'rental', establishmentType: 'Property', establishmentId: mandate.property, currency: pending[0].currency,
        subjectType: 'ManagementMandate', subjectId: mandate._id, businessOperationKey: `commission:${mandate._id}:${runKey}`,
        customer: { name: owner?.name || 'Propriétaire', email: owner?.email, phone: owner?.phone, userId: mandate.owner },
        metadata: {
          billingKind: BILLING_KINDS.MANAGEMENT_COMMISSION, scope: { mandataryType: mandate.mandataryType, tenant: mandate.tenant || null },
          issuerPlan: { role: mandate.mandataryType, tenantId: mandate.tenant || null, onBehalfOfOwner: false },
          collections: pending.map((item) => ({ id: item._id, mode: item.collectionMode, termsHash: item.termsHash, grossAmountMinor: item.grossAmountMinor })),
          parties: {
            serviceProvider: { role: mandate.mandataryType, tenant: mandate.tenant || null },
            issuer: { role: mandate.mandataryType, tenant: mandate.tenant || null },
            collectionAgent: null,
            economicBeneficiary: { role: mandate.mandataryType, tenant: mandate.tenant || null },
            payer: { role: 'OWNER', userId: mandate.owner },
          },
        },
      },
    });
  });
}

module.exports = { generateCommissionInvoice, invoicedCollectionIds };
