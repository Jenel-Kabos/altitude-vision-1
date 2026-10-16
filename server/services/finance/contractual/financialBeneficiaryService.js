// F-U1.D — Référencement et vérification des bénéficiaires financiers.
//
// Aucune coordonnée complète n'est conservée : identifiant masqué + empreinte
// HMAC-SHA256 (clé serveur FINANCIAL_BENEFICIARY_FINGERPRINT_KEY ; absente →
// échec fermé, jamais un hachage faible). La vérification exige une preuve et
// un vérificateur distinct de la personne ayant enregistré le bénéficiaire.

const crypto = require('crypto');
const mongoose = require('mongoose');
const FinancialBeneficiary = require('../../../models/FinancialBeneficiary');
const ManagementMandate = require('../../../models/ManagementMandate');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const authz = require('./contractualFinanceAuthorizationService');
const { resolveOwnerAuthority } = require('./ownerAuthorityService');
const { assertDistinctHumans } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;

function normalizeIdentifier(raw) {
  const value = String(raw || '').replace(/[\s.-]/g, '').toUpperCase();
  if (value.length < 6 || value.length > 40 || !/^[A-Z0-9+]+$/.test(value)) fail('BENEFICIARY_IDENTIFIER_INVALID', 'Identifiant de compte invalide.', 422);
  return value;
}

function fingerprint(identifier, kind) {
  const key = process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY;
  if (!key || key.length < 32) fail('BENEFICIARY_FINGERPRINT_KEY_MISSING', 'Configuration de sécurité des bénéficiaires absente.', 500);
  return crypto.createHmac('sha256', key).update(`${kind}:${identifier}`).digest('hex');
}

const maskIdentifier = (identifier) => `•••${identifier.slice(-4)}`;

function normalizeEvidence(evidence, { required }) {
  const list = Array.isArray(evidence) ? evidence : [];
  if (required && list.length === 0) fail('EVIDENCE_REQUIRED', 'Une pièce justificative est requise.', 422);
  return list.map((item) => {
    if (!String(item?.documentRef || '').trim()) fail('EVIDENCE_REQUIRED', 'Référence de pièce justificative invalide.', 422);
    return { documentRef: String(item.documentRef).trim(), sha256: item.sha256, label: item.label };
  });
}

async function createBeneficiary({ mandataryType, tenant, ownerId, kind, holderName, institution, accountIdentifier, evidence, registeredBy }) {
  if (!Object.values(C.BENEFICIARY_KINDS).includes(kind)) fail('BENEFICIARY_KIND_INVALID', 'Type de bénéficiaire invalide.', 422);
  const identifier = normalizeIdentifier(accountIdentifier);
  try {
    return await FinancialBeneficiary.create({
      mandataryType, tenant, owner: ownerId, kind, holderName, institution,
      maskedIdentifier: maskIdentifier(identifier), accountFingerprint: fingerprint(identifier, kind),
      evidence: normalizeEvidence(evidence, { required: false }), registeredBy,
    });
  } catch (error) {
    if (error?.code === 11000) fail('BENEFICIARY_DUPLICATE', 'Ce compte est déjà référencé pour ce propriétaire.', 409);
    throw error;
  }
}

// Enregistrement par un agent habilité, dans son périmètre d'autorité.
async function registerBeneficiary({ actor, ownerId, ...details }) {
  const authority = await authz.assertContractualCapability(actor, CAP.BENEFICIARY_REGISTER);
  if (!mongoose.isValidObjectId(ownerId)) fail('BENEFICIARY_OWNER_INVALID', 'Propriétaire invalide.', 422);
  return createBeneficiary({
    ...details, ownerId,
    mandataryType: authority.plane === 'PLATFORM' ? C.MANDATARY_TYPES.PLATFORM : C.MANDATARY_TYPES.TENANT,
    tenant: authority.tenantId || null, registeredBy: authority.userId,
  });
}

// Enregistrement par le propriétaire lui-même pour un mandat qui le concerne.
async function registerOwnBeneficiary({ actor, mandateId, ...details }) {
  const mandate = mongoose.isValidObjectId(mandateId) ? await ManagementMandate.findById(mandateId).lean() : null;
  if (!mandate) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Mandat inaccessible.', 404);
  // Le compte de reversement est enregistré par le propriétaire lui-même, jamais
  // par un représentant.
  const owner = await resolveOwnerAuthority({ actor, mandate, power: C.OWNER_POWERS.VIEW });
  if (owner.principal !== 'OWNER') fail('FINANCIAL_OWNER_REQUIRED', 'Seul le propriétaire peut enregistrer son compte.', 403);
  return createBeneficiary({ ...details, ownerId: mandate.owner, mandataryType: mandate.mandataryType, tenant: mandate.tenant, registeredBy: owner.actorId });
}

async function transitionBeneficiary({ actor, beneficiaryId, from, to, update, event, extraCheck }) {
  const beneficiary = mongoose.isValidObjectId(beneficiaryId) ? await FinancialBeneficiary.findById(beneficiaryId) : null;
  const authority = await authz.authorizeOnResource(actor, CAP.BENEFICIARY_VERIFY, beneficiary);
  if (extraCheck) await extraCheck(beneficiary, authority);
  const updated = await FinancialBeneficiary.findOneAndUpdate(
    { _id: beneficiary._id, status: { $in: from } },
    { $set: { status: to, ...update(authority) }, $push: { statusHistory: { from: beneficiary.status, to, action: event, actor: authority.userId, at: new Date() } } },
    { new: true },
  );
  if (!updated) fail('BENEFICIARY_INVALID_TRANSITION', `Transition interdite depuis ${beneficiary.status}.`, 409);
  return updated;
}

function verifyBeneficiary({ actor, beneficiaryId, method, evidence }) {
  if (!String(method || '').trim()) fail('BENEFICIARY_VERIFICATION_METHOD_REQUIRED', 'La méthode de vérification est requise.', 422);
  const proofs = normalizeEvidence(evidence, { required: true });
  return transitionBeneficiary({
    actor, beneficiaryId, from: [C.BENEFICIARY_STATUSES.PENDING_VERIFICATION], to: C.BENEFICIARY_STATUSES.VERIFIED,
    event: 'beneficiary.verified',
    extraCheck: (beneficiary, authority) => assertDistinctHumans({ vérificateur: authority.userId, enregistrement: beneficiary.registeredBy, propriétaire: beneficiary.owner }, { actor: 'vérificateur' }),
    update: (authority) => ({ verifiedBy: authority.userId, verifiedAt: new Date(), verificationMethod: String(method).trim(), evidence: proofs }),
  });
}

function rejectBeneficiary({ actor, beneficiaryId, reason }) {
  if (!String(reason || '').trim()) fail('BENEFICIARY_REASON_REQUIRED', 'Un motif est requis.', 422);
  return transitionBeneficiary({
    actor, beneficiaryId, from: [C.BENEFICIARY_STATUSES.PENDING_VERIFICATION], to: C.BENEFICIARY_STATUSES.REJECTED,
    event: 'beneficiary.rejected', update: (authority) => ({ rejectedBy: authority.userId, rejectedAt: new Date(), statusReason: reason }),
  });
}

function revokeBeneficiary({ actor, beneficiaryId, reason }) {
  if (!String(reason || '').trim()) fail('BENEFICIARY_REASON_REQUIRED', 'Un motif est requis.', 422);
  return transitionBeneficiary({
    actor, beneficiaryId, from: [C.BENEFICIARY_STATUSES.PENDING_VERIFICATION, C.BENEFICIARY_STATUSES.VERIFIED], to: C.BENEFICIARY_STATUSES.REVOKED,
    event: 'beneficiary.revoked', update: (authority) => ({ revokedBy: authority.userId, revokedAt: new Date(), statusReason: reason }),
  });
}

module.exports = { registerBeneficiary, registerOwnBeneficiary, verifyBeneficiary, rejectBeneficiary, revokeBeneficiary, normalizeEvidence };
