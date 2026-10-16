// F-U2.10 — Calendrier locatif, prorata, pénalité de retard et recouvrement.
// Règles VALIDÉES (politique Altimmo) et règles PROPOSÉES (en attente de
// décision : jamais appliquées, l'opération est bloquée avec un état explicite).

const RENT_CALENDAR_POLICY = Object.freeze({
  version: 'ALTIMMO-LOYER-2026-10-B',
  timeZone: 'Africa/Brazzaville', // UTC+1 toute l'année (pas d'heure d'été)
  // Paiement à terme échu : exigible à la clôture conventionnelle du mois.
  billingDay: 30, // mois de 30 et 31 jours (le 31 inclus sans supplément)
  februaryBillingDay: 'LAST_DAY', // 28, ou 29 en année bissextile (validé F-U2.11)
  dueDayNextMonth: 5, // tolérance jusqu'au 5 du mois suivant inclus
  lateFromDayNextMonth: 6, // retard à partir du 6
  formalNoticeDayNextMonth: 25, // mise en demeure conditionnelle le 25
});

// Base conventionnelle de 30 jours pour TOUS les mois (validé F-U2.11) : un
// mois complet = un loyer, jamais de supplément lié au nombre réel de jours.
const RENT_PRORATA_POLICY = Object.freeze({
  version: 'ALTIMMO-PRORATA-2026-10-B',
  baseDays: 30,
  rules: Object.freeze({
    // Validé : (30 − jour d'entrée + 1) / 30 — 21 avril : 50 000 / 150 000.
    THIRTY_DAY_BASE: { status: 'VALIDATED', description: 'Mois de 30 ou 31 jours : (30 − jour d’entrée + 1) / 30' },
    // Validé : entrée le 31 → aucun montant ce mois-ci, premier loyer complet le mois suivant.
    ENTRY_ON_31: { status: 'VALIDATED', description: 'Entrée le 31 : aucun supplément, premier loyer complet à la fin du mois suivant' },
    // Validé F-U2.12 : février en base 30, jours manquants rattachés à la fin
    // du mois (28 → 3/30, 29 bissextile → 2/30 ; mois complet = un loyer).
    FEBRUARY_CONVENTIONAL: { status: 'VALIDATED', description: 'Février : (30 − jour d’entrée + 1) / 30, jours manquants rattachés à la fin du mois' },
    // Validé F-U2.12 : sortie au prorata seulement sur fondement (clause du
    // bail, accord de sortie validé, disposition légale) — date de fin
    // d'obligation locative ; sinon le mois reste dû.
    EXIT_WITH_BASIS: { status: 'VALIDATED', description: 'Sortie : jours 1 → fin d’obligation (plafond 30) / 30, sur fondement documenté' },
    // Validé F-U2.12 : changement de loyer — fractions conventionnelles
    // (16 avril : 15/30 ancien + 15/30 nouveau).
    RENT_CHANGE_SEGMENTS: { status: 'VALIDATED', description: 'Changement de loyer : fractions /30 par montant contractuel, sans chevauchement' },
  }),
  // Charges : seules les charges périodiques (forfait, provision) suivent le
  // prorata ; au réel / individualisées / exceptionnelles : hors facture
  // mensuelle automatique ; nature inconnue + mois partiel : bloqué.
  proratableChargeNatures: Object.freeze(['forfait', 'provision']),
  excludedChargeNatures: Object.freeze(['reel', 'individualisee', 'exceptionnelle']),
});

// Pénalité : 3 % du loyer principal impayé à l'expiration du 5.
// Base juridique NON VALIDÉE : montant prévisionnel uniquement, jamais exigible.
const RENT_PENALTY_POLICY = Object.freeze({
  version: 'ALTIMMO-PENALITE-2026-10',
  rateBasisPoints: 300,
  legalStatus: 'NOT_VALIDATED',
  // Imputation validée (F-U2.12) : 1. instruction explicite valide du
  // paiement ; 2. clause du bail (`ordreImputation`) ; 3. à défaut, loyer
  // principal avant les charges, dans l'ordre des confirmations.
  imputationRule: 'EXPLICIT_THEN_CONTRACT_THEN_RENT_FIRST',
});

// Mise en demeure : projet uniquement tant que la validation juridique manque.
const FORMAL_NOTICE_POLICY = Object.freeze({
  version: 'ALTIMMO-MED-2026-10',
  legalValidation: 'NOT_VALIDATED',
  automaticSending: false,
});

const PENALTY_STATUSES = Object.freeze(['NOT_APPLICABLE', 'SIMULATED', 'PENDING_VALIDATION', 'PENDING_IMPUTATION_DECISION', 'LEGACY_PENALTY_EXISTS', 'NO_CONTRACTUAL_PENALTY', 'POLICY_CONSENT_MISSING', 'PENDING_RECEIPT_CONFIRMATION']);
const DIFFICULTY_REPORT_STATUSES = Object.freeze(['submitted', 'acknowledged', 'deferral_approved', 'closed']);
const COLLECTION_CASE_STATUSES = Object.freeze(['evaluating', 'settled', 'notice_suspended', 'notice_draft_prepared', 'blocked_policy', 'closed']);

module.exports = {
  RENT_CALENDAR_POLICY, RENT_PRORATA_POLICY, RENT_PENALTY_POLICY, FORMAL_NOTICE_POLICY,
  PENALTY_STATUSES, DIFFICULTY_REPORT_STATUSES, COLLECTION_CASE_STATUSES,
};
