// F-U1.I — KYC financier à deux niveaux.
//
// Niveau 1 (préparation) : la personne concernée pour son propre dossier, ou
// un membre de son organisation porteur de `contractual.kyc.prepare` (TENANT).
// Niveau 2 (décision) : exclusivement un agent Altitude Vision porteur de
// `contractual.kyc.attest` (PLATFORM), agissant en vue plateforme, disposant
// lui-même d'une identité attestée, sans lien avec l'organisation préparatrice
// ni avec la personne concernée.
//
// KYC approuvé ≠ habilitation : l'approbation crée UNIQUEMENT une
// HumanIdentityAttestation. Aucune capacité n'est accordée ici.
//
// Toutes les transitions sont CAS (statut + révision) ; les décisions et
// consultations sensibles sont historisées ; aucune donnée d'identité en clair
// (numéro → empreinte HMAC versionnée), aucune référence de stockage exposée.

const crypto = require('crypto');
const mongoose = require('mongoose');
const KycCase = require('../../../models/FinancialIdentityKycCase');
const KycAccessLog = require('../../../models/KycAccessLog');
const HumanIdentityAttestation = require('../../../models/HumanIdentityAttestation');
const OrgMembership = require('../../../models/OrgMembership');
const PlatformTenant = require('../../../models/PlatformTenant');
const K = require('../../../constants/financialKycConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { resolveTenantMembership } = require('../../tenantMembershipService');
const storage = require('../../storage/kycDocumentStorageService');
const authz = require('./contractualFinanceAuthorizationService');
const { assertDistinctHumans, assessIndependence, computeIdentityFingerprint } = require('./humanIdentityService');

const { CONTRACTUAL_CAPABILITIES: CAP, idOf, activeMembership } = authz;
const S = K.KYC_CASE_STATUSES;
const notFound = () => fail('KYC_CASE_NOT_FOUND', 'Dossier inaccessible.', 404);
const accepted = K.KYC_PROCEDURE.acceptedDocuments;

// ─── Accès ────────────────────────────────────────────────────────────

async function resolveRoles(actor) {
  const authority = await authz.resolveContractualAuthority(actor);
  return {
    actorId: authority.userId,
    preparerTenantId: authority.plane === 'TENANT' && authority.capabilities.has(CAP.KYC_PREPARE) ? String(authority.tenantId) : null,
    reviewer: authority.plane === 'PLATFORM' && authority.capabilities.has(CAP.KYC_ATTEST),
    plane: authority.plane,
    tenantId: authority.tenantId,
  };
}

const REVIEWABLE = [S.SUBMITTED, S.UNDER_REVIEW, S.ADDITIONAL_INFORMATION_REQUIRED, S.APPROVED, S.REJECTED, S.SUSPENDED, S.REVOKED, S.EXPIRED];

// F-U1.J — minimisation : l'organisation n'accède qu'aux dossiers qu'ELLE a
// préparés, et seulement tant qu'ils sont ouverts (sa mission s'arrête à la
// soumission et au suivi ; elle ne consulte plus les pièces après décision).
function accessorRole(roles, kycCase) {
  if (!roles.actorId || !kycCase) return null;
  if (String(kycCase.subject) === roles.actorId) return 'SUBJECT';
  if (roles.preparerTenantId && kycCase.preparedByTenant && kycCase.tenant && idOf(kycCase.tenant) === roles.preparerTenantId
    && K.KYC_OPEN_STATUSES.includes(kycCase.status)) return 'TENANT_PREPARER';
  if (roles.reviewer && REVIEWABLE.includes(kycCase.status)) return 'PLATFORM_REVIEWER';
  return null;
}

async function loadCaseFor(actor, caseId, { allowed = ['SUBJECT', 'TENANT_PREPARER', 'PLATFORM_REVIEWER'], select = '' } = {}) {
  if (!idOf(actor)) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const kycCase = mongoose.isValidObjectId(caseId) ? await KycCase.findById(caseId).select(select) : null;
  const roles = await resolveRoles(actor);
  const role = accessorRole(roles, kycCase);
  if (!role || !allowed.includes(role)) notFound();
  return { kycCase, role, roles };
}

async function logAccess(kycCase, actorId, role, action, docId = null) {
  await KycAccessLog.create({ kycCase: kycCase._id, actor: actorId, accessorRole: role, action, docId });
}

// ─── Sérialisation (données minimales par rôle) ───────────────────────

function serializeCase(kycCase, role) {
  const c = kycCase.toObject ? kycCase.toObject() : kycCase;
  const reviewer = role === 'PLATFORM_REVIEWER';
  return {
    id: c._id, subject: c.subject, tenant: c.tenant, applicantType: c.applicantType, purpose: c.purpose,
    procedureVersion: c.procedureVersion, status: c.status, revision: c.revision,
    personal: { lastName: c.personal?.lastName || null, firstNames: c.personal?.firstNames || null, birthDate: c.personal?.birthDate || null },
    identityDocument: {
      kind: c.identityDocument?.kind || null, issuingCountry: c.identityDocument?.issuingCountry || null,
      expiresAt: c.identityDocument?.expiresAt || null, numberHint: c.identityDocument?.numberHint ? `•••${c.identityDocument.numberHint}` : null,
      numberProvided: Boolean(c.identityDocument?.numberHint),
    },
    documents: (c.documents || []).filter((doc) => reviewer || doc.status === 'current').map((doc) => ({
      docId: doc.docId, slot: doc.slot, mimeType: doc.mimeType, size: doc.size, uploadedAt: doc.uploadedAt, status: doc.status, purged: Boolean(doc.purgedAt),
      review: { result: doc.review?.result || 'pending', ...(reviewer ? { notes: doc.review?.notes, reviewedAt: doc.review?.reviewedAt } : {}) },
    })),
    requiredSlots: c.identityDocument?.kind ? accepted[c.identityDocument.kind].slots : [],
    privacyNoticeAccepted: c.privacyNoticeVersion === K.KYC_PRIVACY_NOTICE.version,
    submittedAt: c.submittedAt,
    informationRequests: (c.informationRequests || []).map((item) => ({ requestedAt: item.requestedAt, message: item.message, items: item.items, resolvedAt: item.resolvedAt })),
    decision: c.decision?.result ? { result: c.decision.result, decidedAt: c.decision.decidedAt, reason: c.decision.reason, ...(reviewer ? { decidedBy: c.decision.decidedBy, linkedAccountsDetected: c.decision.linkedAccountsDetected } : {}) } : null,
    ...(reviewer ? { reviewer: c.reviewer, createdBy: c.createdBy, history: c.history } : {}),
  };
}

// ─── Complétude et statut dérivé ──────────────────────────────────────

function missingRequirements(c, now = new Date()) {
  const missing = [];
  if (!c.personal?.lastName || !c.personal?.firstNames) missing.push('personal.names');
  const kind = c.identityDocument?.kind;
  if (!kind) missing.push('identityDocument.kind');
  if (!c.identityDocument?.issuingCountry) missing.push('identityDocument.issuingCountry');
  if (!c.identityDocument?.expiresAt || new Date(c.identityDocument.expiresAt) <= now) missing.push('identityDocument.expiresAt');
  if (!c.identityDocument?.numberHint) missing.push('identityDocument.number');
  const infoMissing = missing.length > 0;
  if (kind) {
    accepted[kind].slots.forEach((slot) => {
      if (!(c.documents || []).some((doc) => doc.slot === slot && doc.status === 'current')) missing.push(`document.${slot}`);
    });
  }
  return { missing, infoMissing };
}

function derivedEditableStatus(c) {
  if (c.status === S.ADDITIONAL_INFORMATION_REQUIRED) return S.ADDITIONAL_INFORMATION_REQUIRED;
  const { missing, infoMissing } = missingRequirements(c);
  if (infoMissing) return S.DRAFT;
  return missing.length ? S.PENDING_DOCUMENTS : S.READY_FOR_SUBMISSION;
}

async function casUpdate(kycCase, { fromStatuses, set = {}, push = {}, action, actor, reason, nextStatus }) {
  const to = nextStatus || set.status || kycCase.status;
  const closing = K.KYC_CLOSED_STATUSES.includes(to) && !K.KYC_CLOSED_STATUSES.includes(kycCase.status);
  const update = {
    $set: { ...set, status: to, ...(closing ? { 'retention.closedAt': new Date() } : {}) },
    $inc: { revision: 1 },
    $push: { ...push, history: { action, from: kycCase.status, to, actor, reason, at: new Date() } },
  };
  const updated = await KycCase.findOneAndUpdate({ _id: kycCase._id, status: { $in: fromStatuses }, revision: kycCase.revision }, update, { new: true });
  if (!updated) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier a changé ou n’est pas dans un état permettant cette action.', 409);
  return updated;
}

// Recalcule le statut éditable après une modification (même révision).
async function refreshEditableStatus(kycCase, actor) {
  const target = derivedEditableStatus(kycCase);
  if (target === kycCase.status) return kycCase;
  return casUpdate(kycCase, { fromStatuses: [kycCase.status], nextStatus: target, action: 'completeness', actor });
}

// ─── Niveau 1 : préparation ───────────────────────────────────────────

async function createCase({ actor, subjectUserId = null, purpose }) {
  const roles = await resolveRoles(actor);
  if (!roles.actorId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  if (!Object.values(K.KYC_PURPOSES).includes(purpose)) fail('KYC_PURPOSE_INVALID', 'Motif de vérification invalide.', 422);
  const subject = subjectUserId ? String(subjectUserId) : roles.actorId;
  if (!mongoose.isValidObjectId(subject)) fail('KYC_SUBJECT_INVALID', 'Personne concernée invalide.', 422);
  let tenant = null; let applicantType = K.KYC_APPLICANT_TYPES.INDIVIDUAL; let preparedByTenant = false;
  if (subject !== roles.actorId) {
    // Préparation pour autrui : uniquement par une organisation habilitée,
    // pour un membre actif de CETTE organisation.
    if (!roles.preparerTenantId) fail('FINANCIAL_UNAUTHORIZED', 'Habilitation de préparation KYC requise dans ce tenant.', 403);
    if (!activeMembership(await resolveTenantMembership(subject, roles.preparerTenantId))) notFound();
    tenant = roles.preparerTenantId; applicantType = K.KYC_APPLICANT_TYPES.TENANT_MEMBER; preparedByTenant = true;
  } else if (roles.plane === 'TENANT' && activeMembership(await resolveTenantMembership(subject, roles.tenantId))) {
    tenant = String(roles.tenantId); applicantType = K.KYC_APPLICANT_TYPES.TENANT_MEMBER;
  }
  try {
    return await KycCase.create({
      subject, tenant, applicantType, purpose, procedureVersion: K.KYC_PROCEDURE.version, status: S.DRAFT,
      createdBy: roles.actorId, preparedByTenant,
      history: [{ action: 'create', from: null, to: S.DRAFT, actor: roles.actorId }],
    });
  } catch (error) {
    if (error?.code === 11000) fail('KYC_CASE_ALREADY_OPEN', 'Un dossier est déjà en cours pour cette personne et ce motif.', 409);
    throw error;
  }
}

async function listMyCases({ actor }) {
  const roles = await resolveRoles(actor);
  if (!roles.actorId) fail('FINANCIAL_UNAUTHORIZED', 'Authentification requise.', 401);
  const filter = roles.preparerTenantId
    ? { $or: [{ subject: roles.actorId }, { tenant: roles.preparerTenantId, preparedByTenant: true, status: { $in: K.KYC_OPEN_STATUSES } }] }
    : { subject: roles.actorId };
  const cases = await KycCase.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  return cases.map((c) => serializeCase(c, String(c.subject) === roles.actorId ? 'SUBJECT' : 'TENANT_PREPARER'));
}

async function getCase({ actor, caseId }) {
  const { kycCase, role, roles } = await loadCaseFor(actor, caseId);
  if (role !== 'SUBJECT') await logAccess(kycCase, roles.actorId, role, 'VIEW_CASE');
  return serializeCase(kycCase, role);
}

function normalizeInfo({ personal = {}, identityDocument = {} }, now = new Date()) {
  const set = {};
  if (personal.lastName !== undefined) set['personal.lastName'] = String(personal.lastName || '').trim().slice(0, 100) || null;
  if (personal.firstNames !== undefined) set['personal.firstNames'] = String(personal.firstNames || '').trim().slice(0, 150) || null;
  if (personal.birthDate !== undefined) {
    const birthDate = personal.birthDate ? new Date(personal.birthDate) : null;
    if (birthDate && (Number.isNaN(birthDate.getTime()) || birthDate >= now)) fail('KYC_FIELD_INVALID', 'Date de naissance invalide.', 422);
    set['personal.birthDate'] = birthDate;
  }
  if (identityDocument.kind !== undefined) {
    if (!accepted[identityDocument.kind]) fail('KYC_DOCUMENT_KIND_NOT_ACCEPTED', 'Type de pièce non accepté par la procédure.', 422);
    set['identityDocument.kind'] = identityDocument.kind;
  }
  if (identityDocument.issuingCountry !== undefined) {
    const country = String(identityDocument.issuingCountry || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) fail('KYC_FIELD_INVALID', 'Pays émetteur invalide (code ISO à deux lettres).', 422);
    set['identityDocument.issuingCountry'] = country;
  }
  if (identityDocument.expiresAt !== undefined) {
    const expiresAt = new Date(identityDocument.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) fail('KYC_DOCUMENT_EXPIRED', 'La pièce doit être en cours de validité.', 422);
    set['identityDocument.expiresAt'] = expiresAt;
  }
  return set;
}

async function updateCase({ actor, caseId, personal, identityDocument = {}, expectedRevision }) {
  // Références de stockage chargées : le tableau `documents` peut être réécrit.
  const { kycCase, roles } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT', 'TENANT_PREPARER'], select: storage.fullAssetSelect('documents.asset') });
  if (!K.KYC_EDITABLE_STATUSES.includes(kycCase.status)) fail('KYC_CASE_LOCKED', 'Le dossier n’est plus modifiable.', 409);
  if (expectedRevision !== undefined && expectedRevision !== kycCase.revision) fail('KYC_CASE_STALE', 'Le dossier a été modifié entre-temps.', 409);
  const set = normalizeInfo({ personal, identityDocument });
  const kind = set['identityDocument.kind'] || kycCase.identityDocument?.kind;
  if (identityDocument.number !== undefined) {
    if (!kind) fail('KYC_DOCUMENT_KIND_REQUIRED', 'Choisir le type de pièce avant son numéro.', 422);
    const fingerprint = computeIdentityFingerprint({ documentKind: kind, documentNumber: identityDocument.number });
    set['identityDocument.numberFingerprint'] = fingerprint.identityKey;
    set['identityDocument.fingerprintKeyVersion'] = fingerprint.keyVersion;
    set['identityDocument.numberHint'] = fingerprint.hint;
  }
  if (set['identityDocument.kind'] && set['identityDocument.kind'] !== kycCase.identityDocument?.kind) {
    // Changement de pièce : les justificatifs de l'ancienne pièce ne valent plus.
    set.documents = (kycCase.documents || []).map((doc) => (doc.status === 'current' && !accepted[kind].slots.includes(doc.slot) ? { ...doc.toObject(), status: 'superseded' } : doc.toObject()));
  }
  const updated = await casUpdate(kycCase, { fromStatuses: K.KYC_EDITABLE_STATUSES, set, action: 'update', actor: roles.actorId });
  return serializeCase(await refreshEditableStatus(updated, roles.actorId), String(updated.subject) === roles.actorId ? 'SUBJECT' : 'TENANT_PREPARER');
}

async function addDocument({ actor, caseId, slot, file }) {
  const { kycCase, roles } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT', 'TENANT_PREPARER'], select: storage.fullAssetSelect('documents.asset') });
  storage.assertEnabled();
  if (!K.KYC_EDITABLE_STATUSES.includes(kycCase.status)) fail('KYC_CASE_LOCKED', 'Le dossier n’est plus modifiable.', 409);
  const kind = kycCase.identityDocument?.kind;
  if (!kind || !accepted[kind].slots.includes(slot)) fail('KYC_DOCUMENT_SLOT_INVALID', 'Emplacement de justificatif invalide pour cette pièce.', 422);
  // Doublon : la même pièce ne peut pas servir deux fois (recto = verso,
  // remplacement par un fichier identique).
  const sha256 = storage.validateKycFile(file).sha256;
  if ((kycCase.documents || []).some((doc) => doc.status === 'current' && doc.sha256 === sha256)) {
    fail('KYC_DOCUMENT_DUPLICATE', 'Ce fichier est déjà déposé dans le dossier.', 409);
  }
  const docId = crypto.randomUUID();
  const stored = await storage.upload({ caseId: String(kycCase._id), docId, slot, file });
  const previous = (kycCase.documents || []).filter((doc) => doc.slot === slot && doc.status === 'current');
  const documents = [
    ...(kycCase.documents || []).map((doc) => (doc.slot === slot && doc.status === 'current' ? { ...doc.toObject(), status: 'superseded' } : doc.toObject())),
    { docId, slot, asset: stored.asset, mimeType: stored.mimeType, size: stored.size, sha256: stored.sha256, uploadedBy: roles.actorId, uploadedAt: new Date(), status: 'current', review: { result: 'pending' } },
  ];
  let updated;
  try {
    updated = await casUpdate(kycCase, { fromStatuses: K.KYC_EDITABLE_STATUSES, set: { documents }, action: previous.length ? 'replace_document' : 'add_document', actor: roles.actorId, reason: slot });
  } catch (error) {
    // Téléversement avorté : l'objet stocké ne doit pas rester orphelin.
    await require('./kycRetentionService').disposeOrphan({ kycCase: kycCase._id, asset: stored.asset });
    throw error;
  }
  return serializeCase(await refreshEditableStatus(updated, roles.actorId), String(updated.subject) === roles.actorId ? 'SUBJECT' : 'TENANT_PREPARER');
}

async function readDocument({ actor, caseId, docId }) {
  const { kycCase, role, roles } = await loadCaseFor(actor, caseId, { select: storage.fullAssetSelect('documents.asset') });
  const doc = (kycCase.documents || []).find((item) => item.docId === String(docId) && (role === 'PLATFORM_REVIEWER' || item.status === 'current'));
  if (!doc?.asset || doc.purgedAt) fail('KYC_DOCUMENT_NOT_FOUND', 'Justificatif inaccessible.', 404);
  await logAccess(kycCase, roles.actorId, role, 'VIEW_DOCUMENT', doc.docId);
  return { buffer: await storage.read(doc.asset.toObject ? doc.asset.toObject() : doc.asset), mimeType: doc.mimeType, slot: doc.slot };
}

// L'information de la personne concernée est acceptée par ELLE-MÊME.
async function acknowledgePrivacyNotice({ actor, caseId, version }) {
  const { kycCase, roles } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT'] });
  if (version !== K.KYC_PRIVACY_NOTICE.version) fail('KYC_PRIVACY_NOTICE_OUTDATED', 'Version de l’information obsolète.', 409);
  if (!K.KYC_EDITABLE_STATUSES.includes(kycCase.status)) fail('KYC_CASE_LOCKED', 'Le dossier n’est plus modifiable.', 409);
  return serializeCase(await casUpdate(kycCase, { fromStatuses: K.KYC_EDITABLE_STATUSES, set: { privacyNoticeVersion: version }, action: 'privacy_notice_acknowledged', actor: roles.actorId }), 'SUBJECT');
}

async function submitCase({ actor, caseId, expectedRevision }) {
  const { kycCase, roles, role } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT', 'TENANT_PREPARER'] });
  if (![S.READY_FOR_SUBMISSION, S.ADDITIONAL_INFORMATION_REQUIRED].includes(kycCase.status)) fail('KYC_CASE_INCOMPLETE', 'Le dossier n’est pas prêt à être soumis.', 409);
  const { missing } = missingRequirements(kycCase);
  if (missing.length) fail('KYC_CASE_INCOMPLETE', `Éléments manquants : ${missing.join(', ')}.`, 422);
  if (kycCase.privacyNoticeVersion !== K.KYC_PRIVACY_NOTICE.version) fail('KYC_PRIVACY_NOTICE_REQUIRED', 'La personne concernée doit d’abord prendre connaissance de l’information.', 409);
  if (expectedRevision !== undefined && expectedRevision !== kycCase.revision) fail('KYC_CASE_STALE', 'Le dossier a été modifié entre-temps.', 409);
  const requests = (kycCase.informationRequests || []).map((item) => ({ ...item.toObject(), resolvedAt: item.resolvedAt || new Date() }));
  const updated = await casUpdate(kycCase, {
    fromStatuses: [S.READY_FOR_SUBMISSION, S.ADDITIONAL_INFORMATION_REQUIRED],
    set: { status: S.SUBMITTED, submittedBy: roles.actorId, submittedAt: new Date(), informationRequests: requests, reviewer: null },
    action: kycCase.status === S.ADDITIONAL_INFORMATION_REQUIRED ? 'resubmit' : 'submit', actor: roles.actorId,
  });
  return serializeCase(updated, role);
}

async function cancelCase({ actor, caseId, reason }) {
  const { kycCase, roles, role } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT', 'TENANT_PREPARER'] });
  const cancellable = [...K.KYC_EDITABLE_STATUSES, S.SUBMITTED];
  if (!cancellable.includes(kycCase.status)) fail('KYC_CASE_INVALID_TRANSITION', 'Dossier non annulable dans son état actuel.', 409);
  return serializeCase(await casUpdate(kycCase, { fromStatuses: cancellable, nextStatus: S.CANCELLED, action: 'cancel', actor: roles.actorId, reason }), role);
}

// ─── Niveau 2 : examen et décision Altitude Vision ─────────────────────

async function loadForReviewer(actor, caseId, select = '') {
  const { kycCase, roles, role } = await loadCaseFor(actor, caseId, { allowed: ['SUBJECT', 'PLATFORM_REVIEWER'], select });
  // Un vérificateur ne traite jamais son propre dossier (refus explicite).
  if (role === 'SUBJECT') {
    if (roles.reviewer) fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Un vérificateur ne peut pas examiner son propre dossier.', 403);
    notFound();
  }
  return { kycCase, reviewerId: roles.actorId };
}

// Conflits d'intérêts et indépendance du vérificateur.
async function assertReviewerIndependent(kycCase, reviewerId) {
  await assertDistinctHumans({
    vérificateur: reviewerId, 'personne concernée': kycCase.subject, 'préparateur du dossier': kycCase.createdBy,
    'auteur de la soumission': kycCase.submittedBy, 'auteur d’un justificatif': (kycCase.documents || []).map((doc) => doc.uploadedBy),
  }, { actor: 'vérificateur' });
  if (kycCase.tenant) {
    const tenant = await PlatformTenant.findById(kycCase.tenant).select('rootOrgUnit').lean();
    if (tenant?.rootOrgUnit && await OrgMembership.exists({ user: reviewerId, orgUnit: tenant.rootOrgUnit, status: 'active' })) {
      fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Un membre de l’organisation préparatrice ne peut pas examiner ce dossier.', 403);
    }
  }
  const independence = await assessIndependence([reviewerId]);
  if (!independence.established) fail('KYC_REVIEWER_IDENTITY_NOT_ATTESTED', 'Le vérificateur doit lui-même disposer d’une identité attestée valide.', 403);
  return independence;
}

async function listReviewQueue({ actor, status }) {
  const roles = await resolveRoles(actor);
  if (!roles.reviewer) fail('FINANCIAL_UNAUTHORIZED', 'Habilitation de vérification KYC requise.', 403);
  const statuses = status && REVIEWABLE.includes(status) ? [status] : [S.SUBMITTED, S.UNDER_REVIEW];
  const cases = await KycCase.find({ status: { $in: statuses } }).sort({ submittedAt: 1 }).limit(200).lean();
  return cases.map((c) => ({ id: c._id, status: c.status, applicantType: c.applicantType, purpose: c.purpose, submittedAt: c.submittedAt, reviewer: c.reviewer, documentKind: c.identityDocument?.kind || null }));
}

async function getCaseForReview({ actor, caseId }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  await logAccess(kycCase, reviewerId, 'PLATFORM_REVIEWER', 'VIEW_CASE');
  const accessLog = await KycAccessLog.find({ kycCase: kycCase._id }).sort({ at: -1 }).limit(100).lean();
  return { ...serializeCase(kycCase, 'PLATFORM_REVIEWER'), accessLog: accessLog.map((entry) => ({ actor: entry.actor, accessorRole: entry.accessorRole, action: entry.action, docId: entry.docId, at: entry.at })) };
}

async function takeCase({ actor, caseId }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  await assertReviewerIndependent(kycCase, reviewerId);
  return serializeCase(await casUpdate(kycCase, { fromStatuses: [S.SUBMITTED], set: { status: S.UNDER_REVIEW, reviewer: reviewerId, reviewStartedAt: new Date() }, action: 'take', actor: reviewerId }), 'PLATFORM_REVIEWER');
}

async function requestInformation({ actor, caseId, message, items = [] }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  await assertReviewerIndependent(kycCase, reviewerId);
  if (!String(message || '').trim()) fail('KYC_REASON_REQUIRED', 'Le message au demandeur est requis.', 422);
  return serializeCase(await casUpdate(kycCase, {
    fromStatuses: [S.UNDER_REVIEW], nextStatus: S.ADDITIONAL_INFORMATION_REQUIRED, action: 'request_information', actor: reviewerId, reason: message,
    push: { informationRequests: { requestedBy: reviewerId, requestedAt: new Date(), message: String(message).trim(), items: items.map(String).slice(0, 20) } },
  }), 'PLATFORM_REVIEWER');
}

async function recordDocumentCheck({ actor, caseId, docId, result, notes }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  await assertReviewerIndependent(kycCase, reviewerId);
  if (!['verified', 'rejected'].includes(result)) fail('KYC_CHECK_INVALID', 'Résultat de contrôle invalide.', 422);
  if (kycCase.status !== S.UNDER_REVIEW) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier doit être en cours d’examen.', 409);
  const index = (kycCase.documents || []).findIndex((doc) => doc.docId === String(docId) && doc.status === 'current');
  if (index < 0) fail('KYC_DOCUMENT_NOT_FOUND', 'Justificatif inaccessible.', 404);
  const updated = await KycCase.findOneAndUpdate(
    { _id: kycCase._id, status: S.UNDER_REVIEW, revision: kycCase.revision, [`documents.${index}.docId`]: String(docId) },
    {
      $set: { [`documents.${index}.review`]: { result, notes, reviewedBy: reviewerId, reviewedAt: new Date() } },
      $inc: { revision: 1 }, $push: { history: { action: `document_${result}`, from: kycCase.status, to: kycCase.status, actor: reviewerId, reason: String(docId), at: new Date() } },
    },
    { new: true },
  );
  if (!updated) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier a changé entre-temps.', 409);
  return serializeCase(updated, 'PLATFORM_REVIEWER');
}

async function approveCase({ actor, caseId, reason }) {
  if (process.env.KYC_PROCEDURE_VALIDATED_VERSION !== K.KYC_PROCEDURE.version) {
    fail('KYC_PROCEDURE_NOT_VALIDATED', 'La procédure KYC n’a pas été validée : aucune attestation ne peut être délivrée.', 409);
  }
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId, '+identityDocument.numberFingerprint +identityDocument.fingerprintKeyVersion');
  await assertReviewerIndependent(kycCase, reviewerId);
  if (kycCase.status !== S.UNDER_REVIEW) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier doit être en cours d’examen.', 409);
  const { missing } = missingRequirements(kycCase);
  if (missing.length) fail('KYC_CASE_INCOMPLETE', `Éléments manquants : ${missing.join(', ')}.`, 422);
  const current = kycCase.documents.filter((doc) => doc.status === 'current');
  if (current.some((doc) => doc.review?.result !== 'verified')) fail('KYC_DOCUMENTS_NOT_VERIFIED', 'Chaque justificatif doit être vérifié avant décision.', 409);
  if (kycCase.applicantType === K.KYC_APPLICANT_TYPES.TENANT_MEMBER
    && !activeMembership(await resolveTenantMembership(kycCase.subject, kycCase.tenant))) {
    fail('KYC_SUBJECT_ORGANIZATION_LINK_BROKEN', 'La personne n’est plus membre active de l’organisation préparatrice.', 409);
  }
  const { numberFingerprint, fingerprintKeyVersion } = kycCase.identityDocument;
  // Le vérificateur ne peut pas être la personne dont il atteste l'identité,
  // même sous un autre compte.
  const reviewerAttestation = await HumanIdentityAttestation.findOne({ user: reviewerId, status: { $in: ['verified', 'suspended'] } }).select('+identityKey +fingerprintKeyVersion').lean();
  if (reviewerAttestation && reviewerAttestation.identityKey === numberFingerprint && reviewerAttestation.fingerprintKeyVersion === fingerprintKeyVersion) {
    fail('FINANCIAL_SEGREGATION_OF_DUTIES', 'Le vérificateur et la personne concernée partagent la même identité.', 403);
  }
  if (await HumanIdentityAttestation.exists({ user: kycCase.subject, status: { $in: ['verified', 'suspended'] } })) {
    fail('KYC_SUBJECT_ALREADY_ATTESTED', 'Une attestation vivante existe déjà pour ce compte.', 409);
  }
  const linkedAccounts = await HumanIdentityAttestation.countDocuments({ identityKey: numberFingerprint, fingerprintKeyVersion, status: { $in: ['verified', 'suspended'] }, user: { $ne: kycCase.subject } });
  return runFinancialOperation({ operationName: 'kyc.case.approve', transactionMode: 'transactional' }, async ({ session }) => {
    const [attestation] = await HumanIdentityAttestation.create([{
      user: kycCase.subject, identityKey: numberFingerprint, fingerprintKeyVersion, documentKind: kycCase.identityDocument.kind,
      source: 'KYC_CASE', kycCase: kycCase._id, expiresAt: kycCase.identityDocument.expiresAt,
      evidenceRef: `kyc:${kycCase._id}`, verifiedBy: reviewerId, verifiedAt: new Date(),
      statusHistory: [{ from: null, to: 'verified', actor: reviewerId, reason, at: new Date() }],
    }], { session });
    const updated = await KycCase.findOneAndUpdate(
      { _id: kycCase._id, status: S.UNDER_REVIEW, revision: kycCase.revision },
      {
        $set: { status: S.APPROVED, attestation: attestation._id, decision: { result: 'approved', decidedBy: reviewerId, decidedAt: new Date(), reason, linkedAccountsDetected: linkedAccounts } },
        $inc: { revision: 1 }, $push: { history: { action: 'approve', from: S.UNDER_REVIEW, to: S.APPROVED, actor: reviewerId, reason, at: new Date() } },
      },
      { new: true, session },
    );
    if (!updated) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier a changé entre-temps.', 409);
    return { case: serializeCase(updated, 'PLATFORM_REVIEWER'), attestationId: attestation._id, linkedAccountsDetected: linkedAccounts };
  });
}

async function rejectCase({ actor, caseId, reason }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  await assertReviewerIndependent(kycCase, reviewerId);
  if (!String(reason || '').trim()) fail('KYC_REASON_REQUIRED', 'Une décision de refus doit être motivée.', 422);
  return serializeCase(await casUpdate(kycCase, {
    fromStatuses: [S.UNDER_REVIEW], set: { status: S.REJECTED, decision: { result: 'rejected', decidedBy: reviewerId, decidedAt: new Date(), reason } },
    action: 'reject', actor: reviewerId, reason,
  }), 'PLATFORM_REVIEWER');
}

// Suspension / révocation : immédiates ; les habilitations dont l'identityBasis
// cite l'attestation deviennent inutilisables dès l'appel suivant.
async function changeAttestationStatus({ actor, caseId, to, reason, docId = null }) {
  const { kycCase, reviewerId } = await loadForReviewer(actor, caseId);
  if (!String(reason || '').trim()) fail('KYC_REASON_REQUIRED', 'Motif requis.', 422);
  await assertDistinctHumans({ vérificateur: reviewerId, 'personne concernée': kycCase.subject }, { actor: 'vérificateur' });
  const from = to === 'suspended' ? ['verified'] : to === 'verified' ? ['suspended'] : ['verified', 'suspended'];
  const caseFrom = to === 'suspended' ? [S.APPROVED] : to === 'verified' ? [S.SUSPENDED] : [S.APPROVED, S.SUSPENDED, S.EXPIRED];
  const caseTo = { suspended: S.SUSPENDED, revoked: S.REVOKED, verified: S.APPROVED }[to];
  if (!caseFrom.includes(kycCase.status) || !kycCase.attestation) fail('KYC_CASE_INVALID_TRANSITION', 'Aucune attestation dans cet état.', 409);
  if (to === 'verified') {
    const attestation = await HumanIdentityAttestation.findById(kycCase.attestation).lean();
    await assertDistinctHumans({ 'levée de suspension': reviewerId, 'auteur de la suspension': attestation?.suspendedBy }, { actor: 'levée de suspension' });
  }
  return runFinancialOperation({ operationName: `kyc.attestation.${to}`, transactionMode: 'transactional' }, async ({ session }) => {
    const set = { status: to, statusReason: reason, ...(to === 'suspended' ? { suspendedBy: reviewerId, suspendedAt: new Date() } : {}), ...(to === 'revoked' ? { revokedBy: reviewerId, revokedAt: new Date() } : {}) };
    const attestation = await HumanIdentityAttestation.findOneAndUpdate(
      { _id: kycCase.attestation, status: { $in: from } },
      { $set: set, $push: { statusHistory: { from: from.join('|'), to, actor: reviewerId, reason, at: new Date() } } },
      { new: true, session },
    );
    if (!attestation) fail('KYC_CASE_INVALID_TRANSITION', 'Attestation modifiée entre-temps.', 409);
    const docUpdate = docId ? { $set: { 'documents.$[doc].review.result': 'rejected', 'documents.$[doc].review.notes': reason, 'documents.$[doc].review.reviewedBy': reviewerId, 'documents.$[doc].review.reviewedAt': new Date() } } : {};
    const updated = await KycCase.findOneAndUpdate(
      { _id: kycCase._id, status: { $in: caseFrom } },
      {
        ...docUpdate, $set: { ...(docUpdate.$set || {}), status: caseTo, ...(caseTo === S.REVOKED ? { 'retention.closedAt': new Date() } : {}) }, $inc: { revision: 1 },
        $push: { history: { action: docId ? 'document_invalidated' : `attestation_${to}`, from: kycCase.status, to: caseTo, actor: reviewerId, reason, at: new Date() } },
      },
      { new: true, session, ...(docId ? { arrayFilters: [{ 'doc.docId': String(docId) }] } : {}) },
    );
    if (!updated) fail('KYC_CASE_INVALID_TRANSITION', 'Le dossier a changé entre-temps.', 409);
    return serializeCase(updated, 'PLATFORM_REVIEWER');
  });
}

const suspendAttestation = (params) => changeAttestationStatus({ ...params, to: 'suspended' });
const reinstateAttestation = (params) => changeAttestationStatus({ ...params, to: 'verified' });
const revokeAttestation = (params) => changeAttestationStatus({ ...params, to: 'revoked' });
// Invalidation d'un justificatif après approbation : l'attestation fondée sur
// lui est suspendue dans la même transaction.
const invalidateDocument = ({ docId, ...params }) => {
  if (!docId) fail('KYC_DOCUMENT_NOT_FOUND', 'Justificatif requis.', 422);
  return changeAttestationStatus({ ...params, docId, to: 'suspended' });
};

// Tâche système : dossiers dont la pièce est expirée (l'attestation cesse
// d'être utilisable dès expiresAt, sans attendre cette tâche).
async function expireDueCases({ now = new Date() } = {}) {
  const attestations = await HumanIdentityAttestation.find({ source: 'KYC_CASE', status: 'verified', expiresAt: { $lte: now } }).select('kycCase').lean();
  const result = await KycCase.updateMany(
    { _id: { $in: attestations.map((item) => item.kycCase) }, status: S.APPROVED },
    { $set: { status: S.EXPIRED, 'retention.closedAt': now }, $inc: { revision: 1 }, $push: { history: { action: 'expire', from: S.APPROVED, to: S.EXPIRED, actor: null, at: now } } },
  );
  return { expired: result.modifiedCount };
}

module.exports = {
  createCase, listMyCases, getCase, updateCase, addDocument, readDocument, acknowledgePrivacyNotice, submitCase, cancelCase,
  listReviewQueue, getCaseForReview, takeCase, requestInformation, recordDocumentCheck, approveCase, rejectCase,
  suspendAttestation, reinstateAttestation, revokeAttestation, invalidateDocument, expireDueCases, serializeCase,
};
