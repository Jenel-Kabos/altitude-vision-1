// PAY-3 — Registre de providers de paiement, provider-agnostic, posé
// au-dessus du Financial Core existant (FinancialPayment/PaymentAllocation/
// FinancialDocument/FinancialLedgerEntry — inchangés, aucun second moteur).
//
// Objectif : documenter et faire respecter en code, pas seulement en prose,
// quelles capacités chaque provider possède réellement aujourd'hui, pour
// qu'un futur sprint MTN/Airtel/Carte n'ait qu'à fournir une implémentation
// concrète à un contrat déjà défini — jamais réinventer facture, allocation,
// solde, readiness, ledger ou permissions par provider (mandat PAY-3 §60 de
// PAY-1, rappelé par PAY-3 §1).
//
// Contrat commun (capacités, jamais imposées artificiellement — mandat §14) :
//   initiatePayment(params)   — seulement si capabilities.initiate
//   getStatus(params)         — seulement si capabilities.statusQuery
//   verifyCallback(req)       — seulement si capabilities.webhook
//   normalizeStatus(raw)      — toujours présent, pur, sans effet de bord
//   supportsRefund()          — dérivé de capabilities.refund
//   refundPayment(params)     — seulement si capabilities.refund
//   reconcile(params)         — seulement si capabilities.reconcile
//
// Aucun provider automatique (MTN/Airtel/Carte) n'est implémenté dans ce
// sprint : leur `initiatePayment`/`getStatus`/`verifyCallback` lèvent
// `FINANCIAL_PROVIDER_NOT_IMPLEMENTED` de façon stable et explicite — jamais
// un appel réseau, jamais un secret référencé. Le provider manuel délègue
// aux services déjà existants et validés (F2.2, `financialPaymentService`) :
// aucune logique de paiement manuel n'est dupliquée ici.

const { fail } = require('./financialError');
const { PAYMENT_PROVIDERS, PAYMENT_PROVIDER_SCOPE, PAYMENT_PROVIDER_METHODS } = require('../../constants/paymentProviderConstants');
const { FINANCIAL_PAYMENT_STATUSES } = require('../../constants/financialConstants');
// PAY-4 — mtn_direct est désormais réellement implémenté (transport +
// adaptateur dans services/payments/providers/mtn/). Le registre importe le
// provider (jamais l'inverse) pour éviter toute dépendance circulaire — voir
// mtnMoMoProvider.js pour le détail du contrat.
const mtnMoMoProvider = require('../payments/providers/mtn/mtnMoMoProvider');

const notImplemented = (provider, capability) => () => {
  fail('FINANCIAL_PROVIDER_NOT_IMPLEMENTED', `Le provider "${provider}" ne fournit pas encore "${capability}".`, 501);
};

// Table de normalisation (PAY-3 §16) : chaque provider mappe son vocabulaire
// vers les seuls statuts réels de FinancialPayment (financialConstants.js),
// jamais un nouvel enum. Le provider manuel n'a pas de statut "distant" —
// son cycle pending→succeeded est déjà entièrement piloté par
// `financialPaymentService`/`manualValidation`, documenté ici pour mémoire
// uniquement (jamais appelé en pratique par le manuel).
const STATUS_MAPS = Object.freeze({
  [PAYMENT_PROVIDERS.MANUAL]: Object.freeze({ submitted: 'pending', approved: 'succeeded', rejected: 'failed' }),
  // PAY-4 — source de vérité unique : mtnMoMoProvider.MTN_STATUS_MAP.
  [PAYMENT_PROVIDERS.MTN_DIRECT]: mtnMoMoProvider.MTN_STATUS_MAP,
  [PAYMENT_PROVIDERS.AIRTEL_DIRECT]: Object.freeze({ pending: 'pending', success: 'succeeded', failed: 'failed', cancelled: 'cancelled' }),
  [PAYMENT_PROVIDERS.YABETOO]: Object.freeze({ pending: 'pending', succeeded: 'succeeded', failed: 'failed', cancelled: 'cancelled' }),
  [PAYMENT_PROVIDERS.CARD_PSP]: Object.freeze({ pending: 'pending', authorized: 'processing', captured: 'succeeded', declined: 'failed', voided: 'cancelled' }),
});

function normalizeStatus(provider, rawStatus) {
  const map = STATUS_MAPS[provider];
  if (!map) fail('FINANCIAL_PROVIDER_UNKNOWN', `Provider inconnu du registre : "${provider}".`, 500);
  const normalized = map[rawStatus];
  if (!normalized) fail('FINANCIAL_PROVIDER_STATUS_UNKNOWN', `Statut "${rawStatus}" non reconnu pour le provider "${provider}".`, 422);
  if (!FINANCIAL_PAYMENT_STATUSES.includes(normalized)) {
    // Garde de cohérence interne : ne peut se produire que si STATUS_MAPS
    // référence un statut retiré de financialConstants.js.
    fail('FINANCIAL_PROVIDER_STATUS_UNKNOWN', `Mapping invalide pour "${provider}"/"${rawStatus}".`, 500);
  }
  return normalized;
}

// PAY-3 §17 — aucun fallback automatique n'est implémenté. Cette fonction
// pure documente et fait respecter en code la seule règle actée : jamais
// depuis `pending`/`processing` (statut distant inconnu = risque de double
// débit si un second provider est tenté en parallèle), seulement depuis un
// état terminal non réussi (`failed`/`cancelled`).
const FALLBACK_ALLOWED_FROM = Object.freeze(['failed', 'cancelled']);
function assertFallbackAllowed(fromStatus) {
  if (!FALLBACK_ALLOWED_FROM.includes(fromStatus)) {
    fail('FINANCIAL_FALLBACK_NOT_ALLOWED', `Un changement de provider n'est jamais autorisé depuis le statut "${fromStatus}" (risque de double débit).`, 409);
  }
}

const REGISTRY = Object.freeze({
  [PAYMENT_PROVIDERS.MANUAL]: Object.freeze({
    provider: PAYMENT_PROVIDERS.MANUAL,
    scope: PAYMENT_PROVIDER_SCOPE[PAYMENT_PROVIDERS.MANUAL],
    methods: PAYMENT_PROVIDER_METHODS[PAYMENT_PROVIDERS.MANUAL],
    integratedWithFinancialCore: true,
    capabilities: Object.freeze({ initiate: false, statusQuery: false, webhook: false, refund: false, reconcile: false, requiresManualValidation: true }),
    normalizeStatus: (raw) => normalizeStatus(PAYMENT_PROVIDERS.MANUAL, raw),
    // Pas d'initiatePayment : le staff enregistre directement via
    // financialPaymentService.createManualPayment/createHotelPayment
    // (F2.2, inchangé, jamais dupliqué ici).
  }),
  // PAY-4 — mtn_direct : implémentation réelle (sandbox), transport et
  // décision financière strictement séparés (services/payments/providers/mtn/).
  // `integratedWithFinancialCore: true` uniquement depuis PAY-4 : un
  // FinancialPayment `provider: 'mtn_direct'` est réellement produit par
  // mtnHotelPaymentBridge.js, contrairement aux autres providers automatiques
  // toujours à `false`.
  [PAYMENT_PROVIDERS.MTN_DIRECT]: Object.freeze({
    provider: PAYMENT_PROVIDERS.MTN_DIRECT,
    scope: PAYMENT_PROVIDER_SCOPE[PAYMENT_PROVIDERS.MTN_DIRECT],
    methods: PAYMENT_PROVIDER_METHODS[PAYMENT_PROVIDERS.MTN_DIRECT],
    integratedWithFinancialCore: true,
    capabilities: Object.freeze({ initiate: true, statusQuery: true, webhook: true, refund: false, reconcile: true, requiresManualValidation: false }),
    normalizeStatus: mtnMoMoProvider.normalizeStatus,
    initiatePayment: mtnMoMoProvider.initiatePayment,
    getStatus: mtnMoMoProvider.getStatus,
    verifyCallback: mtnMoMoProvider.extractCallbackReference,
  }),
  [PAYMENT_PROVIDERS.AIRTEL_DIRECT]: Object.freeze({
    provider: PAYMENT_PROVIDERS.AIRTEL_DIRECT,
    scope: PAYMENT_PROVIDER_SCOPE[PAYMENT_PROVIDERS.AIRTEL_DIRECT],
    methods: PAYMENT_PROVIDER_METHODS[PAYMENT_PROVIDERS.AIRTEL_DIRECT],
    integratedWithFinancialCore: false,
    capabilities: Object.freeze({ initiate: true, statusQuery: true, webhook: true, refund: false, reconcile: true, requiresManualValidation: false }),
    normalizeStatus: (raw) => normalizeStatus(PAYMENT_PROVIDERS.AIRTEL_DIRECT, raw),
    initiatePayment: notImplemented(PAYMENT_PROVIDERS.AIRTEL_DIRECT, 'initiatePayment'),
    getStatus: notImplemented(PAYMENT_PROVIDERS.AIRTEL_DIRECT, 'getStatus'),
    verifyCallback: notImplemented(PAYMENT_PROVIDERS.AIRTEL_DIRECT, 'verifyCallback'),
  }),
  [PAYMENT_PROVIDERS.YABETOO]: Object.freeze({
    provider: PAYMENT_PROVIDERS.YABETOO,
    scope: PAYMENT_PROVIDER_SCOPE[PAYMENT_PROVIDERS.YABETOO],
    methods: PAYMENT_PROVIDER_METHODS[PAYMENT_PROVIDERS.YABETOO],
    // Yabetoo fonctionne déjà réellement (server/services/yabetooService.js,
    // paiementTransactionController.js, visiteController.js) mais en dehors
    // du Financial Core (PaiementTransaction/Visite, pas FinancialPayment) —
    // voir PAY1_ARCHITECTURE_REPORT.md §10. `false` ici documente l'absence
    // de branchement au Financial Core, pas l'absence d'intégration réelle.
    integratedWithFinancialCore: false,
    capabilities: Object.freeze({ initiate: true, statusQuery: true, webhook: true, refund: false, reconcile: false, requiresManualValidation: false }),
    normalizeStatus: (raw) => normalizeStatus(PAYMENT_PROVIDERS.YABETOO, raw),
    initiatePayment: notImplemented(PAYMENT_PROVIDERS.YABETOO, 'initiatePayment (Financial Core)'),
    getStatus: notImplemented(PAYMENT_PROVIDERS.YABETOO, 'getStatus (Financial Core)'),
    verifyCallback: notImplemented(PAYMENT_PROVIDERS.YABETOO, 'verifyCallback (Financial Core)'),
  }),
  [PAYMENT_PROVIDERS.CARD_PSP]: Object.freeze({
    provider: PAYMENT_PROVIDERS.CARD_PSP,
    scope: PAYMENT_PROVIDER_SCOPE[PAYMENT_PROVIDERS.CARD_PSP],
    methods: PAYMENT_PROVIDER_METHODS[PAYMENT_PROVIDERS.CARD_PSP],
    integratedWithFinancialCore: false,
    // Aucun PSP choisi (PAY-1 §44) : capacités déclarées par anticipation
    // (hosted checkout / tokenization attendus), jamais un PAN/CVV stocké
    // par ce registre ni par aucun code du dépôt.
    capabilities: Object.freeze({ initiate: true, statusQuery: true, webhook: true, refund: true, reconcile: true, requiresManualValidation: false }),
    normalizeStatus: (raw) => normalizeStatus(PAYMENT_PROVIDERS.CARD_PSP, raw),
    initiatePayment: notImplemented(PAYMENT_PROVIDERS.CARD_PSP, 'initiatePayment'),
    getStatus: notImplemented(PAYMENT_PROVIDERS.CARD_PSP, 'getStatus'),
    verifyCallback: notImplemented(PAYMENT_PROVIDERS.CARD_PSP, 'verifyCallback'),
    refundPayment: notImplemented(PAYMENT_PROVIDERS.CARD_PSP, 'refundPayment'),
  }),
});

function getProvider(providerKey) {
  const entry = REGISTRY[providerKey];
  if (!entry) fail('FINANCIAL_PROVIDER_UNKNOWN', `Provider inconnu du registre : "${providerKey}".`, 500);
  return entry;
}

function listProviders() {
  return Object.values(REGISTRY).map(({ provider, scope, methods, integratedWithFinancialCore, capabilities }) => ({ provider, scope, methods, integratedWithFinancialCore, capabilities }));
}

function supportsRefund(providerKey) {
  return getProvider(providerKey).capabilities.refund === true;
}

module.exports = { getProvider, listProviders, supportsRefund, normalizeStatus, assertFallbackAllowed, PAYMENT_PROVIDERS };
