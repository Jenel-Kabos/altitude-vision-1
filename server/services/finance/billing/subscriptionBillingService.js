// F-U2.3 — Facturation mensuelle de la gestion autonome par abonnement.
//
// Émetteur : Altitude Vision (PLATFORM). Aucune commission de 10 %.
// Prix : SubscriptionTariff actif (décision référencée, activé par une
// personne distincte) ; sans tarif → refus explicite, jamais un prix supposé.
// Facture : une par abonnement et par mois (`subscription:<type>:<id>:<AAAA-MM>`,
// renouvellement idempotent). Périodes non facturées : essai (`trialing`),
// organisation suspendue/archivée, abonnement ne couvrant pas tout le mois
// (changement de formule, annulation en cours de mois : règle de prorata non
// définie) — ces cas sont refusés avec un code explicite.
// Opérations réservées au contexte PLATFORM.

const mongoose = require('mongoose');
const SubscriptionTariff = require('../../../models/SubscriptionTariff');
const PlatformTenantSubscription = require('../../../models/PlatformTenantSubscription');
const IndividualSubscription = require('../../../models/IndividualSubscription');
const PlatformTenant = require('../../../models/PlatformTenant');
const User = require('../../../models/User');
const { BILLING_KINDS, ALTIMMO_AUTONOMOUS_PRICING } = require('../../../constants/billingConstants');
const FinancialDocument = require('../../../models/FinancialDocument');
const { fail } = require('../financialError');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { assertDistinctHumans } = require('../contractual/humanIdentityService');
const { createBillingDraft } = require('./billingDocumentService');
const { parsePeriod } = require('./rentBillingService');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;
const DAY = 86400000;
const MODELS = { PlatformTenantSubscription, IndividualSubscription };

async function assertPlatform(actor, capability) {
  const authority = await authz.assertContractualCapability(actor, capability);
  if (authority.plane !== 'PLATFORM') fail('FINANCIAL_UNAUTHORIZED', 'Facturation des abonnements réservée à la vue plateforme Altitude Vision.', 403);
  return authority;
}

// Formule autonome (F-U2.9) : le tarif saisi doit reproduire EXACTEMENT la
// politique commerciale validée (prix, taux) — toute divergence est refusée.
function assertMatchesValidatedPolicy({ formula, monthlyPriceMinor, variableRateBasisPoints }) {
  const official = ALTIMMO_AUTONOMOUS_PRICING.formulas.find((item) => item.code === formula);
  if (!official) fail('BILLING_TARIFF_INVALID', 'Formule autonome inconnue.', 422);
  if (official.monthlyPriceMinor !== (monthlyPriceMinor ?? null) || variableRateBasisPoints !== ALTIMMO_AUTONOMOUS_PRICING.variableRateBasisPoints) {
    fail('TARIFF_DIFFERS_FROM_VALIDATED_POLICY', 'Le tarif diffère de la politique commerciale validée.', 422);
  }
}

async function draftTariff({ actor, plan = null, formula = null, monthlyPriceMinor = null, variableRateBasisPoints = null, paymentTermDays = null, effectiveFrom, decisionReference }) {
  const authority = await assertPlatform(actor, CAP.BILLING_ISSUE);
  if (formula) assertMatchesValidatedPolicy({ formula, monthlyPriceMinor, variableRateBasisPoints });
  const last = await SubscriptionTariff.findOne(formula ? { formula } : { plan }).sort({ version: -1 }).lean();
  return SubscriptionTariff.create({
    plan, formula, version: (last?.version || 0) + 1, currency: 'XAF', monthlyPriceMinor, variableRateBasisPoints,
    policyVersion: formula ? ALTIMMO_AUTONOMOUS_PRICING.version : null, paymentTermDays,
    effectiveFrom: new Date(effectiveFrom), decisionReference, createdBy: authority.userId,
  });
}

async function activateTariff({ actor, tariffId }) {
  const authority = await assertPlatform(actor, CAP.BILLING_ISSUE);
  const tariff = mongoose.isValidObjectId(tariffId) ? await SubscriptionTariff.findById(tariffId) : null;
  if (!tariff || tariff.status !== 'draft') fail('BILLING_TARIFF_INVALID_TRANSITION', 'Tarif introuvable ou déjà traité.', 409);
  await assertDistinctHumans({ activateur: authority.userId, rédacteur: tariff.createdBy }, { actor: 'activateur' });
  const updated = await SubscriptionTariff.findOneAndUpdate({ _id: tariff._id, status: 'draft' }, { $set: { status: 'active', activatedBy: authority.userId, activatedAt: new Date() } }, { new: true });
  if (!updated) fail('BILLING_TARIFF_INVALID_TRANSITION', 'Tarif modifié entre-temps.', 409);
  return updated;
}

async function tariffFor(plan, at) {
  const tariff = await SubscriptionTariff.findOne({ plan, status: 'active', effectiveFrom: { $lte: at } }).sort({ effectiveFrom: -1, version: -1 }).lean();
  if (!tariff) fail('SUBSCRIPTION_PRICE_NOT_CONFIGURED', `Aucun tarif validé pour la formule « ${plan} » à cette date.`, 409);
  return tariff;
}

async function generateSubscriptionInvoice({ actor, subscriptionType, subscriptionId, period: periodLabel }) {
  const authority = await assertPlatform(actor, CAP.BILLING_MANAGE);
  const Model = MODELS[subscriptionType];
  if (!Model) fail('BILLING_SUBSCRIPTION_TYPE_INVALID', 'Type d’abonnement invalide.', 422);
  const subscription = mongoose.isValidObjectId(subscriptionId) ? await Model.findById(subscriptionId).lean() : null;
  if (!subscription) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Abonnement inaccessible.', 404);
  const period = parsePeriod(periodLabel);
  if (subscription.status === 'trialing') fail('SUBSCRIPTION_NOT_BILLABLE', 'Période d’essai : aucune facturation.', 409);
  const coveredFrom = new Date(subscription.startDate) <= period.start;
  const end = subscription.cancelledAt || subscription.endDate;
  const coveredTo = !end || new Date(end) >= new Date(period.end.getTime() - DAY);
  if (!coveredFrom || !coveredTo) fail('SUBSCRIPTION_PARTIAL_PERIOD_RULE_NOT_CONFIGURED', 'L’abonnement ne couvre pas tout le mois : règle de prorata non définie.', 409);
  if (subscription.status === 'cancelled' && !subscription.cancelledAt) fail('SUBSCRIPTION_NOT_BILLABLE', 'Abonnement annulé sans date d’effet.', 409);

  let customer; let tenant = null;
  if (subscriptionType === 'PlatformTenantSubscription') {
    const org = await PlatformTenant.findById(subscription.tenant).select('name status').lean();
    if (!org || ['suspended', 'archived'].includes(org.status)) fail('SUBSCRIPTION_BILLING_SUSPENDED', 'Organisation suspendue ou archivée : facturation suspendue.', 409);
    customer = { name: org.name }; tenant = org._id;
  } else {
    const user = await User.findById(subscription.user).select('name email phone').lean();
    customer = { name: user?.name || 'Abonné', email: user?.email, phone: user?.phone, userId: subscription.user };
  }
  const tariff = await tariffFor(subscription.plan, period.start);
  // F-U2.9 : jamais deux factures d'abonnement pour le même titulaire et le
  // même mois (formule historique et gestion autonome).
  if (await FinancialDocument.exists({ domain: 'billing', businessOperationKey: `autonomous:${subscriptionType}:${subscription._id}:${period.label}`, status: { $ne: 'cancelled' } })) {
    fail('BILLING_PERIOD_ALREADY_INVOICED', 'Ce mois est déjà facturé au titre de la gestion autonome.', 409);
  }
  return createBillingDraft({
    actorId: authority.userId,
    lines: [{ lineType: 'subscription', description: `Abonnement gestion autonome « ${subscription.plan} » — ${period.label}`, quantity: 1, unitAmountMinor: tariff.monthlyPriceMinor, sourceType: subscriptionType, sourceId: subscription._id }],
    draft: {
      tenant, domain: 'billing', establishmentType: 'Subscription', establishmentId: subscription._id, currency: tariff.currency,
      subjectType: subscriptionType, subjectId: subscription._id, businessOperationKey: `subscription:${subscriptionType}:${subscription._id}:${period.label}`,
      servicePeriodStart: period.start, servicePeriodEnd: period.end, dueDate: tariff.paymentTermDays == null ? null : new Date(period.start.getTime() + tariff.paymentTermDays * DAY), customer,
      metadata: {
        billingKind: BILLING_KINDS.SUBSCRIPTION, period: period.label, plan: subscription.plan, scope: { mandataryType: 'PLATFORM', tenant: null },
        tariff: { id: tariff._id, version: tariff.version, decisionReference: tariff.decisionReference },
        issuerPlan: { role: 'PLATFORM', tenantId: null, onBehalfOfOwner: false },
        parties: { serviceProvider: { role: 'PLATFORM' }, issuer: { role: 'PLATFORM' }, collectionAgent: { role: 'PLATFORM' }, economicBeneficiary: { role: 'PLATFORM' }, payer: { role: subscriptionType === 'PlatformTenantSubscription' ? 'TENANT' : 'USER' } },
      },
    },
  });
}

module.exports = { draftTariff, activateTariff, generateSubscriptionInvoice, tariffFor, assertPlatform, MODELS };
