// F-U1 §12 — Identité légale des émetteurs de documents financiers.
//
// Les informations administratives d'Altitude Vision communiquées par la
// direction sont fournies comme PROPOSITION de saisie (non vérifiée) : elles ne
// sont jamais écrites automatiquement en base et ne sont utilisables sur un
// document opposable qu'après enregistrement puis vérification par une
// personne distincte. Aucun taux de taxe ni règle de TVA n'est défini ici.

const mongoose = require('mongoose');
const FinancialIssuerIdentity = require('../../../models/FinancialIssuerIdentity');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const authz = require('./contractualFinanceAuthorizationService');
const { assertDistinctHumans } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;

const ALTITUDE_VISION_PROVIDED_IDENTITY = Object.freeze({
  legalName: 'Altitude Vision',
  rccm: 'CG-BZV-01-2023-A10-02138',
  niu: 'P230000003401863',
  phone: '+242 06 800 21 51',
  address: '24, rue Mfoa, Poto-Poto, Brazzaville, Congo',
  source: 'Informations administratives communiquées par la direction (F-U1) — à vérifier sur pièces',
  verificationStatus: 'UNVERIFIED',
});

async function registerIssuerIdentity({ actor, legalName, rccm, niu, phone, address, source }) {
  const authority = await authz.assertContractualCapability(actor, CAP.ISSUER_IDENTITY_MANAGE);
  const scope = authority.plane === 'PLATFORM' ? C.ISSUER_SCOPES.PLATFORM : C.ISSUER_SCOPES.TENANT;
  const tenant = authority.tenantId || null;
  const last = await FinancialIssuerIdentity.findOne({ scope, tenant }).sort({ version: -1 }).lean();
  return FinancialIssuerIdentity.create({
    scope, tenant, version: (last?.version || 0) + 1, legalName, rccm, niu, phone, address, source, registeredBy: authority.userId,
  });
}

async function verifyIssuerIdentity({ actor, identityId, evidenceRef }) {
  const identity = mongoose.isValidObjectId(identityId) ? await FinancialIssuerIdentity.findById(identityId) : null;
  const authority = await authz.authorizeOnResource(actor, CAP.ISSUER_IDENTITY_MANAGE, identity, { mandataryType: identity?.scope });
  await assertDistinctHumans({ vérificateur: authority.userId, saisie: identity.registeredBy });
  if (!String(evidenceRef || '').trim()) fail('EVIDENCE_REQUIRED', 'Référence des pièces justificatives (RCCM, NIU) requise.', 422);
  if (identity.status !== C.ISSUER_IDENTITY_STATUSES.UNVERIFIED) fail('ISSUER_IDENTITY_INVALID_TRANSITION', 'Identité déjà traitée.', 409);
  await FinancialIssuerIdentity.updateMany(
    { scope: identity.scope, tenant: identity.tenant, status: C.ISSUER_IDENTITY_STATUSES.VERIFIED },
    { $set: { status: C.ISSUER_IDENTITY_STATUSES.RETIRED } },
  );
  return FinancialIssuerIdentity.findOneAndUpdate(
    { _id: identity._id, status: C.ISSUER_IDENTITY_STATUSES.UNVERIFIED },
    { $set: { status: C.ISSUER_IDENTITY_STATUSES.VERIFIED, verifiedBy: authority.userId, verifiedAt: new Date(), verificationEvidenceRef: String(evidenceRef).trim() } },
    { new: true },
  );
}

// À appeler par tout générateur de document opposable : l'émetteur est choisi
// explicitement par l'appelant selon le contrat et le service, jamais déduit.
async function resolveIssuerForLegalDocument({ scope, tenantId = null }) {
  if (!Object.values(C.ISSUER_SCOPES).includes(scope)) fail('ISSUER_SCOPE_REQUIRED', 'Qualité d’émetteur à préciser explicitement.', 422);
  const identity = await FinancialIssuerIdentity.findOne({ scope, tenant: scope === C.ISSUER_SCOPES.TENANT ? tenantId : null, status: C.ISSUER_IDENTITY_STATUSES.VERIFIED }).lean();
  if (!identity) fail('ISSUER_IDENTITY_NOT_VERIFIED', 'Aucune identité légale vérifiée pour cet émetteur.', 409);
  return identity;
}

module.exports = { ALTITUDE_VISION_PROVIDED_IDENTITY, registerIssuerIdentity, verifyIssuerIdentity, resolveIssuerForLegalDocument };
