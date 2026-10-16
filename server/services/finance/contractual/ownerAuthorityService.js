// F-U1.G — Autorité du propriétaire (ou de son représentant habilité),
// fondée sur la ressource et indépendante de toute capacité staff/plateforme.
//
// Vérifie côté serveur, à chaque action :
//   1. l'identité authentifiée (acteur porteur d'un identifiant) ;
//   2. le lien avec le bien : Property.owner est TOUJOURS le mandant du mandat
//      (un changement de propriétaire rompt l'autorité) ;
//   3. le mandat actif pour les pouvoirs de décision (VIEW n'en dépend pas) ;
//   4. la portée exacte : mandat listé et pouvoir accordé pour un représentant,
//      dans sa période de validité ;
//   5. l'absence de conflit de rôles : un représentant ne peut être ni membre
//      du mandataire TENANT, ni opérateur plateforme pour un mandat PLATFORM.
// Jamais User.role, jamais un tenantId client, jamais la possession d'une URL.
// Les capacités platform.finance.* ne donnent aucun accès à ce chemin.

const mongoose = require('mongoose');
const Property = require('../../../models/Property');
const ManagementMandate = require('../../../models/ManagementMandate');
const OwnerRepresentation = require('../../../models/OwnerRepresentation');
const OrgMembership = require('../../../models/OrgMembership');
const PlatformTenant = require('../../../models/PlatformTenant');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { resolveActiveOperator } = require('../../platformOperator/platformOperatorService');
const { mandateStatusAt } = require('./managementMandateService');
const { assertDistinctHumans } = require('./humanIdentityService');
const authz = require('./contractualFinanceAuthorizationService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const P = C.OWNER_POWERS;
const DECISION_POWERS = [P.EXPENSE_DECISION, P.REFUND_CONSENT, P.COLLECTION_CONFIRMATION];
const denied = () => fail('FINANCIAL_OWNER_REQUIRED', 'Seul le propriétaire concerné ou son représentant habilité peut effectuer cette action.', 403);

async function hasMandataryRoleConflict(userId, mandate) {
  if (mandate.mandataryType === C.MANDATARY_TYPES.PLATFORM) return Boolean(await resolveActiveOperator(userId));
  const tenant = await PlatformTenant.findById(mandate.tenant).select('rootOrgUnit').lean();
  if (!tenant?.rootOrgUnit) return false;
  return Boolean(await OrgMembership.exists({ user: userId, orgUnit: tenant.rootOrgUnit, status: 'active' }));
}

async function assertOwnerLink(mandate) {
  const property = await Property.findById(mandate.property).select('owner').lean();
  if (!property || String(property.owner) !== String(mandate.owner)) {
    fail('OWNER_LINK_BROKEN', 'Le mandant n’est plus le propriétaire du bien : autorité suspendue.', 409);
  }
}

async function resolveOwnerAuthority({ actor, mandate, power, now = new Date() }) {
  const actorId = idOf(actor);
  if (!actorId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!Object.values(P).includes(power)) fail('OWNER_POWER_UNKNOWN', 'Pouvoir inconnu.', 500);
  if (!mandate) denied();
  await assertOwnerLink(mandate);
  if (DECISION_POWERS.includes(power) && mandateStatusAt(mandate, now) !== C.MANDATE_STATUSES.ACTIVE) {
    fail('MANDATE_NOT_ACTIVE', 'Le mandat doit être actif pour cette décision.', 409);
  }
  if (actorId === idOf(mandate.owner)) return { principal: 'OWNER', actorId, ownerId: actorId, representation: null };
  const representation = await OwnerRepresentation.findOne({
    owner: mandate.owner, representative: actorId, status: C.REPRESENTATION_STATUSES.ACTIVE,
    mandates: mandate._id, powers: power, validFrom: { $lte: now }, validUntil: { $gt: now },
  }).lean();
  if (!representation) denied();
  if (await hasMandataryRoleConflict(actorId, mandate)) {
    fail('REPRESENTATION_ROLE_CONFLICT', 'Un représentant ne peut pas appartenir au mandataire.', 403);
  }
  return { principal: 'REPRESENTATIVE', actorId, ownerId: idOf(mandate.owner), representation: representation._id };
}

// Lecture : propriétaire/représentant (pouvoir VIEW) OU staff CONTRACT_READ
// dans le périmètre du mandat.
async function authorizeMandateRead(actor, mandate) {
  try {
    return { viewer: 'OWNER_SIDE', ...(await resolveOwnerAuthority({ actor, mandate, power: P.VIEW })) };
  } catch (error) {
    if (!['FINANCIAL_OWNER_REQUIRED', 'REPRESENTATION_ROLE_CONFLICT'].includes(error.code)) throw error;
  }
  const authority = await authz.authorizeOnResource(actor, CAP.CONTRACT_READ, mandate);
  return { viewer: 'STAFF', actorId: authority.userId, authority };
}

function normalizeRepresentationInput({ mandateIds, powers, validUntil, now }) {
  const ids = [...new Set((mandateIds || []).map(String))];
  if (!ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) fail('REPRESENTATION_SCOPE_INVALID', 'Mandats désignés invalides.', 422);
  const list = [...new Set(powers || [])];
  if (!list.length || list.some((power) => !Object.values(P).includes(power))) fail('REPRESENTATION_SCOPE_INVALID', 'Pouvoirs invalides.', 422);
  const until = new Date(validUntil);
  if (Number.isNaN(until.getTime()) || until <= now) fail('REPRESENTATION_SCOPE_INVALID', 'Une date de fin de validité future est requise.', 422);
  return { ids, list, until };
}

async function loadOwnedMandates(ids, ownerId) {
  const mandates = await ManagementMandate.find({ _id: { $in: ids } }).lean();
  if (mandates.length !== ids.length || mandates.some((mandate) => idOf(mandate.owner) !== String(ownerId))) {
    fail('REPRESENTATION_SCOPE_INVALID', 'Chaque mandat désigné doit appartenir au propriétaire.', 422);
  }
  return mandates;
}

async function assertNoRoleConflict(representativeId, mandates) {
  for (const mandate of mandates) {
    if (await hasMandataryRoleConflict(representativeId, mandate)) fail('REPRESENTATION_ROLE_CONFLICT', 'Le représentant ne peut pas appartenir au mandataire.', 403);
  }
}

// Désignation par le propriétaire authentifié lui-même (pas de sous-délégation).
async function designateRepresentative({ actor, representativeUserId, mandateIds, powers, validUntil, now = new Date() }) {
  const ownerId = idOf(actor);
  if (!ownerId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!mongoose.isValidObjectId(representativeUserId)) fail('REPRESENTATION_SCOPE_INVALID', 'Représentant invalide.', 422);
  const { ids, list, until } = normalizeRepresentationInput({ mandateIds, powers, validUntil, now });
  const mandates = await loadOwnedMandates(ids, ownerId);
  for (const mandate of mandates) await assertOwnerLink(mandate);
  await assertDistinctHumans({ propriétaire: ownerId, représentant: representativeUserId });
  await assertNoRoleConflict(representativeUserId, mandates);
  return OwnerRepresentation.create({
    owner: ownerId, representative: representativeUserId, mandates: ids, powers: list,
    status: C.REPRESENTATION_STATUSES.ACTIVE, source: C.REPRESENTATION_SOURCES.OWNER_IN_APP,
    validFrom: now, validUntil: until, createdBy: ownerId,
  });
}

// Procuration écrite : enregistrée par un agent du mandataire, sans effet
// tant qu'une personne habilitée distincte ne l'a pas vérifiée.
async function registerWrittenProxy({ actor, ownerId, representativeUserId, mandateIds, powers, validUntil, document, now = new Date() }) {
  const { ids, list, until } = normalizeRepresentationInput({ mandateIds, powers, validUntil, now });
  const mandates = await loadOwnedMandates(ids, ownerId);
  for (const mandate of mandates) await authz.authorizeOnResource(actor, CAP.CONTRACT_READ, mandate);
  if (!String(document?.documentRef || '').trim() || !document?.signedAt) fail('WRITTEN_AUTHORIZATION_DOCUMENT_REQUIRED', 'Procuration signée requise.', 422);
  await assertDistinctHumans({ propriétaire: ownerId, représentant: representativeUserId, agent: idOf(actor) });
  await assertNoRoleConflict(representativeUserId, mandates);
  return OwnerRepresentation.create({
    owner: ownerId, representative: representativeUserId, mandates: ids, powers: list,
    status: C.REPRESENTATION_STATUSES.PENDING_VERIFICATION, source: C.REPRESENTATION_SOURCES.WRITTEN_PROXY,
    validFrom: now, validUntil: until, proxyDocument: { documentRef: String(document.documentRef).trim(), sha256: document.sha256, signedAt: new Date(document.signedAt) },
    createdBy: idOf(actor),
  });
}

async function verifyWrittenProxy({ actor, representationId, method }) {
  const representation = mongoose.isValidObjectId(representationId) ? await OwnerRepresentation.findById(representationId) : null;
  if (!representation || representation.status !== C.REPRESENTATION_STATUSES.PENDING_VERIFICATION) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Procuration inaccessible.', 404);
  const mandates = await ManagementMandate.find({ _id: { $in: representation.mandates } }).lean();
  let authority;
  for (const mandate of mandates) authority = await authz.authorizeOnResource(actor, CAP.REPRESENTATION_VERIFY, mandate);
  if (!String(method || '').trim()) fail('WRITTEN_AUTHORIZATION_VERIFICATION_REQUIRED', 'Méthode de vérification requise.', 422);
  await assertDistinctHumans({ vérificateur: authority.userId, agent: representation.createdBy, propriétaire: representation.owner, représentant: representation.representative }, { actor: 'vérificateur' });
  await assertNoRoleConflict(representation.representative, mandates);
  const verified = await OwnerRepresentation.findOneAndUpdate(
    { _id: representation._id, status: C.REPRESENTATION_STATUSES.PENDING_VERIFICATION },
    { $set: { status: C.REPRESENTATION_STATUSES.ACTIVE, verifiedBy: authority.userId, verifiedAt: new Date(), verificationMethod: String(method).trim() } },
    { new: true },
  );
  if (!verified) fail('REPRESENTATION_INVALID_TRANSITION', 'Procuration déjà traitée.', 409);
  return verified;
}

async function revokeRepresentation({ actor, representationId, reason }) {
  const ownerId = idOf(actor);
  const revoked = mongoose.isValidObjectId(representationId) ? await OwnerRepresentation.findOneAndUpdate(
    { _id: representationId, owner: ownerId, status: { $in: [C.REPRESENTATION_STATUSES.ACTIVE, C.REPRESENTATION_STATUSES.PENDING_VERIFICATION] } },
    { $set: { status: C.REPRESENTATION_STATUSES.REVOKED, revokedBy: ownerId, revokedAt: new Date(), statusReason: reason } },
    { new: true },
  ) : null;
  if (!revoked) denied();
  return revoked;
}

module.exports = {
  resolveOwnerAuthority, authorizeMandateRead, designateRepresentative, registerWrittenProxy,
  verifyWrittenProxy, revokeRepresentation, hasMandataryRoleConflict,
};
