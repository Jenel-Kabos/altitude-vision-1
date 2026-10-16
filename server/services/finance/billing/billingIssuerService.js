// F-U2.5 — Résolution de l'émetteur légal d'un document de facturation.
//
// L'émetteur est déterminé par la relation commerciale (rôle PLATFORM =
// Altitude Vision, rôle TENANT = organisation), jamais présumé. Seule une
// identité légale VÉRIFIÉE (FinancialIssuerIdentity, F-U1) permet l'émission
// définitive ; son contenu est recopié (snapshot) dans le document émis et
// n'est plus jamais relu pour ce document.

const { fail } = require('../financialError');
const { resolveIssuerForLegalDocument } = require('../contractual/financialIssuerIdentityService');
const { PLATFORM_ISSUER_ANCHOR } = require('../../../constants/billingConstants');

const idOf = (value) => (value?._id ?? value ?? null);

async function resolveIssuer(plan) {
  if (!plan?.role) fail('BILLING_ISSUER_NOT_SUPPORTED', 'Aucun émetteur légal pris en charge pour ce document (ex. bailleur personne physique) : brouillon uniquement.', 409);
  const identity = await resolveIssuerForLegalDocument({ scope: plan.role, tenantId: plan.role === 'TENANT' ? idOf(plan.tenantId) : null });
  return {
    identityId: identity._id,
    version: identity.version,
    scope: identity.scope,
    tenant: identity.tenant || null,
    sequenceAnchor: plan.role === 'PLATFORM' ? PLATFORM_ISSUER_ANCHOR : idOf(plan.tenantId),
    seller: {
      name: identity.legalName, address: identity.address, phone: identity.phone, taxIdentifier: identity.niu,
      legalInformation: `RCCM ${identity.rccm} — NIU ${identity.niu}`,
    },
  };
}

async function issuerReadiness(plan) {
  try {
    const issuer = await resolveIssuer(plan);
    return { ready: true, issuer: { scope: issuer.scope, version: issuer.version, name: issuer.seller.name } };
  } catch (error) {
    return { ready: false, reason: error.code };
  }
}

module.exports = { resolveIssuer, issuerReadiness };
