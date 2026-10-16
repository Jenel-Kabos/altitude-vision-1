// F-U2.9 — Gestion locative autonome Altimmo : formules, frais de 1 %,
// facturation mensuelle. Extension de F-U2 : mêmes documents, numérotation,
// émetteur (Altitude Vision), ledger et transactions.
//
// Formule = nombre de biens gérés (politique validée). Comptage : politique
// PROPOSÉE (PROPERTY_COUNTING_POLICY) — les cas non décidés bloquent la
// facture fixe seulement s'ils peuvent changer la formule.
//
// Frais variables : 1 % de la part LOYER des allocations actives de paiements
// CONFIRMÉS sur des factures de loyer des biens du titulaire. Jamais sur un
// loyer attendu, facturé, déclaré ou en attente, jamais sur des frais de
// transaction. Biens en gestion déléguée (mandat actif à la date
// d'encaissement) : exclus — ils relèvent de la commission de 10 %.
// Chaque allocation ne produit qu'une ligne de frais (index unique durable).

const crypto = require('crypto');
const mongoose = require('mongoose');
const Property = require('../../../models/Property');
const RentalManagement = require('../../../models/RentalManagement');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const FinancialDocument = require('../../../models/FinancialDocument');
const FinancialPayment = require('../../../models/FinancialPayment');
const PaymentAllocation = require('../../../models/PaymentAllocation');
const SubscriptionTariff = require('../../../models/SubscriptionTariff');
const PlatformTenant = require('../../../models/PlatformTenant');
const User = require('../../../models/User');
const HumanIdentityAttestation = require('../../../models/HumanIdentityAttestation');
const IndividualSubscription = require('../../../models/IndividualSubscription');
const Accrual = require('../../../models/AutonomousVariableFeeAccrual');
const PortfolioQuote = require('../../../models/PortfolioQuote');
const DirectRentReceipt = require('../../../models/DirectRentReceipt');
const ClassificationSnapshot = require('../../../models/PortfolioClassificationSnapshot');
const C = require('../../../constants/contractualFinanceConstants');
const { BILLING_KINDS, ALTIMMO_AUTONOMOUS_PRICING: PRICING, PROPERTY_COUNTING_POLICY } = require('../../../constants/billingConstants');
const { fail } = require('../financialError');
const { percentageOfMinor } = require('../moneyService');
const { runFinancialOperation } = require('../financialTransactionService');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { createBillingDraft } = require('./billingDocumentService');
const { parsePeriod } = require('./rentBillingService');
const { allocationRentShares } = require('./rentImputationService');
const { delegatedCoverageAt } = require('./leasePolicyService');
const { assertPlatform, MODELS } = require('./subscriptionBillingService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const ACTIVATION_ACTIONS = ['rental_management_enabled', 'rental_management_onboarded'];
const DEACTIVATION_ACTIONS = ['rental_management_deactivated'];
const CONFIRMED_PAYMENT_STATUSES = ['succeeded', 'partially_refunded', 'refunded'];

// ─── Pur ──────────────────────────────────────────────────────────────

function classifyCount(count) {
  if (!Number.isSafeInteger(count) || count < 1) return null;
  return PRICING.formulas.find((formula) => count >= formula.minProperties && (formula.maxProperties == null || count <= formula.maxProperties)).code;
}

const variableFeeMinor = (baseMinor) => percentageOfMinor(baseMinor, PRICING.variableRateBasisPoints);
const formulaInfo = (code) => PRICING.formulas.find((formula) => formula.code === code) || null;

// ─── Titulaire ────────────────────────────────────────────────────────

async function loadSubscription(subscriptionType, subscriptionId) {
  const Model = MODELS[subscriptionType];
  if (!Model) fail('BILLING_SUBSCRIPTION_TYPE_INVALID', 'Type d’abonnement invalide.', 422);
  const subscription = mongoose.isValidObjectId(subscriptionId) ? await Model.findById(subscriptionId).lean() : null;
  if (!subscription) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Abonnement inaccessible.', 404);
  const holder = subscriptionType === 'PlatformTenantSubscription'
    ? { holderType: 'TENANT', holderId: subscription.tenant }
    : { holderType: 'USER', holderId: subscription.user };
  return { subscription, holder: { ...holder, subscriptionType, subscriptionId: subscription._id } };
}

const holderPropertyFilter = (holder) => (holder.holderType === 'TENANT'
  ? { tenant: holder.holderId }
  : { owner: holder.holderId, tenant: null });

// ─── Inventaire et classement ─────────────────────────────────────────

async function delegatedMandateFor(propertyId) {
  const mandate = await ManagementMandate.findOne({ property: propertyId, status: { $in: C.LIVE_MANDATE_STATUSES } }).lean();
  if (!mandate) return null;
  const version = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
  return version?.terms?.offer === C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT ? mandate : null;
}

async function inventoryPortfolio(holder, { period = null } = {}) {
  const properties = await Property.find(holderPropertyFilter(holder)).select('_id availability assetCycle assetCycleHistory').lean();
  // F-U2.13 — date de référence : début de la période facturée (ou maintenant).
  const ref = period ? period.start : new Date();
  const latestAt = (entries, predicate) => (entries || []).filter(predicate).map((entry) => new Date(entry.at)).sort((a, b) => b - a)[0] || null;
  const managements = await RentalManagement.find({ property: { $in: properties.map((p) => p._id) } }).lean();
  const byProperty = new Map(managements.map((rm) => [String(rm.property), rm]));
  const items = [];
  const changes = { addedInPeriod: 0, removedInPeriod: 0 };
  for (const property of properties) {
    const rm = byProperty.get(String(property._id));
    const mandate = await delegatedMandateFor(property._id);
    let category;
    if (mandate && mandate.status === C.MANDATE_STATUSES.ACTIVE) category = 'DELEGATED';
    else if (property.availability === 'Vendu' || ['vendu', 'archive'].includes(property.assetCycle)) {
      // Clôture DÉFINITIVE (vente, archivage) : exclue à partir de sa date
      // effective ; une clôture postérieure au début de période ne retire pas
      // le bien de cette période (obligation déjà née) ; date inconnue : à décider.
      const closedAt = latestAt(property.assetCycleHistory, (entry) => ['vendu', 'archive'].includes(entry.to));
      if (!closedAt) category = 'CLOSED';
      else category = closedAt <= ref ? 'CLOSED_EFFECTIVE' : 'ENDED_AFTER_PERIOD_START';
    } else if (rm && rm.active && rm.managementActivated !== false) category = (rm.activeLease || rm.occupancyStatus === 'occupe') ? 'MANAGED_OCCUPIED' : 'MANAGED_VACANT';
    else if (rm && (rm.workflowHistory || []).some((entry) => DEACTIVATION_ACTIONS.includes(entry.action))) {
      // Désactivation (non définitive) : plus « autonome activé » à partir de sa date.
      const deactivatedAt = latestAt(rm.workflowHistory, (entry) => DEACTIVATION_ACTIONS.includes(entry.action));
      category = deactivatedAt && deactivatedAt > ref ? 'ENDED_AFTER_PERIOD_START' : 'INACTIVE';
    } else category = 'LISTING_ONLY';
    items.push({ property: property._id, category });
    if (period && rm) {
      const inPeriod = (date) => date && new Date(date) >= period.start && new Date(date) < period.end;
      const activatedInPeriod = inPeriod(rm.createdAt) || (rm.workflowHistory || []).some((entry) => ACTIVATION_ACTIONS.includes(entry.action) && inPeriod(entry.at));
      const deactivatedInPeriod = (rm.workflowHistory || []).some((entry) => DEACTIVATION_ACTIONS.includes(entry.action) && inPeriod(entry.at));
      const countedCategory = ['MANAGED_OCCUPIED', 'MANAGED_VACANT', 'ENDED_AFTER_PERIOD_START'].includes(category);
      if (countedCategory && activatedInPeriod) changes.addedInPeriod += 1;
      if (!countedCategory && deactivatedInPeriod) changes.removedInPeriod += 1;
    }
    if (period && mandate && (mandate.statusHistory || []).some((entry) => new Date(entry.at) >= period.start && new Date(entry.at) < period.end)) changes.removedInPeriod += 1;
  }
  const counts = Object.fromEntries(Object.keys(PROPERTY_COUNTING_POLICY.categories).map((key) => [key, items.filter((item) => item.category === key).length]));
  return { items, counts, changes };
}

async function holderIdentityAmbiguity(holder) {
  if (holder.holderType !== 'USER') return false;
  const own = await HumanIdentityAttestation.findOne({ user: holder.holderId, status: { $in: ['verified', 'suspended'] } }).select('+identityKey +fingerprintKeyVersion').lean();
  if (!own) return false;
  const twins = await HumanIdentityAttestation.find({ identityKey: own.identityKey, fingerprintKeyVersion: own.fingerprintKeyVersion, status: { $in: ['verified', 'suspended'] }, user: { $ne: holder.holderId } }).select('user').lean();
  if (!twins.length) return false;
  return Boolean(await IndividualSubscription.exists({ user: { $in: twins.map((t) => t.user) } }));
}

async function classifyHolder(holder, { period = null, record = false } = {}) {
  const inventory = await inventoryPortfolio(holder, { period });
  const counted = inventory.counts.MANAGED_OCCUPIED + inventory.counts.MANAGED_VACANT + inventory.counts.ENDED_AFTER_PERIOD_START;
  const undecided = inventory.counts.CLOSED;
  const formula = classifyCount(counted);
  const reasons = [];
  if (undecided > 0 && classifyCount(counted + undecided) !== formula) reasons.push('COUNTING_RULE_UNDECIDED');
  if (period) {
    const atStart = counted - inventory.changes.addedInPeriod + inventory.changes.removedInPeriod;
    if (classifyCount(Math.max(0, atStart)) !== formula) reasons.push('FORMULA_CHANGED_DURING_PERIOD_PRORATA_UNDEFINED');
  }
  if (await holderIdentityAmbiguity(holder)) reasons.push('SAME_OWNER_MULTIPLE_ACCOUNTS');
  if (!formula) reasons.push('NO_MANAGED_PROPERTY');
  const result = { formula, counted, undecided, counts: inventory.counts, ambiguous: reasons.length > 0, reasons, countingPolicyStatus: PROPERTY_COUNTING_POLICY.status };
  if (record) await recordSnapshot(holder, result);
  return result;
}

async function recordSnapshot(holder, result) {
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([result.formula, result.counts, result.reasons])).digest('hex');
  const last = await ClassificationSnapshot.findOne({ holderType: holder.holderType, holderId: holder.holderId }).sort({ at: -1 }).lean();
  if (last?.fingerprint === fingerprint) return last;
  return ClassificationSnapshot.create({
    holderType: holder.holderType, holderId: holder.holderId, at: new Date(), counts: result.counts, formula: result.formula,
    ambiguous: result.ambiguous, fingerprint, pricingVersion: PRICING.version, countingPolicyStatus: PROPERTY_COUNTING_POLICY.status,
  });
}

// ─── Frais variables (1 %) ────────────────────────────────────────────


// Constate (idempotent) les frais de 1 % des encaissements confirmés d'une
// période, pour un titulaire. Écriture par upsert sur {allocation, kind} :
// des appels simultanés ne créent jamais deux lignes.
async function accrueVariableFees({ holder, period, now = new Date() }) {
  const properties = await Property.find(holderPropertyFilter(holder)).select('_id').lean();
  const propertyIds = properties.map((p) => p._id);
  // F-U2.12 — factures émises ET échéances de suivi des bailleurs sans
  // organisation (`tenant:null` n'exonère pas du 1 %).
  const rentDocs = await FinancialDocument.find({
    domain: 'rental', establishmentId: { $in: propertyIds }, 'metadata.billingKind': BILLING_KINDS.RENT,
    $or: [{ status: { $in: ['issued', 'credited'] } }, { status: 'draft', 'metadata.trackingObligation': true }],
  }).select('_id establishmentId subjectId subjectType metadata.period').lean();
  const docById = new Map(rentDocs.map((doc) => [String(doc._id), doc]));
  const allocations = await PaymentAllocation.find({ financialDocument: { $in: rentDocs.map((doc) => doc._id) } }).lean();
  const payments = await FinancialPayment.find({ _id: { $in: allocations.map((a) => a.financialPayment) } }).select('status confirmedAt refundedAmountMinor metadata').lean();
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));
  const receipts = await DirectRentReceipt.find({ payment: { $in: payments.map((p) => p._id) } }).lean();
  const receiptByPayment = new Map(receipts.map((r) => [String(r.payment), r]));
  const sharesByDoc = new Map();
  const shareOf = async (doc, allocationId) => {
    if (!sharesByDoc.has(String(doc._id))) sharesByDoc.set(String(doc._id), await allocationRentShares(doc));
    return sharesByDoc.get(String(doc._id)).shares.find((share) => String(share.allocation) === String(allocationId))?.rentMinor || 0;
  };
  const result = { accrued: 0, excludedDelegated: 0, notConfirmed: 0, unverifiedDirectReceipts: 0, reversals: 0 };
  for (const allocation of allocations) {
    const payment = paymentById.get(String(allocation.financialPayment));
    const doc = docById.get(String(allocation.financialDocument));
    if (!payment || !CONFIRMED_PAYMENT_STATUSES.includes(payment.status) || !payment.confirmedAt) { result.notConfirmed += 1; continue; }
    // F-U2.12 — encaissement direct déclaré par le bailleur : retenu seulement
    // après confirmation INDÉPENDANTE, à la date de cette confirmation.
    const declared = payment.metadata?.source === 'OWNER_DECLARED_RECEIPT';
    const receipt = declared ? receiptByPayment.get(String(payment._id)) : null;
    const receiptVoided = Boolean(receipt && ['CONTESTED', 'CANCELLED'].includes(receipt.status));
    if (declared && (!receipt || (receipt.status !== 'CONFIRMED' && !(receiptVoided && receipt.confirmation?.at)))) { result.unverifiedDirectReceipts += 1; continue; }
    const confirmedAt = new Date(declared ? receipt.confirmation.at : payment.confirmedAt);
    if (confirmedAt < period.start || confirmedAt >= period.end || confirmedAt > now) continue;
    const key = { allocation: allocation._id };
    const reversed = allocation.status === 'reversed' || Number(payment.refundedAmountMinor || 0) > 0 || receiptVoided;
    if (allocation.status !== 'reversed' && !receiptVoided) {
      // F-U2.13 — régime déterminé par la PÉRIODE du loyer encaissé (fondement
      // contractuel), via la même règle que la commission de 10 % : jamais les deux.
      const coverageAt = doc.metadata?.period ? parsePeriod(doc.metadata.period).start : confirmedAt;
      if ((await delegatedCoverageAt(doc.establishmentId, coverageAt)).mode === 'DELEGATED') {
        result.excludedDelegated += 1; continue; // Régime de gestion déléguée : jamais 1 % en plus.
      }
      const baseMinor = await shareOf(doc, allocation._id);
      const write = await Accrual.updateOne({ ...key, kind: 'FEE' }, {
        $setOnInsert: {
          ...key, kind: 'FEE', holderType: holder.holderType, holderId: holder.holderId, subscriptionType: holder.subscriptionType, subscriptionId: holder.subscriptionId,
          tenant: holder.holderType === 'TENANT' ? holder.holderId : null, property: doc.establishmentId, lease: doc.subjectId, payment: payment._id, rentDocument: doc._id,
          allocatedMinor: allocation.amountMinor, baseMinor, rateBasisPoints: PRICING.variableRateBasisPoints, feeMinor: variableFeeMinor(baseMinor),
          policyVersion: PRICING.version, confirmedAt, period: period.label, status: 'accrued',
        },
      }, { upsert: true });
      if (write.upsertedCount) result.accrued += 1;
    }
    if (reversed) {
      // Contrepassation : frais non facturés annulés ; frais déjà facturés →
      // ajustement tracé en attente de décision (aucun avoir automatique).
      const fee = await Accrual.findOne({ ...key, kind: 'FEE' }).lean();
      if (fee?.status === 'accrued') {
        await Accrual.updateOne({ _id: fee._id, status: 'accrued' }, { $set: { status: 'cancelled', reason: 'Encaissement contrepassé ou remboursé avant facturation' } });
        result.reversals += 1;
      } else if (fee?.status === 'invoiced') {
        const write = await Accrual.updateOne({ ...key, kind: 'REVERSAL' }, {
          $setOnInsert: {
            ...key, kind: 'REVERSAL', holderType: fee.holderType, holderId: fee.holderId, subscriptionType: fee.subscriptionType, subscriptionId: fee.subscriptionId,
            tenant: fee.tenant, property: fee.property, lease: fee.lease, payment: fee.payment, rentDocument: fee.rentDocument, allocatedMinor: fee.allocatedMinor,
            baseMinor: fee.baseMinor, rateBasisPoints: fee.rateBasisPoints, feeMinor: fee.feeMinor, policyVersion: fee.policyVersion, confirmedAt: fee.confirmedAt,
            period: fee.period, status: 'reversal_pending_decision', reason: 'Encaissement contrepassé ou remboursé après facturation : règle d’ajustement à décider',
          },
        }, { upsert: true });
        if (write.upsertedCount) result.reversals += 1;
      }
    }
  }
  return result;
}

// ─── Prix fixe ────────────────────────────────────────────────────────

async function fixedPriceFor({ holder, formula, at }) {
  if (formula === 'GRAND_PORTEFEUILLE') {
    const quote = await PortfolioQuote.findOne({ subscriptionType: holder.subscriptionType, subscriptionId: holder.subscriptionId, status: 'accepted', effectiveFrom: { $lte: at } }).sort({ effectiveFrom: -1 }).lean();
    if (!quote) fail('GRAND_PORTEFEUILLE_QUOTE_REQUIRED', 'Grand portefeuille : abonnement fixe sur devis accepté uniquement.', 409);
    return { monthlyPriceMinor: quote.monthlyPriceMinor, source: { type: 'PortfolioQuote', id: quote._id } };
  }
  const tariff = await SubscriptionTariff.findOne({ formula, status: 'active', effectiveFrom: { $lte: at } }).sort({ effectiveFrom: -1, version: -1 }).lean();
  if (!tariff) fail('SUBSCRIPTION_PRICE_NOT_CONFIGURED', `Aucun tarif activé pour la formule « ${formula} ».`, 409);
  if (tariff.monthlyPriceMinor !== formulaInfo(formula).monthlyPriceMinor || tariff.variableRateBasisPoints !== PRICING.variableRateBasisPoints) {
    fail('TARIFF_DIFFERS_FROM_VALIDATED_POLICY', 'Tarif actif incohérent avec la politique validée.', 409);
  }
  return { monthlyPriceMinor: tariff.monthlyPriceMinor, paymentTermDays: tariff.paymentTermDays, source: { type: 'SubscriptionTariff', id: tariff._id, version: tariff.version } };
}

// ─── Facture mensuelle ────────────────────────────────────────────────

async function generateAutonomousInvoice({ actor, subscriptionType, subscriptionId, period: periodLabel, now = new Date() }) {
  const authority = await assertPlatform(actor, CAP.BILLING_MANAGE);
  const { subscription, holder } = await loadSubscription(subscriptionType, subscriptionId);
  const period = parsePeriod(periodLabel);
  if (now < period.end) fail('BILLING_PERIOD_NOT_CLOSED', 'La période n’est pas terminée : encaissements du mois incomplets.', 409);
  if (subscription.status === 'trialing') fail('SUBSCRIPTION_TRIAL_BILLING_RULE_UNDEFINED', 'Facturation en période d’essai non définie.', 409);
  const end = subscription.cancelledAt || subscription.endDate;
  if (new Date(subscription.startDate) > period.start || (end && new Date(end) < new Date(period.end.getTime() - 86400000))) {
    fail('SUBSCRIPTION_PARTIAL_PERIOD_RULE_NOT_CONFIGURED', 'L’abonnement ne couvre pas tout le mois : règle de prorata non définie.', 409);
  }
  let customer; let tenant = null;
  if (holder.holderType === 'TENANT') {
    const org = await PlatformTenant.findById(holder.holderId).select('name status').lean();
    if (!org || ['suspended', 'archived'].includes(org.status)) fail('SUBSCRIPTION_BILLING_SUSPENDED', 'Organisation suspendue ou archivée.', 409);
    customer = { name: org.name }; tenant = org._id;
  } else {
    const user = await User.findById(holder.holderId).select('name email phone').lean();
    customer = { name: user?.name || 'Abonné', email: user?.email, phone: user?.phone, userId: holder.holderId };
  }
  const key = `autonomous:${subscriptionType}:${subscription._id}:${period.label}`;
  const existing = await FinancialDocument.findOne({ domain: 'billing', businessOperationKey: key });
  if (existing) return { document: existing, created: false };
  if (await FinancialDocument.exists({ domain: 'billing', businessOperationKey: `subscription:${subscriptionType}:${subscription._id}:${period.label}`, status: { $ne: 'cancelled' } })) {
    fail('BILLING_PERIOD_ALREADY_INVOICED', 'Ce mois est déjà facturé au titre d’une formule historique.', 409);
  }
  const classification = await classifyHolder(holder, { period, record: true });
  if (classification.ambiguous) {
    fail('AUTONOMOUS_CLASSIFICATION_AMBIGUOUS', `Facture fixe bloquée : ${classification.reasons.join(', ')}. Les frais de 1 % restent constatés.`, 409);
  }
  const price = await fixedPriceFor({ holder, formula: classification.formula, at: period.start });
  await accrueVariableFees({ holder, period, now });
  const info = formulaInfo(classification.formula);

  return runFinancialOperation({ operationName: 'billing.autonomous.generate', transactionMode: 'transactional' }, async ({ session }) => {
    const accruals = await Accrual.find({ subscriptionType, subscriptionId: subscription._id, period: period.label, kind: 'FEE', status: 'accrued' }).sort({ confirmedAt: 1 }).session(session).lean();
    const lines = [{ lineType: 'subscription', quantity: 1, unitAmountMinor: price.monthlyPriceMinor, sourceType: subscriptionType, sourceId: subscription._id, description: `Abonnement gestion autonome « ${info.label} » (${classification.counted} bien(s) géré(s)) — ${period.label}` }];
    accruals.forEach((accrual) => lines.push({
      lineType: 'fee', quantity: 1, unitAmountMinor: accrual.feeMinor, sourceType: 'PaymentAllocation', sourceId: accrual.allocation, serviceDate: accrual.confirmedAt,
      description: `Frais de service 1 % — loyer encaissé et confirmé de ${accrual.baseMinor} FCFA (bien ${String(accrual.property).slice(-6)}, bail ${String(accrual.lease || '').slice(-6)})`,
    }));
    const { document, created } = await createBillingDraft({
      session, actorId: authority.userId, lines,
      draft: {
        tenant, domain: 'billing', establishmentType: 'Subscription', establishmentId: subscription._id, currency: 'XAF',
        subjectType: subscriptionType, subjectId: subscription._id, businessOperationKey: key, customer,
        servicePeriodStart: period.start, servicePeriodEnd: period.end,
        dueDate: price.paymentTermDays == null ? null : new Date(period.start.getTime() + price.paymentTermDays * 86400000),
        metadata: {
          billingKind: BILLING_KINDS.AUTONOMOUS_SUBSCRIPTION, period: period.label, scope: { mandataryType: 'PLATFORM', tenant: null },
          issuerPlan: { role: 'PLATFORM', tenantId: null, onBehalfOfOwner: false },
          pricing: { version: PRICING.version, formula: classification.formula, fixedPriceSource: price.source, variableRateBasisPoints: PRICING.variableRateBasisPoints },
          classification: { counted: classification.counted, counts: classification.counts, countingPolicyStatus: classification.countingPolicyStatus },
          variableFees: { count: accruals.length, baseMinor: accruals.reduce((s, a) => s + a.baseMinor, 0), feeMinor: accruals.reduce((s, a) => s + a.feeMinor, 0) },
          parties: { serviceProvider: { role: 'PLATFORM' }, issuer: { role: 'PLATFORM' }, collectionAgent: { role: 'PLATFORM' }, economicBeneficiary: { role: 'PLATFORM' }, payer: { role: holder.holderType } },
        },
      },
    });
    if (created && accruals.length) {
      const marked = await Accrual.updateMany({ _id: { $in: accruals.map((a) => a._id) }, status: 'accrued' }, { $set: { status: 'invoiced', financialDocument: document._id } }, { session });
      if (marked.modifiedCount !== accruals.length) fail('BILLING_CONCURRENT_INVOICING', 'Des frais ont été facturés simultanément.', 409);
    }
    return { document, created };
  });
}

// ─── Devis Grand portefeuille ─────────────────────────────────────────

async function prepareQuote({ actor, subscriptionType, subscriptionId, monthlyPriceMinor, effectiveFrom, decisionReference }) {
  const authority = await assertPlatform(actor, CAP.BILLING_ISSUE);
  const { holder } = await loadSubscription(subscriptionType, subscriptionId);
  const classification = await classifyHolder(holder);
  if (classifyCount(classification.counted + classification.undecided) !== 'GRAND_PORTEFEUILLE') fail('PORTFOLIO_QUOTE_NOT_APPLICABLE', 'Le devis concerne les portefeuilles de 21 biens et plus.', 409);
  if (!Number.isSafeInteger(monthlyPriceMinor) || monthlyPriceMinor < 0) fail('FINANCIAL_INVALID_AMOUNT', 'Montant du devis invalide.', 422);
  return PortfolioQuote.create({
    subscriptionType, subscriptionId, holderType: holder.holderType, holderId: holder.holderId, monthlyPriceMinor,
    effectiveFrom: new Date(effectiveFrom), countedPropertiesAtQuote: classification.counted, decisionReference, preparedBy: authority.userId,
    history: [{ action: 'prepare', actor: authority.userId }],
  });
}

// Acceptation par le titulaire : l'utilisateur lui-même, ou un Admin de
// l'organisation (contexte TENANT, capacité d'émission) — jamais l'opérateur.
async function decideQuote({ actor, quoteId, decision }) {
  const quote = mongoose.isValidObjectId(quoteId) ? await PortfolioQuote.findById(quoteId) : null;
  if (!quote) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Devis inaccessible.', 404);
  const actorId = idOf(actor);
  if (quote.holderType === 'USER') {
    if (String(quote.holderId) !== actorId) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Devis inaccessible.', 404);
  } else {
    await authz.authorizeOnResource(actor, CAP.BILLING_ISSUE, { mandataryType: 'TENANT', tenant: quote.holderId });
  }
  if (!['accept', 'reject'].includes(decision)) fail('BILLING_DECISION_INVALID', 'Décision invalide.', 422);
  const status = decision === 'accept' ? 'accepted' : 'rejected';
  const updated = await PortfolioQuote.findOneAndUpdate(
    { _id: quote._id, status: 'proposed' },
    { $set: { status, decidedBy: actorId, decidedAt: new Date(), decisionMethod: 'IN_APP' }, $push: { history: { action: decision, actor: actorId } } },
    { new: true },
  );
  if (!updated) fail('BILLING_QUOTE_INVALID_TRANSITION', 'Devis déjà traité.', 409);
  return updated;
}

// ─── Synthèse titulaire (transparence) ────────────────────────────────

async function resolveHolderForActor(actor) {
  const authority = await authz.resolveContractualAuthority(actor);
  if (authority.plane === 'TENANT' && authority.capabilities.has(CAP.CONTRACT_READ)) {
    const subscription = await MODELS.PlatformTenantSubscription.findOne({ tenant: authority.tenantId, status: { $in: ['active', 'past_due', 'trialing'] } }).lean();
    return subscription ? { holderType: 'TENANT', holderId: subscription.tenant, subscriptionType: 'PlatformTenantSubscription', subscriptionId: subscription._id, subscription } : null;
  }
  const userId = idOf(actor);
  if (!userId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const subscription = await IndividualSubscription.findOne({ user: userId, status: { $in: ['active', 'past_due', 'trialing'] } }).lean();
  return subscription ? { holderType: 'USER', holderId: subscription.user, subscriptionType: 'IndividualSubscription', subscriptionId: subscription._id, subscription } : null;
}

async function autonomousSummary({ actor }) {
  const holder = await resolveHolderForActor(actor);
  if (!holder) return { subscribed: false, pricing: publicPricing() };
  const classification = await classifyHolder(holder, { record: true });
  const info = formulaInfo(classification.formula);
  const accruals = await Accrual.find({ subscriptionType: holder.subscriptionType, subscriptionId: holder.subscriptionId }).sort({ confirmedAt: -1 }).limit(200).lean();
  const pending = accruals.filter((a) => a.kind === 'FEE' && a.status === 'accrued');
  const quote = await PortfolioQuote.findOne({ subscriptionType: holder.subscriptionType, subscriptionId: holder.subscriptionId }).sort({ createdAt: -1 }).lean();
  const invoices = await FinancialDocument.find({ subjectType: holder.subscriptionType, subjectId: holder.subscriptionId, 'metadata.billingKind': { $in: [BILLING_KINDS.AUTONOMOUS_SUBSCRIPTION, BILLING_KINDS.SUBSCRIPTION] } }).sort({ createdAt: -1 }).lean();
  const fixedMinor = info?.monthlyPriceMinor ?? (quote?.status === 'accepted' ? quote.monthlyPriceMinor : null);
  const variableMinor = pending.reduce((sum, a) => sum + a.feeMinor, 0);
  return {
    subscribed: true, holderType: holder.holderType, pricing: publicPricing(),
    classification: { formula: classification.formula, label: info?.label || null, counted: classification.counted, counts: classification.counts, ambiguous: classification.ambiguous, reasons: classification.reasons, countingPolicyStatus: classification.countingPolicyStatus },
    current: {
      fixedMonthlyMinor: fixedMinor, onQuote: classification.formula === 'GRAND_PORTEFEUILLE', quote: quote ? { status: quote.status, monthlyPriceMinor: quote.monthlyPriceMinor, effectiveFrom: quote.effectiveFrom, id: quote._id } : null,
      confirmedRentBaseMinor: pending.reduce((sum, a) => sum + a.baseMinor, 0), variableFeesMinor: variableMinor,
      totalDueEstimateMinor: fixedMinor == null ? null : fixedMinor + variableMinor,
    },
    accruals: accruals.map((a) => ({ kind: a.kind, period: a.period, status: a.status, baseMinor: a.baseMinor, feeMinor: a.feeMinor, confirmedAt: a.confirmedAt, property: a.property, lease: a.lease })),
    invoices: invoices.map((doc) => ({ id: doc._id, period: doc.metadata?.period, status: doc.status, documentNumber: doc.documentNumber, totalMinor: doc.totalMinor, balanceMinor: doc.balanceMinor })),
  };
}

function publicPricing() {
  return { version: PRICING.version, currency: PRICING.currency, variableRateBasisPoints: PRICING.variableRateBasisPoints, formulas: PRICING.formulas.map((f) => ({ ...f })) };
}

module.exports = {
  classifyCount, variableFeeMinor, inventoryPortfolio, classifyHolder, accrueVariableFees, generateAutonomousInvoice,
  prepareQuote, decideQuote, autonomousSummary, publicPricing, loadSubscription,
};
