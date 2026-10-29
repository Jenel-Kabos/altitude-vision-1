// F-U2.13 — Politiques contractuelles de bail (une par bail et par période).
//
//   ALTITUDE_DELEGATED : gestion déléguée À ALTITUDE VISION (mandat de gestion
//     déléguée, mandataire PLATFORM). Conditions Altitude Vision validées par la
//     direction, non modifiables par le client ; opposables au locataire
//     seulement après son acceptation explicite (consentement électronique).
//   OWNER_AUTONOMOUS : conditions propres au bail (bailleur autonome, organisation
//     en gestion autonome, ou mandataire tiers). Aucune valeur Altitude Vision
//     n'est présumée : un champ absent = aucune règle.
//
// Sans politique résolue pour une période : POLICY_UNRESOLVED — suivi des
// loyers seulement, ni échéance supposée, ni pénalité, ni mise en demeure.

const POLICY_TYPES = Object.freeze({ ALTITUDE_DELEGATED: 'ALTITUDE_DELEGATED', OWNER_AUTONOMOUS: 'OWNER_AUTONOMOUS' });

const ALTITUDE_DELEGATED_POLICY = Object.freeze({
  version: 'ALTITUDE-DELEGUE-2026-10',
  decisionReference: 'Politique de gestion et de recouvrement Altitude Vision (gestion déléguée) — validée par la direction',
  terms: Object.freeze({
    due: Object.freeze({ day: 'END', monthOffset: 0 }), // terme échu : le 30, février le dernier jour
    grace: Object.freeze({ day: 5, monthOffset: 1 }), // tolérance jusqu'au 5 inclus
    penalty: Object.freeze({ rateBasisPoints: 300, base: 'UNPAID_RENT_PRINCIPAL' }), // une seule, à partir du 6
    formalNotice: Object.freeze({ day: 25, monthOffset: 1, suspendOnDifficultyReport: true, suspendOnApprovedDeferral: true }),
    prorata: Object.freeze({ method: 'CONVENTIONAL_30' }),
    imputation: 'RENT_FIRST',
  }),
});

// GIT-INTEGRATION-02A — Politique de retard obligatoire Altimmo (décision de la
// direction) : loyer exigible au plus tard le 5, pénalité unique de 3 % du loyer
// impayé à partir du 6. Centralisée côté serveur : ni le bailleur ni le
// locataire ne peuvent en modifier le taux ni la neutraliser par une option de
// bail. Appliquée par le moteur actif (LEGACY) ; un cas que le code ne peut pas
// trancher juridiquement est signalé pour traitement humain, jamais exonéré.
const ALTIMMO_MANDATORY_LATE_PENALTY = Object.freeze({
  reference: 'ALTIMMO-RETARD-2026-10',
  decisionReference: 'Décision de la direction Altitude Vision — pénalité obligatoire de 3 % à partir du 6',
  rateBasisPoints: ALTITUDE_DELEGATED_POLICY.terms.penalty.rateBasisPoints,
  base: 'UNPAID_RENT_PRINCIPAL',
  lastDueDay: 5,
  firstPenaltyDay: 6,
});

// Méthodes techniquement prises en charge pour les conditions autonomes.
const SUPPORTED = Object.freeze({
  penaltyBases: ['UNPAID_RENT_PRINCIPAL'],
  prorataMethods: ['CONVENTIONAL_30'],
  imputations: ['RENT_FIRST', 'CHARGES_FIRST'],
});

const CONSENT_STATUSES = ['PRESENTED', 'ACCEPTED'];
const PRESENTATION_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = { POLICY_TYPES, ALTITUDE_DELEGATED_POLICY, ALTIMMO_MANDATORY_LATE_PENALTY, SUPPORTED, CONSENT_STATUSES, PRESENTATION_TTL_MS };
