const asyncHandler = require('express-async-handler');
const service = require('../services/platformTenant/tenantApplicationService');

const safeAttachment = (applicationId, item) => ({
  id: item._id, category: item.category, revision: item.revision,
  displayName: item.displayName, mimeType: item.privateAsset?.mimeType,
  size: item.privateAsset?.size, uploadedAt: item.uploadedAt,
  endpoint: `/api/platform-tenants/applications/${applicationId}/documents/${item._id}`,
});
const safeApplication = (application) => application ? {
  id: application._id, organizationName: application.organizationName,
  organizationType: application.organizationType, professionalContact: application.professionalContact,
  businessDeclaration: application.businessDeclaration, establishmentContext: application.establishmentContext,
  status: application.status, submittedAt: application.submittedAt, revision: application.revision,
  ...(application.status === 'REJECTED' ? { rejectionReason: application.rejectionReason || null } : {}),
  reopenedFields: application.reopenedFields,
  additionalInfo: { requestedAt: application.additionalInfo?.requestedAt, reason: application.additionalInfo?.reason,
    requestedDocumentCategories: application.additionalInfo?.requestedDocumentCategories || [] },
  documents: (application.attachmentManifest || []).filter((item) => item.deletionState === 'active').map((item) => safeAttachment(application._id, item)),
  createdAt: application.createdAt, updatedAt: application.updatedAt,
} : null;
const safeReviewApplication = (application) => ({ ...safeApplication(application), applicant: application.applicant && {
  id: application.applicant._id || application.applicant, name: application.applicant.name || '',
  email: application.applicant.email || '', role: application.applicant.role || '',
}, history: application.history, reviewedBy: application.reviewedBy, reviewedAt: application.reviewedAt,
  approvedAt: application.approvedAt, rejectedAt: application.rejectedAt, rejectionReason: application.rejectionReason });

exports.status = asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: await service.getOnboardingStatus({ actor: req.user }) });
});
exports.me = asyncHandler(async (req, res) => {
  const application = await service.getCurrentOwnApplication({ actor: req.user });
  res.json({ status: 'success', data: { application: safeApplication(application) } });
});
exports.create = asyncHandler(async (req, res) => {
  const existing = await service.getCurrentOwnApplication({ actor: req.user });
  const application = existing || await service.createDraft({ actor: req.user, input: req.body });
  res.status(existing ? 200 : 201).json({ status: 'success', data: { application: safeApplication(application) } });
});
exports.update = asyncHandler(async (req, res) => {
  const application = await service.editOwnApplication({ applicationId: req.params.applicationId, actor: req.user, input: req.body });
  res.json({ status: 'success', data: { application: safeApplication(application) } });
});
exports.uploadDocument = asyncHandler(async (req, res) => {
  const document = await service.uploadOwnDocument({ applicationId: req.params.applicationId, actor: req.user, category: req.body.category, file: req.file });
  res.status(201).json({ status: 'success', data: { document: safeAttachment(req.params.applicationId, document) } });
});
exports.readDocument = asyncHandler(async (req, res) => {
  const { attachment, buffer } = await service.readOwnDocument({ applicationId: req.params.applicationId, documentId: req.params.documentId, actor: req.user });
  res.set({ 'Content-Type': attachment.privateAsset.mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.displayName)}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(buffer);
});
exports.deleteDocument = asyncHandler(async (req, res) => {
  await service.deleteOwnDocument({ applicationId: req.params.applicationId, documentId: req.params.documentId, actor: req.user });
  res.status(204).send();
});
exports.submit = asyncHandler(async (req, res) => {
  const application = await service.submitOwnApplication({ applicationId: req.params.applicationId, actor: req.user });
  res.json({ status: 'success', data: { application: safeApplication(application) } });
});
exports.listForReview = asyncHandler(async (req, res) => {
  const result = await service.listForReview({ actor: req.user, filters: req.query });
  res.json({ status: 'success', data: result });
});
exports.readForReview = asyncHandler(async (req, res) => {
  const application = await service.readForReview({ applicationId: req.params.applicationId, actor: req.user });
  res.json({ status: 'success', data: { application: safeReviewApplication(application) } });
});
exports.startReview = asyncHandler(async (req, res) => {
  const application = await service.startReview({ applicationId: req.params.applicationId, actor: req.user });
  res.json({ status: 'success', data: { application: safeReviewApplication(application) } });
});
exports.requestChanges = asyncHandler(async (req, res) => {
  const application = await service.requestAdditionalInfo({ applicationId: req.params.applicationId, actor: req.user,
    reason: req.body.reason, reopenedFields: req.body.requestedFields, requestedDocumentCategories: req.body.requestedDocumentCategories });
  res.json({ status: 'success', data: { application: safeReviewApplication(application) } });
});
exports.reject = asyncHandler(async (req, res) => {
  const application = await service.rejectApplication({ applicationId: req.params.applicationId, actor: req.user, reason: req.body.reason, req });
  res.json({ status: 'success', data: { application: safeReviewApplication(application) } });
});
exports.approve = asyncHandler(async (req, res) => {
  const result = await service.approveApplication({ applicationId: req.params.applicationId, actor: req.user, req });
  res.json({ status: 'success', data: { application: safeReviewApplication(result.application), organization: { provisioned: true }, idempotent: result.idempotent } });
});
exports.readDocumentForReview = asyncHandler(async (req, res) => {
  const { attachment, buffer } = await service.readDocumentForReview({ applicationId: req.params.applicationId, documentId: req.params.documentId, actor: req.user });
  res.set({ 'Content-Type': attachment.privateAsset.mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.displayName)}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(buffer);
});
