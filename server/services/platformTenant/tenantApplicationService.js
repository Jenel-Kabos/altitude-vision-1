const TenantApplication = require('../../models/TenantApplication');
const mongoose = require('mongoose');
const crypto = require('crypto');
const OrgMembership = require('../../models/OrgMembership');
const OrgUnit = require('../../models/OrgUnit');
const PlatformTenant = require('../../models/PlatformTenant');
const User = require('../../models/User');
const platformTenantService = require('./platformTenantService');
const organizationService = require('../organizationService');
const { logAction, buildAuteur } = require('../actionLogService');
const { notify } = require('../notificationService');
const { resolveEffectiveTenantContext, resolveAvailableTenantsForUser } = require('./tenantContextService');
const storage = require('../storage/tenantApplicationStorageService');
const { resolveActiveOperator, hasCapability } = require('../platformOperator/platformOperatorService');

const EDITABLE_FIELDS = Object.freeze([
  'organizationName', 'organizationType', 'professionalContact',
  'businessDeclaration', 'establishmentContext',
]);
const TRANSITIONS = Object.freeze({
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED'],
  ADDITIONAL_INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: [],
  REJECTED: [],
});
const REQUIRED_DOCUMENT_CATEGORIES = Object.freeze([
  'responsible_person_identity', 'professional_business_existence',
  'establishment_authority', 'establishment_context',
]);
const MAX_DOCUMENTS = 12;
const MAX_DOCUMENTS_PER_CATEGORY = 3;
const REVIEW_FILTER_STATES = Object.freeze(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED']);

class TenantApplicationError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message); this.name = 'TenantApplicationError'; this.code = code; this.statusCode = statusCode;
  }
}
const fail = (code, message, statusCode) => { throw new TenantApplicationError(code, message, statusCode); };
const actorId = (actor) => actor?._id || actor?.id || null;
const safeBusinessFields = (input = {}, allowed = EDITABLE_FIELDS) => Object.fromEntries(
  allowed.filter((key) => Object.prototype.hasOwnProperty.call(input, key)).map((key) => [key, input[key]]),
);

async function createDraft({ actor, input = {} } = {}) {
  const userId = actorId(actor);
  if (!userId) fail('TENANT_APPLICATION_AUTH_REQUIRED', 'Authentification requise.', 401);
  if (actor.role !== 'Proprietaire') fail('TENANT_APPLICATION_ROLE_FORBIDDEN', 'Demande réservée aux propriétaires.', 403);
  const organizationName = String(input.organizationName || '').trim();
  if (organizationName.length < 2) fail('TENANT_APPLICATION_NAME_REQUIRED', 'Nom de l’organisation requis.', 422);
  try {
    return await TenantApplication.create({
      ...safeBusinessFields(input), applicant: userId, organizationName,
      status: 'DRAFT', activeApplicantKey: String(userId),
      history: [{ from: null, to: 'DRAFT', actor: userId }],
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await TenantApplication.findOne({ activeApplicantKey: String(userId) });
      if (existing) return existing;
    }
    throw error;
  }
}

async function assertOwner(applicationId, actor) {
  const application = await TenantApplication.findById(applicationId);
  if (!application || String(application.applicant) !== String(actorId(actor))) {
    fail('TENANT_APPLICATION_NOT_FOUND', 'Demande introuvable.', 404);
  }
  return application;
}

async function assertOwnerWithAssets(applicationId, actor) {
  const application = await TenantApplication.findById(applicationId)
    .select([
      '+attachmentManifest.privateAsset', '+attachmentManifest.privateAsset.publicId',
      '+attachmentManifest.privateAsset.resourceType', '+attachmentManifest.privateAsset.deliveryType',
      '+attachmentManifest.privateAsset.version', '+attachmentManifest.privateAsset.format',
      '+storageCleanupQueue.privateAsset', '+storageCleanupQueue.privateAsset.publicId',
      '+storageCleanupQueue.privateAsset.resourceType', '+storageCleanupQueue.privateAsset.deliveryType',
    ].join(' '));
  if (!application || String(application.applicant) !== String(actorId(actor))) {
    fail('TENANT_APPLICATION_NOT_FOUND', 'Demande introuvable.', 404);
  }
  return application;
}

async function getOwnApplication({ applicationId, actor }) {
  return assertOwner(applicationId, actor);
}

async function editOwnApplication({ applicationId, actor, input = {} }) {
  const application = await assertOwner(applicationId, actor);
  let allowed;
  if (application.status === 'DRAFT') allowed = EDITABLE_FIELDS;
  else if (application.status === 'ADDITIONAL_INFO_REQUIRED') allowed = application.reopenedFields || [];
  else fail('TENANT_APPLICATION_LOCKED', 'La demande est verrouillée dans cet état.', 409);
  const patch = safeBusinessFields(input, allowed);
  Object.assign(application, patch);
  application.revision += 1;
  return application.save();
}

async function transitionCas({ applicationId, actor, from, to, reason = '', extraSet = {} }) {
  if (!TRANSITIONS[from]?.includes(to)) fail('TENANT_APPLICATION_INVALID_TRANSITION', 'Transition impossible.', 409);
  const userId = actorId(actor);
  const updated = await TenantApplication.findOneAndUpdate(
    { _id: applicationId, status: from },
    {
      $set: { status: to, ...extraSet },
      $inc: { revision: 1 },
      $push: { history: { from, to, actor: userId, reason: String(reason || '').slice(0, 1000), at: new Date() } },
    },
    { new: true, runValidators: true },
  );
  if (!updated) fail('TENANT_APPLICATION_TRANSITION_CONFLICT', 'La demande a déjà changé d’état.', 409);
  return updated;
}

async function submitOwnApplication({ applicationId, actor }) {
  const application = await assertOwnerWithAssets(applicationId, actor);
  if (!['DRAFT', 'ADDITIONAL_INFO_REQUIRED'].includes(application.status)) {
    fail('TENANT_APPLICATION_INVALID_TRANSITION', 'Soumission impossible.', 409);
  }
  const missingFields = [];
  if (!String(application.organizationName || '').trim()) missingFields.push('organizationName');
  if (!String(application.organizationType || '').trim()) missingFields.push('organizationType');
  if (!String(application.businessDeclaration || '').trim()) missingFields.push('businessDeclaration');
  if (!String(application.professionalContact?.email || application.professionalContact?.phone || '').trim()) missingFields.push('professionalContact');
  if (!String(application.establishmentContext?.name || '').trim()) missingFields.push('establishmentContext.name');
  const categories = new Set((application.attachmentManifest || []).filter((item) => item.deletionState === 'active').map((item) => item.category));
  const missingCategories = REQUIRED_DOCUMENT_CATEGORIES.filter((category) => !categories.has(category));
  if (missingFields.length || missingCategories.length) {
    fail('TENANT_APPLICATION_INCOMPLETE', `Dossier incomplet (${[...missingFields, ...missingCategories].join(', ')}).`, 422);
  }
  return transitionCas({
    applicationId, actor, from: application.status, to: 'SUBMITTED',
    extraSet: { reopenedFields: [], 'additionalInfo.reason': '', submittedAt: new Date() },
  });
}

async function getCurrentOwnApplication({ actor }) {
  const userId = actorId(actor);
  if (!userId) fail('TENANT_APPLICATION_AUTH_REQUIRED', 'Authentification requise.', 401);
  if (actor.role !== 'Proprietaire') fail('TENANT_APPLICATION_ROLE_FORBIDDEN', 'Demande réservée aux propriétaires.', 403);
  return TenantApplication.findOne({ applicant: userId }).sort({ createdAt: -1 });
}

async function getOnboardingStatus({ actor }) {
  const userId = actorId(actor);
  if (!userId) fail('TENANT_APPLICATION_AUTH_REQUIRED', 'Authentification requise.', 401);
  if (actor.role !== 'Proprietaire') return { state: 'FORBIDDEN' };
  const [memberships, available, context] = await Promise.all([
    OrgMembership.find({ user: userId }).select('status').lean(),
    resolveAvailableTenantsForUser(userId), resolveEffectiveTenantContext(userId),
  ]);
  if (available?.length > 1) return { state: 'AMBIGUOUS' };
  if (context?.tenant) return { state: 'ALREADY_ONBOARDED' };
  if (memberships.length) return { state: 'REVIEW_REQUIRED' };
  const [legacyRootCount, legacyTenantCount] = await Promise.all([
    OrgUnit.countDocuments({ type: 'organization', createdBy: userId }),
    PlatformTenant.countDocuments({ createdBy: userId }),
  ]);
  if (legacyRootCount || legacyTenantCount) return { state: 'REVIEW_REQUIRED' };
  const application = await TenantApplication.findOne({ applicant: userId }).sort({ createdAt: -1 }).select('status').lean();
  if (!application) return { state: 'NO_APPLICATION' };
  const states = { SUBMITTED: 'PENDING_REVIEW', UNDER_REVIEW: 'PENDING_REVIEW' };
  return { state: states[application.status] || application.status, applicationId: application._id };
}

function assertCategory(category) {
  if (!REQUIRED_DOCUMENT_CATEGORIES.includes(category)) fail('TENANT_APPLICATION_DOCUMENT_CATEGORY_INVALID', 'Catégorie de justificatif invalide.', 422);
}

async function uploadOwnDocument({ applicationId, actor, category, file }) {
  assertCategory(category);
  const attachmentId = new mongoose.Types.ObjectId();
  let uploaded;
  const initial = await assertOwnerWithAssets(applicationId, actor);
  const allowed = initial.status === 'DRAFT' || (initial.status === 'ADDITIONAL_INFO_REQUIRED'
    && initial.additionalInfo?.requestedDocumentCategories?.includes(category));
  if (!allowed) fail('TENANT_APPLICATION_DOCUMENTS_LOCKED', 'Les justificatifs sont verrouillés dans cet état.', 409);
  const active = initial.attachmentManifest.filter((item) => item.deletionState === 'active');
  if (active.length >= MAX_DOCUMENTS || active.filter((item) => item.category === category).length >= MAX_DOCUMENTS_PER_CATEGORY) {
    fail('TENANT_APPLICATION_DOCUMENT_LIMIT', 'Limite de justificatifs atteinte.', 422);
  }
  uploaded = await storage.upload({ applicationId, attachmentId, file });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await assertOwnerWithAssets(applicationId, actor);
    const stillAllowed = current.status === 'DRAFT' || (current.status === 'ADDITIONAL_INFO_REQUIRED'
      && current.additionalInfo?.requestedDocumentCategories?.includes(category));
    if (!stillAllowed) break;
    const currentActive = current.attachmentManifest.filter((item) => item.deletionState === 'active');
    if (currentActive.length >= MAX_DOCUMENTS || currentActive.filter((item) => item.category === category).length >= MAX_DOCUMENTS_PER_CATEGORY) break;
    const latest = currentActive.filter((item) => item.category === category).sort((a, b) => b.revision - a.revision)[0];
    const attachment = { _id: attachmentId, category, revision: (latest?.revision || 0) + 1,
      supersedes: latest?._id || null, displayName: uploaded.displayName, privateAsset: uploaded.privateAsset,
      deletionState: 'active', uploadedAt: new Date() };
    const saved = await TenantApplication.findOneAndUpdate(
      { _id: applicationId, applicant: actorId(actor), status: current.status, revision: current.revision },
      { $push: { attachmentManifest: attachment }, $inc: { revision: 1 } }, { new: true, runValidators: true },
    );
    if (saved) return saved.attachmentManifest.id(attachmentId);
  }
  try { await storage.remove(uploaded.privateAsset); } catch {
    await TenantApplication.updateOne({ _id: applicationId, applicant: actorId(actor) }, { $push: { storageCleanupQueue: { privateAsset: uploaded.privateAsset, reason: 'upload_persistence_failed' } } });
    fail('TENANT_APPLICATION_STORAGE_CLEANUP_FAILED', 'Nettoyage stockage différé requis.', 502);
  }
  fail('TENANT_APPLICATION_DOCUMENT_CONFLICT', 'Le dossier a changé pendant le téléversement.', 409);
}

async function readOwnDocument({ applicationId, documentId, actor }) {
  const application = await assertOwnerWithAssets(applicationId, actor);
  const attachment = application.attachmentManifest.id(documentId);
  if (!attachment || attachment.deletionState !== 'active') fail('TENANT_APPLICATION_DOCUMENT_NOT_FOUND', 'Justificatif introuvable.', 404);
  return { attachment, buffer: await storage.read(attachment.privateAsset) };
}

async function deleteOwnDocument({ applicationId, documentId, actor }) {
  const application = await assertOwnerWithAssets(applicationId, actor);
  if (application.status !== 'DRAFT') fail('TENANT_APPLICATION_DOCUMENTS_LOCKED', 'Suppression impossible dans cet état.', 409);
  const attachment = application.attachmentManifest.id(documentId);
  if (!attachment || attachment.deletionState !== 'active') fail('TENANT_APPLICATION_DOCUMENT_NOT_FOUND', 'Justificatif introuvable.', 404);
  const marked = await TenantApplication.findOneAndUpdate(
    { _id: applicationId, applicant: actorId(actor), status: 'DRAFT', revision: application.revision, 'attachmentManifest._id': documentId },
    { $set: { 'attachmentManifest.$.deletionState': 'pending' }, $inc: { revision: 1 } }, { new: true },
  );
  if (!marked) fail('TENANT_APPLICATION_DOCUMENT_CONFLICT', 'Le dossier a changé.', 409);
  try { await storage.remove(attachment.privateAsset); } catch {
    await TenantApplication.updateOne({ _id: applicationId, 'attachmentManifest._id': documentId }, { $set: { 'attachmentManifest.$.deletionState': 'cleanup_failed' } });
    fail('TENANT_APPLICATION_STORAGE_CLEANUP_FAILED', 'Suppression stockage à reprendre.', 502);
  }
  await TenantApplication.updateOne({ _id: applicationId, 'attachmentManifest._id': documentId }, { $pull: { attachmentManifest: { _id: documentId } } });
  return { deleted: true };
}

async function assertOperatorCapability(actor, capability) {
  const operator = await resolveActiveOperator(actorId(actor));
  if (!operator || !hasCapability(operator, capability)) {
    fail('TENANT_APPLICATION_PLATFORM_AUTHORITY_REQUIRED', 'Capacité opérateur plateforme requise.', 403);
  }
  return operator;
}

async function auditApplication(action, { application, actor, reason = '', session, req, tenant = null }) {
  return logAction({ action: `tenant_application.${action}`, description: `Demande d’activation professionnelle ${application._id} — ${action}`,
    module: 'PlatformAdmin', typeAction: action === 'rejected' ? 'REJET' : action === 'approved' ? 'VALIDATION' : 'MODIFICATION',
    auteur: buildAuteur(actor), cible: { id: String(application._id), type: 'TenantApplication', nom: application.organizationName },
    scopeMode: 'platform', metadata: { platformTenantId: tenant?._id || null, organizationApplicationId: String(application._id), reason: String(reason || '').slice(0, 1000) },
    req, session });
}

const notifyApplicant = (application, type, title, body) => notify({ recipient: application.applicant, type, title, body,
  entityType: 'TenantApplication', entityId: application._id, dedupeKey: `tenant-application:${application._id}:${type}:${application.revision}` }).catch(() => null);

async function listForReview({ actor, filters = {} }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.read');
  const page = Math.max(1, Number(filters.page) || 1); const limit = Math.min(50, Math.max(1, Number(filters.limit) || 20));
  const query = {};
  if (filters.status) {
    if (!REVIEW_FILTER_STATES.includes(filters.status)) fail('TENANT_APPLICATION_FILTER_INVALID', 'Statut de filtre invalide.', 422);
    query.status = filters.status;
  }
  if (filters.applicant) {
    if (!mongoose.isValidObjectId(filters.applicant)) fail('TENANT_APPLICATION_FILTER_INVALID', 'Applicant invalide.', 422);
    query.applicant = filters.applicant;
  }
  if (filters.organizationName) query.organizationName = { $regex: String(filters.organizationName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
    if ([query.createdAt.$gte, query.createdAt.$lte].some((date) => date && Number.isNaN(date.getTime()))) fail('TENANT_APPLICATION_FILTER_INVALID', 'Date de filtre invalide.', 422);
  }
  const [applications, total] = await Promise.all([
    TenantApplication.find(query).select('_id applicant organizationName organizationType status submittedAt reviewedAt createdAt updatedAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TenantApplication.countDocuments(query),
  ]);
  return { applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function readForReview({ applicationId, actor }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.read');
  const application = await TenantApplication.findById(applicationId).select('+attachmentManifest.privateAsset').populate('applicant', 'name email role');
  if (!application) fail('TENANT_APPLICATION_NOT_FOUND', 'Demande introuvable.', 404);
  return application;
}

async function startReview({ applicationId, actor }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.review');
  const now = new Date();
  const application = await transitionCas({ applicationId, actor, from: 'SUBMITTED', to: 'UNDER_REVIEW', extraSet: { reviewedBy: actorId(actor), reviewedAt: now } });
  await auditApplication('review_started', { application, actor });
  await notifyApplicant(application, 'tenant_application_under_review', 'Demande en cours d’examen', 'Votre demande d’activation professionnelle est en cours d’examen.');
  return application;
}

async function requestAdditionalInfo({ applicationId, actor, reason, reopenedFields = [], requestedDocumentCategories = [] }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.request_changes');
  if (!String(reason || '').trim()) fail('TENANT_APPLICATION_REASON_REQUIRED', 'Motif requis.', 422);
  const validFields = [...new Set(reopenedFields)].filter((field) => EDITABLE_FIELDS.includes(field));
  const validCategories = [...new Set(requestedDocumentCategories)].filter((category) => REQUIRED_DOCUMENT_CATEGORIES.includes(category));
  if (validFields.length !== [...new Set(reopenedFields)].length) fail('TENANT_APPLICATION_REQUEST_FIELD_INVALID', 'Champ demandé invalide.', 422);
  if (validCategories.length !== [...new Set(requestedDocumentCategories)].length) fail('TENANT_APPLICATION_DOCUMENT_CATEGORY_INVALID', 'Catégorie demandée invalide.', 422);
  if (!validFields.length && !validCategories.length) fail('TENANT_APPLICATION_REOPENED_FIELDS_REQUIRED', 'Champ ou justificatif à compléter requis.', 422);
  const now = new Date();
  const application = await transitionCas({
    applicationId, actor, from: 'UNDER_REVIEW', to: 'ADDITIONAL_INFO_REQUIRED', reason,
    extraSet: { reopenedFields: validFields, additionalInfo: { requestedBy: actorId(actor), requestedAt: now, reason: String(reason).trim(), requestedDocumentCategories: validCategories } },
  });
  await auditApplication('additional_info_requested', { application, actor, reason });
  await notifyApplicant(application, 'tenant_application_additional_info_required', 'Informations complémentaires requises', 'Votre demande nécessite des informations complémentaires.');
  return application;
}

async function rejectApplication({ applicationId, actor, reason, req }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.reject');
  if (!String(reason || '').trim()) fail('TENANT_APPLICATION_REASON_REQUIRED', 'Motif de rejet requis.', 422);
  const now = new Date();
  const application = await transitionCas({ applicationId, actor, from: 'UNDER_REVIEW', to: 'REJECTED', reason,
    extraSet: { rejectedBy: actorId(actor), rejectedAt: now, rejectionReason: String(reason).trim(), activeApplicantKey: null } });
  await auditApplication('rejected', { application, actor, reason, req });
  await notifyApplicant(application, 'tenant_application_rejected', 'Demande non approuvée', 'Votre demande d’activation professionnelle n’a pas été approuvée.');
  return application;
}

async function assertApplicantEligibleForProvisioning(application, session) {
  const user = await User.findOne({ _id: application.applicant, role: 'Proprietaire', isActive: { $ne: false }, status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] } }).session(session);
  if (!user) fail('TENANT_APPLICATION_APPLICANT_INVALID', 'Le demandeur n’est plus éligible.', 409);
  const membershipCount = await OrgMembership.countDocuments({ user: user._id }).session(session);
  if (membershipCount) fail('TENANT_APPLICATION_MEMBERSHIP_CONFLICT', 'Un rattachement organisationnel existe déjà.', 409);
  const [rootCount, tenantCount] = await Promise.all([
    OrgUnit.countDocuments({ createdBy: user._id }).session(session),
    PlatformTenant.countDocuments({ createdBy: user._id }).session(session),
  ]);
  if (rootCount || tenantCount) fail('TENANT_APPLICATION_LEGACY_CONFLICT', 'Un historique organisationnel nécessite une revue.', 409);
  const deterministicSlug = `first-owner-${crypto.createHash('sha256').update(String(user._id)).digest('hex').slice(0, 40)}`;
  const collision = await PlatformTenant.findOne({ slug: deterministicSlug }).select('_id createdBy').session(session);
  if (collision) fail('TENANT_APPLICATION_FOREIGN_PROVISIONING_COLLISION', 'Identité de provisioning déjà utilisée.', 409);
  return user;
}

async function approveApplication({ applicationId, actor, req, failurePoint = null }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.approve');
  const already = await TenantApplication.findById(applicationId);
  if (!already) fail('TENANT_APPLICATION_NOT_FOUND', 'Demande introuvable.', 404);
  if (already.status === 'APPROVED' && already.provisionedTenant && already.provisionedMembership) return { application: already, idempotent: true };
  if (already.status !== 'UNDER_REVIEW') fail('TENANT_APPLICATION_INVALID_TRANSITION', 'Seule une demande en cours d’examen peut être approuvée.', 409);

  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const application = await TenantApplication.findOne({ _id: applicationId, status: 'UNDER_REVIEW' }).session(session);
      if (!application) fail('TENANT_APPLICATION_APPROVAL_CONFLICT', 'La demande a déjà changé d’état.', 409);
      const applicant = await assertApplicantEligibleForProvisioning(application, session);
      const tenant = await platformTenantService.createFirstOwnerTenant({ name: application.organizationName, actor: applicant, req, session });
      if (failurePoint === 'after_tenant') throw new Error('TENANT_APPLICATION_TEST_FAILURE_AFTER_TENANT');
      const membership = await organizationService.grantMembership({ userId: applicant._id, orgUnitId: tenant.rootOrgUnit,
        roleInUnit: 'owner', actor, metadata: { tenantApplicationId: application._id }, req, session });
      if (failurePoint === 'after_membership') throw new Error('TENANT_APPLICATION_TEST_FAILURE_AFTER_MEMBERSHIP');
      const now = new Date();
      const approved = await TenantApplication.findOneAndUpdate(
        { _id: application._id, status: 'UNDER_REVIEW', revision: application.revision },
        { $set: { status: 'APPROVED', approvedBy: actorId(actor), approvedAt: now, provisionedTenant: tenant._id,
          provisionedMembership: membership._id, activeApplicantKey: null }, $inc: { revision: 1 },
        $push: { history: { from: 'UNDER_REVIEW', to: 'APPROVED', actor: actorId(actor), at: now } } },
        { new: true, runValidators: true, session },
      );
      if (!approved) fail('TENANT_APPLICATION_APPROVAL_CONFLICT', 'La demande a déjà changé d’état.', 409);
      if (failurePoint === 'before_commit') throw new Error('TENANT_APPLICATION_TEST_FAILURE_BEFORE_COMMIT');
      await auditApplication('approved', { application: approved, actor, session, req, tenant });
      result = { application: approved, tenant, membership, idempotent: false };
    });
  } catch (error) {
    const final = await TenantApplication.findById(applicationId);
    if (final?.status === 'APPROVED' && final.provisionedTenant && final.provisionedMembership) return { application: final, idempotent: true };
    throw error;
  } finally { await session.endSession(); }
  await notifyApplicant(result.application, 'tenant_application_approved', 'Organisation activée', 'Votre organisation a été approuvée et activée.');
  await notifyApplicant(result.application, 'tenant_provisioned', 'Organisation disponible', 'Votre espace professionnel est maintenant disponible.');
  return result;
}

async function readDocumentForReview({ applicationId, documentId, actor }) {
  await assertOperatorCapability(actor, 'platform.tenant_applications.read');
  const application = await TenantApplication.findById(applicationId).select([
    '+attachmentManifest.privateAsset', '+attachmentManifest.privateAsset.publicId', '+attachmentManifest.privateAsset.resourceType',
    '+attachmentManifest.privateAsset.deliveryType', '+attachmentManifest.privateAsset.version', '+attachmentManifest.privateAsset.format',
  ].join(' '));
  if (!application) fail('TENANT_APPLICATION_NOT_FOUND', 'Demande introuvable.', 404);
  const attachment = application.attachmentManifest.id(documentId);
  if (!attachment || attachment.deletionState !== 'active') fail('TENANT_APPLICATION_DOCUMENT_NOT_FOUND', 'Justificatif introuvable.', 404);
  return { attachment, buffer: await storage.read(attachment.privateAsset) };
}

// Réservé à la future transaction Phase 3. Aucun contrôleur/route ne l'appelle.
async function transitionApprovedInternal() {
  fail('TENANT_APPLICATION_APPROVAL_NOT_WIRED', 'Approbation indisponible avant le provisioning atomique Phase 3.', 501);
}

module.exports = {
  TenantApplicationError, TRANSITIONS, EDITABLE_FIELDS, REQUIRED_DOCUMENT_CATEGORIES, MAX_DOCUMENTS, MAX_DOCUMENTS_PER_CATEGORY,
  createDraft, getOwnApplication, editOwnApplication, submitOwnApplication,
  getCurrentOwnApplication, getOnboardingStatus, uploadOwnDocument, readOwnDocument, deleteOwnDocument,
  listForReview, readForReview, startReview, requestAdditionalInfo, rejectApplication, approveApplication, readDocumentForReview,
  transitionApprovedInternal,
};
