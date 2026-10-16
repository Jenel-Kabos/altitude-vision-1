// F-U1 — Fondations contractuelles et financières unifiées.
//
// Vocabulaire contractuel partagé par les mandats de gestion, les dépenses,
// les obligations propriétaires et la gouvernance des remboursements. Toutes
// les valeurs sont des énumérations fermées : une valeur absente doit échouer
// FERMÉ, jamais être remplacée par une valeur par défaut silencieuse.
//
// Aucune valeur monétaire n'est définie ici, à l'exception de la commission de
// gestion déléguée (10 %), seule règle chiffrée validée par la direction.
// Plafonds de dépenses, seuils de remboursement et tarifs prestataires restent
// des paramètres contractuels saisis explicitement (jamais inventés).

const MANAGEMENT_OFFERS = Object.freeze({
  DELEGATED_MANAGEMENT: 'DELEGATED_MANAGEMENT',
  AUTONOMOUS_SUBSCRIPTION: 'AUTONOMOUS_SUBSCRIPTION',
});

const COLLECTION_MODES = Object.freeze({
  AGENCY_COLLECTION: 'AGENCY_COLLECTION',
  OWNER_DIRECT: 'OWNER_DIRECT',
});

// SEMI_MONTHLY : deux échéances par mois civil, du 1er au 15 inclus puis du
// 16 au dernier jour du mois (fuseau contractuel ci-dessous). WEEKLY : semaine
// ISO, du lundi 00:00 au lundi suivant 00:00.
const PAYOUT_FREQUENCIES = Object.freeze({
  PER_CONFIRMED_COLLECTION: 'PER_CONFIRMED_COLLECTION',
  WEEKLY: 'WEEKLY',
  SEMI_MONTHLY: 'SEMI_MONTHLY',
  MONTHLY: 'MONTHLY',
});

// Valeur proposée lors de la RÉDACTION d'un mandat uniquement — jamais
// appliquée à un mandat dont la clause est absente.
const SUGGESTED_DRAFT_PAYOUT_FREQUENCY = PAYOUT_FREQUENCIES.MONTHLY;

// Brazzaville : WAT (UTC+1), sans heure d'été. Les mois, quinzaines et
// semaines contractuels sont découpés dans ce fuseau.
const CONTRACT_TIMEZONE = Object.freeze({ name: 'Africa/Brazzaville', offsetMinutes: 60 });

// Règle métier n° 1 validée : 10 % des loyers effectivement encaissés et
// confirmés. Exprimée en points de base (1000 = 10,00 %).
const DELEGATED_MANAGEMENT_COMMISSION_BASIS_POINTS = 1000;
const COMMISSION_BASES = Object.freeze({ CONFIRMED_COLLECTED_RENT: 'CONFIRMED_COLLECTED_RENT' });

const MANDATARY_TYPES = Object.freeze({ PLATFORM: 'PLATFORM', TENANT: 'TENANT' });

const MANDATE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});
const MANDATE_TRANSITIONS = Object.freeze({
  draft: ['active', 'revoked'],
  active: ['suspended', 'revoked', 'expired'],
  suspended: ['active', 'revoked', 'expired'],
  revoked: [],
  expired: [],
});
const LIVE_MANDATE_STATUSES = Object.freeze(['draft', 'active', 'suspended']);

const FEE_KINDS = Object.freeze({ COLLECTION: 'COLLECTION', PAYOUT: 'PAYOUT' });
const FEE_PARTIES = Object.freeze({
  TENANT_PAYER: 'TENANT_PAYER',
  OWNER: 'OWNER',
  ALTITUDE_VISION: 'ALTITUDE_VISION',
});
const FEE_BEARER_MODES = Object.freeze({ ...FEE_PARTIES, SPLIT: 'SPLIT' });

const EXPENSE_CAP_PERIODS = Object.freeze({ CALENDAR_MONTH: 'CALENDAR_MONTH' });
const EXPENSE_STATUSES = Object.freeze({
  PENDING_OWNER_AUTHORIZATION: 'pending_owner_authorization',
  COMMITTED: 'committed',
  AUTHORIZED: 'authorized',
  REFUSED: 'refused',
  CANCELLED: 'cancelled',
  JUSTIFIED: 'justified',
});
const RESERVED_EXPENSE_STATUSES = Object.freeze(['committed', 'authorized']);
const EXPENSE_CAP_BREACHES = Object.freeze({ PER_INTERVENTION: 'PER_INTERVENTION', MONTHLY: 'MONTHLY' });

const EXPENSE_AUTHORIZATION_MODES = Object.freeze({ IN_APP: 'IN_APP', VERIFIED_WRITTEN: 'VERIFIED_WRITTEN' });
const WRITTEN_AUTHORIZATION_VERIFICATION_RESULTS = Object.freeze(['verified', 'rejected', 'inconclusive']);

// OWNER_DIRECT : declared → owner_confirmed (corroboration, sans effet
// financier) → reconciled (preuve vérifiée par un tiers habilité) | rejected.
const COLLECTION_RECORD_STATUSES = Object.freeze({
  CONFIRMED: 'confirmed',
  DECLARED: 'declared',
  OWNER_CONFIRMED: 'owner_confirmed',
  RECONCILED: 'reconciled',
  REJECTED: 'rejected',
});
// Pièces acceptées pour un rapprochement OWNER_DIRECT : documents émis par un
// tiers (banque, opérateur). Une capture ou un reçu produit par le
// propriétaire seul est une pièce de contexte, jamais une preuve suffisante.
const COLLECTION_EVIDENCE_KINDS = Object.freeze({
  BANK_STATEMENT: 'BANK_STATEMENT',
  MOBILE_MONEY_STATEMENT: 'MOBILE_MONEY_STATEMENT',
  PROVIDER_TRANSACTION_CONFIRMATION: 'PROVIDER_TRANSACTION_CONFIRMATION',
  OWNER_RECEIPT: 'OWNER_RECEIPT',
  OTHER: 'OTHER',
});
const RECONCILIATION_EVIDENCE_KINDS = Object.freeze(['BANK_STATEMENT', 'MOBILE_MONEY_STATEMENT', 'PROVIDER_TRANSACTION_CONFIRMATION']);

// Pouvoirs exerçables par le propriétaire ou son représentant habilité.
const OWNER_POWERS = Object.freeze({
  VIEW: 'VIEW',
  EXPENSE_DECISION: 'EXPENSE_DECISION',
  REFUND_CONSENT: 'REFUND_CONSENT',
  COLLECTION_CONFIRMATION: 'COLLECTION_CONFIRMATION',
});
const REPRESENTATION_STATUSES = Object.freeze({
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
});
const REPRESENTATION_SOURCES = Object.freeze({ OWNER_IN_APP: 'OWNER_IN_APP', WRITTEN_PROXY: 'WRITTEN_PROXY' });

const OBLIGATION_TYPES = Object.freeze({
  OWNER_PAYOUT: 'OWNER_PAYOUT',
  COMMISSION_RECEIVABLE: 'COMMISSION_RECEIVABLE',
});
const OBLIGATION_LINE_KINDS = Object.freeze({
  RENT_OWNER_SHARE: 'RENT_OWNER_SHARE',
  COMMISSION: 'COMMISSION',
  EXPENSE_DEDUCTION: 'EXPENSE_DEDUCTION',
  EXPENSE_RECOVERABLE: 'EXPENSE_RECOVERABLE',
  OWNER_BORNE_FEE: 'OWNER_BORNE_FEE',
});
// Aucun paiement sortant n'est activé en F-U1.
const OBLIGATION_EXECUTION_STATUS = 'NOT_ENABLED';

const BENEFICIARY_KINDS = Object.freeze({ MOBILE_MONEY: 'MOBILE_MONEY', BANK_ACCOUNT: 'BANK_ACCOUNT' });
const BENEFICIARY_STATUSES = Object.freeze({
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
});

const REFUND_ACTIVITIES = Object.freeze({
  RENTAL_MANAGEMENT: 'RENTAL_MANAGEMENT',
  HOSPITALITY: 'HOSPITALITY',
  REAL_ESTATE_TRANSACTION: 'REAL_ESTATE_TRANSACTION',
  OTHER_FINANCIAL_SERVICE: 'OTHER_FINANCIAL_SERVICE',
});
const REFUND_POLICY_STATUSES = Object.freeze({ UNCONFIGURED: 'unconfigured', ACTIVE: 'active', RETIRED: 'retired' });
const REFUND_SIGNALS = Object.freeze({
  AMOUNT_ABOVE_THRESHOLD: 'AMOUNT_ABOVE_THRESHOLD',
  POLICY_UNCONFIGURED: 'POLICY_UNCONFIGURED',
  HIGH_RISK: 'HIGH_RISK',
  BENEFICIARY_DIFFERS_FROM_PAYER: 'BENEFICIARY_DIFFERS_FROM_PAYER',
  CROSS_BORDER: 'CROSS_BORDER',
  REPEATED_REFUNDS: 'REPEATED_REFUNDS',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
  FRAUD_SUSPECTED: 'FRAUD_SUSPECTED',
  MAJOR_ANOMALY: 'MAJOR_ANOMALY',
});
// Signaux imposant la double validation quel que soit le montant.
const ALWAYS_DUAL_APPROVAL_SIGNALS = Object.freeze([
  REFUND_SIGNALS.AMOUNT_ABOVE_THRESHOLD,
  REFUND_SIGNALS.POLICY_UNCONFIGURED,
  REFUND_SIGNALS.HIGH_RISK,
  REFUND_SIGNALS.BENEFICIARY_DIFFERS_FROM_PAYER,
  REFUND_SIGNALS.CROSS_BORDER,
  REFUND_SIGNALS.REPEATED_REFUNDS,
  REFUND_SIGNALS.MANUAL_OVERRIDE,
]);
// Signaux bloquant toute exécution jusqu'à résolution.
const BLOCKING_REFUND_SIGNALS = Object.freeze([REFUND_SIGNALS.FRAUD_SUSPECTED, REFUND_SIGNALS.MAJOR_ANOMALY]);
const REFUND_CLASSIFICATIONS = Object.freeze({ STANDARD: 'STANDARD', DUAL_APPROVAL: 'DUAL_APPROVAL', BLOCKED: 'BLOCKED' });

// Statuts FinancialRefund ajoutés par F-U1 (extension additive du modèle
// existant). Correspondance avec les états métier :
//   demande créée → requested ; en attente d'approbation → pending_approval ;
//   approuvée → approved ; refusée → refused ; en attente d'exécution →
//   awaiting_execution ; en cours → processing ; confirmée par le prestataire
//   → completed ; échouée → failed ; à rapprocher → to_reconcile ;
//   bloquée (suspicion de fraude) → blocked.
const GOVERNED_REFUND_STATUSES = Object.freeze(['pending_approval', 'refused', 'blocked', 'awaiting_execution', 'to_reconcile']);

// F-U1.H — cycle de vie des habilitations sensibles.
//   proposed → (approbation par une 2e personne) → active | pending_independence
//   pending_independence → active (indépendance établie) ;
//   active ⇄ suspended ; proposed/pending → refused | cancelled ;
//   tout état vivant → revoked | expired.
const GRANT_STATUSES = Object.freeze({
  PROPOSED: 'proposed',
  PENDING_INDEPENDENCE: 'pending_independence',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REFUSED: 'refused',
  CANCELLED: 'cancelled',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});
const LIVE_GRANT_STATUSES = Object.freeze(['proposed', 'pending_independence', 'active', 'suspended']);
const GRANT_SCOPE_TYPES = Object.freeze({ TENANT: 'TENANT', PLATFORM: 'PLATFORM' });
const IDENTITY_DOCUMENT_KINDS = Object.freeze(['NATIONAL_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER_OFFICIAL']);

const ISSUER_SCOPES = Object.freeze({ PLATFORM: 'PLATFORM', TENANT: 'TENANT' });
const ISSUER_IDENTITY_STATUSES = Object.freeze({ UNVERIFIED: 'unverified', VERIFIED: 'verified', RETIRED: 'retired' });

module.exports = {
  MANAGEMENT_OFFERS, COLLECTION_MODES, PAYOUT_FREQUENCIES, SUGGESTED_DRAFT_PAYOUT_FREQUENCY,
  CONTRACT_TIMEZONE, DELEGATED_MANAGEMENT_COMMISSION_BASIS_POINTS, COMMISSION_BASES,
  MANDATARY_TYPES, MANDATE_STATUSES, MANDATE_TRANSITIONS, LIVE_MANDATE_STATUSES,
  FEE_KINDS, FEE_PARTIES, FEE_BEARER_MODES,
  EXPENSE_CAP_PERIODS, EXPENSE_STATUSES, RESERVED_EXPENSE_STATUSES, EXPENSE_CAP_BREACHES,
  EXPENSE_AUTHORIZATION_MODES, WRITTEN_AUTHORIZATION_VERIFICATION_RESULTS,
  COLLECTION_RECORD_STATUSES, COLLECTION_EVIDENCE_KINDS, RECONCILIATION_EVIDENCE_KINDS,
  OWNER_POWERS, REPRESENTATION_STATUSES, REPRESENTATION_SOURCES, OBLIGATION_TYPES, OBLIGATION_LINE_KINDS, OBLIGATION_EXECUTION_STATUS,
  BENEFICIARY_KINDS, BENEFICIARY_STATUSES,
  REFUND_ACTIVITIES, REFUND_POLICY_STATUSES, REFUND_SIGNALS, ALWAYS_DUAL_APPROVAL_SIGNALS,
  BLOCKING_REFUND_SIGNALS, REFUND_CLASSIFICATIONS, GOVERNED_REFUND_STATUSES,
  ISSUER_SCOPES, ISSUER_IDENTITY_STATUSES,
  GRANT_STATUSES, LIVE_GRANT_STATUSES, GRANT_SCOPE_TYPES, IDENTITY_DOCUMENT_KINDS,
};
