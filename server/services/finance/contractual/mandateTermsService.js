// F-U1.B — Validation et calcul purs des clauses financières d'un mandat.
//
// Module sans effet de bord ni accès base : il normalise les clauses saisies,
// refuse toute clause manquante (aucune valeur par défaut financière
// silencieuse), calcule la commission de gestion, les frais et les périodes de
// reversement. Le résultat normalisé est figé et haché : c'est ce snapshot qui
// est recopié sur chaque opération (non-rétroactivité).

const crypto = require('crypto');
const mongoose = require('mongoose');
const C = require('../../../constants/contractualFinanceConstants');
const { FINANCIAL_PAYMENT_METHODS, FINANCIAL_CURRENCIES } = require('../../../constants/financialConstants');
const { fail } = require('../financialError');
const { assertAmountMinor, percentageOfMinor, allocateProportionally, addMinor } = require('../moneyService');

const invalid = (message) => fail('MANDATE_TERMS_INVALID', message, 422);
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asIdString = (value, label) => {
  const raw = value?._id ?? value;
  if (!raw || !mongoose.isValidObjectId(raw)) invalid(`${label} doit référencer un identifiant valide.`);
  return String(raw);
};
const asDate = (value, label, { optional = false } = {}) => {
  if (value == null && optional) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (value == null || Number.isNaN(date.getTime())) invalid(`${label} doit être une date valide.`);
  return date;
};
const positiveMinor = (value, label) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid(`${label} doit être un montant entier strictement positif.`);
  return value;
};
const basisPoints = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) invalid(`${label} doit être un entier de points de base entre 0 et 10000.`);
  return value;
};
const oneOf = (value, allowed, label) => {
  if (!allowed.includes(value)) invalid(`${label} invalide ou absent.`);
  return value;
};

function normalizeFeeRule(rule, index) {
  if (!isPlainObject(rule)) invalid(`feeRules[${index}] doit être un objet.`);
  const label = `feeRules[${index}]`;
  const feeKind = oneOf(rule.feeKind, Object.values(C.FEE_KINDS), `${label}.feeKind`);
  const paymentMethod = oneOf(rule.paymentMethod, FINANCIAL_PAYMENT_METHODS, `${label}.paymentMethod`);
  const provider = rule.provider == null ? null : String(rule.provider).trim();
  const bearer = oneOf(rule.bearer, Object.values(C.FEE_BEARER_MODES), `${label}.bearer`);
  let split = [];
  if (bearer === C.FEE_BEARER_MODES.SPLIT) {
    if (!Array.isArray(rule.split) || rule.split.length < 2) invalid(`${label}.split doit répartir les frais entre au moins deux parties.`);
    split = rule.split.map((part, partIndex) => ({
      party: oneOf(part?.party, Object.values(C.FEE_PARTIES), `${label}.split[${partIndex}].party`),
      basisPoints: basisPoints(part?.basisPoints, `${label}.split[${partIndex}].basisPoints`),
    }));
    if (new Set(split.map((part) => part.party)).size !== split.length) invalid(`${label}.split ne peut pas citer deux fois la même partie.`);
    if (split.reduce((sum, part) => sum + part.basisPoints, 0) !== 10000) invalid(`${label}.split doit totaliser 10000 points de base.`);
  } else if (rule.split?.length) {
    invalid(`${label}.split n'est permis qu'avec bearer=SPLIT.`);
  }
  const pricing = rule.pricing;
  if (!isPlainObject(pricing)) invalid(`${label}.pricing est requis : aucun tarif prestataire n'est supposé.`);
  const fixedMinor = pricing.fixedMinor;
  if (!Number.isSafeInteger(fixedMinor) || fixedMinor < 0) invalid(`${label}.pricing.fixedMinor doit être un entier positif ou nul.`);
  const tariffSourceReference = String(pricing.tariffSourceReference || '').trim();
  if (!tariffSourceReference) invalid(`${label}.pricing.tariffSourceReference est requis (contrat, grille ou avenant d'origine du tarif).`);
  return {
    feeKind, paymentMethod, provider, bearer, split,
    pricing: { fixedMinor, basisPoints: basisPoints(pricing.basisPoints, `${label}.pricing.basisPoints`), tariffSourceReference },
  };
}

function normalizeDelegatedTerms(input, base) {
  const commission = input.commission;
  if (!isPlainObject(commission)) invalid('commission est requise pour une gestion déléguée.');
  if (commission.basisPoints !== C.DELEGATED_MANAGEMENT_COMMISSION_BASIS_POINTS) {
    invalid(`La commission de gestion déléguée validée est de ${C.DELEGATED_MANAGEMENT_COMMISSION_BASIS_POINTS} points de base ; toute autre valeur exige une décision métier.`);
  }
  oneOf(commission.base, Object.values(C.COMMISSION_BASES), 'commission.base');
  if (commission.expensesReduceBase !== undefined && commission.expensesReduceBase !== false) {
    invalid("Une clause réduisant l'assiette de commission par les dépenses n'est pas prise en charge sans validation juridique.");
  }
  const collectionMode = oneOf(input.collectionMode, Object.values(C.COLLECTION_MODES), 'collectionMode');
  const agency = collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION;
  const payoutFrequency = agency
    ? oneOf(input.payoutFrequency, Object.values(C.PAYOUT_FREQUENCIES), 'payoutFrequency (clause de reversement obligatoire en encaissement agence)')
    : null;
  if (!agency && input.payoutFrequency != null) invalid("payoutFrequency est sans objet lorsque le locataire paie directement le propriétaire.");
  const payoutBeneficiary = agency ? asIdString(input.payoutBeneficiary, 'payoutBeneficiary') : null;
  const ownerDirectAccount = agency ? null : asIdString(input.ownerDirectAccount, 'ownerDirectAccount');
  if (!Array.isArray(input.feeRules)) invalid('feeRules doit être une liste (éventuellement vide).');
  const feeRules = input.feeRules.map(normalizeFeeRule);
  const keys = feeRules.map((rule) => `${rule.feeKind}:${rule.paymentMethod}:${rule.provider || '*'}`);
  if (new Set(keys).size !== keys.length) invalid('Deux règles de frais couvrent le même couple (type, moyen, prestataire).');
  const caps = input.expenseCaps;
  if (!isPlainObject(caps)) invalid('expenseCaps est requis : plafond par intervention et plafond mensuel cumulatif.');
  const expenseCaps = {
    perInterventionMinor: positiveMinor(caps.perInterventionMinor, 'expenseCaps.perInterventionMinor'),
    monthlyCumulativeMinor: positiveMinor(caps.monthlyCumulativeMinor, 'expenseCaps.monthlyCumulativeMinor'),
    period: oneOf(caps.period, Object.values(C.EXPENSE_CAP_PERIODS), 'expenseCaps.period'),
  };
  if (expenseCaps.perInterventionMinor > expenseCaps.monthlyCumulativeMinor) invalid('Le plafond par intervention ne peut pas dépasser le plafond mensuel.');
  return {
    ...base,
    commission: { basisPoints: commission.basisPoints, base: commission.base, expensesReduceBase: false },
    collectionMode, payoutFrequency, payoutBeneficiary, ownerDirectAccount, feeRules, expenseCaps,
    subscriptionReference: null,
  };
}

function normalizeAutonomousTerms(input, base) {
  for (const forbidden of ['commission', 'collectionMode', 'payoutFrequency', 'payoutBeneficiary', 'ownerDirectAccount', 'expenseCaps']) {
    if (input[forbidden] != null) invalid(`${forbidden} est interdit pour une gestion autonome par abonnement.`);
  }
  const ref = input.subscriptionReference;
  if (!isPlainObject(ref)) invalid("subscriptionReference est requis pour une gestion autonome.");
  return {
    ...base,
    commission: null, collectionMode: null, payoutFrequency: null, payoutBeneficiary: null,
    ownerDirectAccount: null, feeRules: [], expenseCaps: null,
    subscriptionReference: {
      type: oneOf(ref.type, ['IndividualSubscription', 'PlatformTenantSubscription'], 'subscriptionReference.type'),
      id: asIdString(ref.id, 'subscriptionReference.id'),
    },
  };
}

function normalizeMandateTerms(input) {
  if (!isPlainObject(input)) invalid('Les clauses du mandat sont requises.');
  const offer = oneOf(input.offer, Object.values(C.MANAGEMENT_OFFERS), 'offer');
  const currency = oneOf(input.currency, FINANCIAL_CURRENCIES, 'currency');
  const effectiveFrom = asDate(input.effectiveFrom, 'effectiveFrom');
  const effectiveTo = asDate(input.effectiveTo, 'effectiveTo', { optional: true });
  if (effectiveTo && effectiveTo <= effectiveFrom) invalid("effectiveTo doit être postérieure à effectiveFrom.");
  const legalReference = String(input.legalReference || '').trim();
  if (!legalReference) invalid('legalReference (référence du mandat signé) est requise.');
  const base = { offer, currency, effectiveFrom, effectiveTo, legalReference };
  const terms = offer === C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT
    ? normalizeDelegatedTerms(input, base)
    : normalizeAutonomousTerms(input, base);
  return deepFreeze(terms);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') return String(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

const hashTerms = (terms) => crypto.createHash('sha256').update(JSON.stringify(canonicalize(terms))).digest('hex');

// Commission de gestion : uniquement sur un loyer confirmé, uniquement en
// gestion déléguée. L'assiette n'est jamais réduite par les dépenses.
function computeManagementCommission({ terms, confirmedRentMinor }) {
  assertAmountMinor(confirmedRentMinor);
  if (terms?.offer !== C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    return { applicable: false, reason: 'AUTONOMOUS_SUBSCRIPTION_NO_DELEGATED_COMMISSION', basisPoints: 0, commissionMinor: 0 };
  }
  return {
    applicable: true,
    reason: null,
    basisPoints: terms.commission.basisPoints,
    baseMinor: confirmedRentMinor,
    commissionMinor: percentageOfMinor(confirmedRentMinor, terms.commission.basisPoints),
  };
}

function findFeeRule(terms, { feeKind, paymentMethod, provider }) {
  const rules = terms?.feeRules || [];
  return rules.find((rule) => rule.feeKind === feeKind && rule.paymentMethod === paymentMethod && rule.provider === (provider || null))
    || rules.find((rule) => rule.feeKind === feeKind && rule.paymentMethod === paymentMethod && rule.provider === null)
    || null;
}

// Frais déterminés à partir du snapshot contractuel : aucune règle → échec
// fermé (jamais un tarif supposé). Retourne la base de calcul et la
// répartition par partie, à figer sur l'opération.
function determineTransactionFees({ terms, feeKind, paymentMethod, provider = null, amountMinor }) {
  assertAmountMinor(amountMinor);
  const rule = findFeeRule(terms, { feeKind, paymentMethod, provider });
  if (!rule) fail('FEE_RULE_NOT_CONFIGURED', `Aucune règle de frais contractuelle pour ${feeKind}/${paymentMethod}${provider ? `/${provider}` : ''}.`, 422);
  const totalMinor = addMinor(rule.pricing.fixedMinor, percentageOfMinor(amountMinor, rule.pricing.basisPoints));
  const parties = rule.bearer === C.FEE_BEARER_MODES.SPLIT ? rule.split : [{ party: rule.bearer, basisPoints: 10000 }];
  const shares = totalMinor === 0 ? parties.map(() => 0) : allocateProportionally(totalMinor, parties.map((part) => part.basisPoints));
  const byParty = Object.fromEntries(Object.values(C.FEE_PARTIES).map((party) => [party, 0]));
  parties.forEach((part, index) => { byParty[part.party] += shares[index]; });
  return {
    feeKind, paymentMethod, provider: provider || null, baseAmountMinor: amountMinor,
    rule: { bearer: rule.bearer, split: rule.split, pricing: rule.pricing },
    totalMinor, byParty,
  };
}

// Découpage des périodes de reversement dans le fuseau contractuel.
function toContractLocal(date) {
  return new Date(date.getTime() + C.CONTRACT_TIMEZONE.offsetMinutes * 60000);
}
function fromContractLocal(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day) - C.CONTRACT_TIMEZONE.offsetMinutes * 60000);
}
const pad = (value) => String(value).padStart(2, '0');

function contractMonthKey(at) {
  const local = toContractLocal(asDate(at, 'at'));
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}`;
}

function computePayoutPeriod({ frequency, at, sourceId }) {
  const date = asDate(at, 'at');
  const local = toContractLocal(date);
  const year = local.getUTCFullYear(); const month = local.getUTCMonth(); const day = local.getUTCDate();
  switch (frequency) {
    case C.PAYOUT_FREQUENCIES.PER_CONFIRMED_COLLECTION:
      if (!sourceId) invalid('sourceId est requis pour un reversement par encaissement.');
      return { frequency, periodKey: `collection:${sourceId}`, start: date, end: date };
    case C.PAYOUT_FREQUENCIES.MONTHLY:
      return { frequency, periodKey: `month:${year}-${pad(month + 1)}`, start: fromContractLocal(year, month, 1), end: fromContractLocal(year, month + 1, 1) };
    case C.PAYOUT_FREQUENCIES.SEMI_MONTHLY: {
      const firstHalf = day <= 15;
      return {
        frequency,
        periodKey: `semimonth:${year}-${pad(month + 1)}-${firstHalf ? 'H1' : 'H2'}`,
        start: fromContractLocal(year, month, firstHalf ? 1 : 16),
        end: firstHalf ? fromContractLocal(year, month, 16) : fromContractLocal(year, month + 1, 1),
      };
    }
    case C.PAYOUT_FREQUENCIES.WEEKLY: {
      const isoDay = local.getUTCDay() || 7;
      const monday = new Date(Date.UTC(year, month, day - isoDay + 1));
      const thursday = new Date(monday.getTime() + 3 * 86400000);
      const isoYear = thursday.getUTCFullYear();
      const week = Math.ceil(((thursday - Date.UTC(isoYear, 0, 1)) / 86400000 + 1) / 7);
      const start = fromContractLocal(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
      return { frequency, periodKey: `week:${isoYear}-W${pad(week)}`, start, end: new Date(start.getTime() + 7 * 86400000) };
    }
    default:
      return fail('PAYOUT_FREQUENCY_NOT_CONFIGURED', 'Périodicité de reversement absente ou invalide : aucune valeur par défaut appliquée.', 422);
  }
}

module.exports = {
  normalizeMandateTerms, hashTerms, canonicalize,
  computeManagementCommission, determineTransactionFees, findFeeRule,
  computePayoutPeriod, contractMonthKey,
};
