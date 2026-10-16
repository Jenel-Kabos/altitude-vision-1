// F-U2.13 — fixture : le bailleur ou l'organisation ADOPTE explicitement pour
// son bail des conditions identiques à celles d'Altitude Vision (politique
// OWNER_AUTONOMOUS, sans consentement plateforme requis). Les suites
// antérieures (F-U2.10 à F-U2.12) reposaient sur ces règles appliquées
// globalement ; elles les obtiennent désormais par une politique explicite.
const { ALTITUDE_DELEGATED_POLICY } = require('../../constants/leasePolicyConstants');
const policies = require('../../services/finance/billing/leasePolicyService');

// Imputation non stipulée : la clause éventuelle du bail (`ordreImputation`) s'applique.
const ADOPTED_TERMS = { ...JSON.parse(JSON.stringify(ALTITUDE_DELEGATED_POLICY.terms)), imputation: null };

function adoptLeasePolicy({ actor, leaseId, terms = ADOPTED_TERMS, effectiveFrom = new Date('2025-01-01T00:00:00+01:00') }) {
  return policies.createPolicy({
    actor, leaseId, type: 'OWNER_AUTONOMOUS', terms, effectiveFrom,
    documentReference: 'Bail fictif — conditions stipulées (fixture)', now: new Date(effectiveFrom.getTime() + 4 * 86400000),
  });
}

module.exports = { adoptLeasePolicy, ADOPTED_TERMS };
