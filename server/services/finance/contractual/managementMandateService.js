// F-U1.B — Cycle de vie, versionnement et résolution contractuelle des mandats.
//
// - Création : brouillon + version 1, dans une transaction. Le mandataire est
//   le contexte d'autorité de l'acteur (TENANT sélectionné ou PLATFORM), jamais
//   un paramètre du client.
// - Avenant : nouvelle version immuable, effective à une date non passée ; les
//   opérations déjà enregistrées gardent leur snapshot.
// - Statut : transitions CAS (draft → active ⇄ suspended → revoked/expired).
//   L'historique horodaté permet de connaître le statut à une date donnée.

const mongoose = require('mongoose');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const FinancialBeneficiary = require('../../../models/FinancialBeneficiary');
const Property = require('../../../models/Property');
const C = require('../../../constants/contractualFinanceConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { appendFinancialLedgerEntry } = require('../financialLedgerService');
const { normalizeMandateTerms, hashTerms } = require('./mandateTermsService');
const authz = require('./contractualFinanceAuthorizationService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf } = authz;
const inSession = (query, session) => (session ? query.session(session) : query);

function suggestDraftTerms() {
  // Suggestion de rédaction uniquement : jamais appliquée à un mandat existant.
  return Object.freeze({ payoutFrequency: C.SUGGESTED_DRAFT_PAYOUT_FREQUENCY, suggestionOnly: true });
}

async function loadPropertyForMandate({ propertyId, ownerId, authority }) {
  if (!mongoose.isValidObjectId(propertyId) || !mongoose.isValidObjectId(ownerId)) fail('MANDATE_PROPERTY_INVALID', 'Bien ou propriétaire invalide.', 422);
  const property = await Property.findById(propertyId).select('owner tenant').lean();
  if (!property) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bien inaccessible.', 404);
  if (String(property.owner) !== String(ownerId)) fail('MANDATE_OWNER_MISMATCH', 'Le mandant doit être le propriétaire du bien.', 422);
  const tenantOk = authority.plane === 'TENANT'
    ? idOf(property.tenant) === String(authority.tenantId)
    : property.tenant == null;
  if (!tenantOk) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bien inaccessible.', 404);
  return property;
}

async function createMandate({ actor, propertyId, ownerId, reference, terms: rawTerms, rentalManagementId = null, idempotencyKey }) {
  const authority = await authz.assertContractualCapability(actor, CAP.MANDATE_MANAGE);
  if (!idempotencyKey) fail('FINANCIAL_IDEMPOTENCY_KEY_REQUIRED', 'Clé d’idempotence requise.', 422);
  await loadPropertyForMandate({ propertyId, ownerId, authority });
  const terms = normalizeMandateTerms(rawTerms);
  const termsHash = hashTerms(terms);
  const businessOperationKey = `mandate.create:${idempotencyKey}`;
  const existing = await ManagementMandate.findOne({ businessOperationKey });
  if (existing) {
    const version = await ManagementMandateVersion.findById(existing.currentVersion).lean();
    if (version?.termsHash !== termsHash || String(existing.property) !== String(propertyId)) fail('FINANCIAL_IDEMPOTENCY_CONFLICT', 'Clé d’idempotence déjà utilisée avec un autre contenu.', 409);
    return { mandate: existing, version, replayed: true };
  }
  const mandataryType = authority.plane === 'PLATFORM' ? C.MANDATARY_TYPES.PLATFORM : C.MANDATARY_TYPES.TENANT;
  return runFinancialOperation({ operationName: 'mandate.create', transactionMode: 'transactional' }, async ({ session }) => {
    const [mandate] = await ManagementMandate.create([{
      mandataryType, tenant: authority.tenantId || null, owner: ownerId, property: propertyId,
      rentalManagement: rentalManagementId, reference, status: C.MANDATE_STATUSES.DRAFT,
      statusHistory: [{ from: null, to: C.MANDATE_STATUSES.DRAFT, actor: authority.userId, reason: 'creation' }],
      createdBy: authority.userId, businessOperationKey,
    }], { session });
    const [version] = await ManagementMandateVersion.create([{
      mandate: mandate._id, versionNumber: 1, terms, termsHash,
      effectiveFrom: terms.effectiveFrom, effectiveTo: terms.effectiveTo, createdBy: authority.userId,
    }], { session });
    mandate.currentVersion = version._id;
    mandate.currentVersionNumber = 1;
    await mandate.save({ session });
    return { mandate, version, replayed: false };
  });
}

async function loadMandateForActor(actor, mandateId, capability) {
  if (!mongoose.isValidObjectId(mandateId)) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Mandat inaccessible.', 404);
  const mandate = await ManagementMandate.findById(mandateId);
  const authority = await authz.authorizeOnResource(actor, capability, mandate);
  return { mandate, authority };
}

async function assertBeneficiaryVerifiedFor(mandate, beneficiaryId) {
  const beneficiary = await FinancialBeneficiary.findById(beneficiaryId).lean();
  if (!beneficiary || String(beneficiary.owner) !== String(mandate.owner)
    || beneficiary.mandataryType !== mandate.mandataryType || idOf(beneficiary.tenant) !== idOf(mandate.tenant)) {
    fail('BENEFICIARY_SCOPE_MISMATCH', 'Le bénéficiaire doit appartenir au mandant, dans le même périmètre.', 422);
  }
  if (beneficiary.status !== C.BENEFICIARY_STATUSES.VERIFIED) fail('BENEFICIARY_NOT_VERIFIED', 'Le bénéficiaire doit être vérifié.', 409);
  return beneficiary;
}

async function assertActivationPrerequisites(mandate) {
  const version = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
  if (!version) fail('MANDATE_VERSION_MISSING', 'Version contractuelle introuvable.', 409);
  const { terms } = version;
  if (terms.offer === C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    await assertBeneficiaryVerifiedFor(mandate, terms.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION ? terms.payoutBeneficiary : terms.ownerDirectAccount);
  }
  return version;
}

async function transitionMandate({ actor, mandateId, to, reason, at = new Date() }) {
  const { mandate, authority } = await loadMandateForActor(actor, mandateId, CAP.MANDATE_MANAGE);
  const from = mandate.status;
  if (!(C.MANDATE_TRANSITIONS[from] || []).includes(to)) fail('MANDATE_INVALID_TRANSITION', `Transition de mandat interdite : ${from} → ${to}.`, 409);
  if (to === C.MANDATE_STATUSES.ACTIVE) await assertActivationPrerequisites(mandate);
  if ([C.MANDATE_STATUSES.SUSPENDED, C.MANDATE_STATUSES.REVOKED].includes(to) && !String(reason || '').trim()) {
    fail('MANDATE_REASON_REQUIRED', 'Un motif est requis.', 422);
  }
  const updated = await ManagementMandate.findOneAndUpdate(
    { _id: mandate._id, status: from },
    { $set: { status: to }, $push: { statusHistory: { from, to, actor: authority.userId, reason, at } } },
    { new: true },
  );
  if (!updated) fail('MANDATE_CONCURRENT_TRANSITION', 'Le mandat a changé entre-temps.', 409);
  await appendFinancialLedgerEntry({
    eventType: `mandate.${to}`, domain: 'rental', establishmentType: 'Property', establishmentId: updated.property,
    entityType: 'ManagementMandate', entityId: updated._id, actorType: 'user', actorId: authority.userId,
    businessOperationKey: `mandate.transition:${updated._id}:${updated.statusHistory.length}`,
    previousState: { status: from }, newState: { status: to }, metadata: { reason: reason || null },
  });
  return updated;
}

const activateMandate = (params) => transitionMandate({ ...params, to: C.MANDATE_STATUSES.ACTIVE });
const suspendMandate = (params) => transitionMandate({ ...params, to: C.MANDATE_STATUSES.SUSPENDED });
const revokeMandate = (params) => transitionMandate({ ...params, to: C.MANDATE_STATUSES.REVOKED });
const expireMandate = (params) => transitionMandate({ ...params, to: C.MANDATE_STATUSES.EXPIRED });

async function amendMandate({ actor, mandateId, terms: rawTerms, reason, now = new Date() }) {
  const { mandate, authority } = await loadMandateForActor(actor, mandateId, CAP.MANDATE_MANAGE);
  if (![C.MANDATE_STATUSES.DRAFT, C.MANDATE_STATUSES.ACTIVE, C.MANDATE_STATUSES.SUSPENDED].includes(mandate.status)) {
    fail('MANDATE_INVALID_TRANSITION', 'Un mandat clos ne peut plus être modifié.', 409);
  }
  if (!String(reason || '').trim()) fail('MANDATE_REASON_REQUIRED', 'Le motif de l’avenant est requis.', 422);
  const terms = normalizeMandateTerms(rawTerms);
  const current = await ManagementMandateVersion.findById(mandate.currentVersion).lean();
  if (terms.offer !== current.terms.offer) fail('MANDATE_OFFER_CHANGE_FORBIDDEN', 'Changer d’offre exige un nouveau mandat.', 422);
  if (terms.effectiveFrom < now || terms.effectiveFrom <= new Date(current.effectiveFrom)) {
    fail('MANDATE_RETROACTIVE_AMENDMENT_FORBIDDEN', 'Un avenant ne peut pas prendre effet dans le passé.', 422);
  }
  if (mandate.status !== C.MANDATE_STATUSES.DRAFT && terms.offer === C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    await assertBeneficiaryVerifiedFor(mandate, terms.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION ? terms.payoutBeneficiary : terms.ownerDirectAccount);
  }
  const nextNumber = mandate.currentVersionNumber + 1;
  return runFinancialOperation({ operationName: 'mandate.amend', transactionMode: 'transactional' }, async ({ session }) => {
    const [version] = await ManagementMandateVersion.create([{
      mandate: mandate._id, versionNumber: nextNumber, terms, termsHash: hashTerms(terms),
      effectiveFrom: terms.effectiveFrom, effectiveTo: terms.effectiveTo, supersedes: current._id,
      amendmentReason: reason, createdBy: authority.userId,
    }], { session });
    const updated = await ManagementMandate.findOneAndUpdate(
      { _id: mandate._id, currentVersionNumber: mandate.currentVersionNumber },
      { $set: { currentVersion: version._id, currentVersionNumber: nextNumber } },
      { new: true, session },
    );
    if (!updated) fail('MANDATE_CONCURRENT_AMENDMENT', 'Un autre avenant a été enregistré entre-temps.', 409);
    return { mandate: updated, version };
  });
}

// Statut du mandat à une date donnée, reconstitué depuis l'historique.
function mandateStatusAt(mandate, at) {
  const time = new Date(at).getTime();
  let status = null;
  for (const entry of mandate.statusHistory || []) {
    if (new Date(entry.at).getTime() <= time) status = entry.to;
  }
  return status;
}

async function resolveVersionAt(mandate, at, { session } = {}) {
  const versions = await inSession(ManagementMandateVersion.find({ mandate: mandate._id, effectiveFrom: { $lte: at } }).sort({ versionNumber: -1 }).limit(1).lean(), session);
  const version = versions[0];
  if (!version) fail('MANDATE_NOT_IN_EFFECT', 'Aucune version du mandat n’était en vigueur à cette date.', 409);
  if (version.terms.effectiveTo && new Date(version.terms.effectiveTo) <= at) fail('MANDATE_EXPIRED', 'Le mandat était échu à cette date.', 409);
  return version;
}

// Garde unique des opérations : le mandat doit être actif à la date de
// l'opération ET avoir une version en vigueur non échue.
async function assertMandateOperableAt(mandate, at, { session } = {}) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) fail('MANDATE_DATE_INVALID', 'Date d’opération invalide.', 422);
  const status = mandateStatusAt(mandate, date);
  if (status !== C.MANDATE_STATUSES.ACTIVE) {
    const code = { suspended: 'MANDATE_SUSPENDED', revoked: 'MANDATE_REVOKED', expired: 'MANDATE_EXPIRED', draft: 'MANDATE_NOT_ACTIVE' }[status] || 'MANDATE_NOT_ACTIVE';
    fail(code, `Le mandat n’est pas actif (${status || 'inexistant'}) à cette date.`, 409);
  }
  const version = await resolveVersionAt(mandate, date, { session });
  return { version, terms: version.terms };
}

function effectiveMandateStatus(mandate, version, now = new Date()) {
  if (mandate.status === C.MANDATE_STATUSES.ACTIVE && version?.terms?.effectiveTo && new Date(version.terms.effectiveTo) <= now) return C.MANDATE_STATUSES.EXPIRED;
  return mandate.status;
}

module.exports = {
  suggestDraftTerms, createMandate, activateMandate, suspendMandate, revokeMandate, expireMandate,
  amendMandate, mandateStatusAt, resolveVersionAt, assertMandateOperableAt, effectiveMandateStatus,
  loadMandateForActor, assertBeneficiaryVerifiedFor,
};
