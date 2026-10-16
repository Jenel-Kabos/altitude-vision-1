// F-U1.I — Surface HTTP v1 du KYC financier à deux niveaux.
//
// L'acteur est reconstruit depuis l'identité authentifiée et le contexte
// serveur ; aucun champ d'autorité (tenant, rôle, capacités) n'est lu dans le
// corps. Corps filtrés par liste blanche. Les justificatifs sont servis en
// flux privé, jamais par URL.

const kyc = require('../services/finance/contractual/financialKycService');
const retention = require('../services/finance/contractual/kycRetentionService');
const { KYC_PRIVACY_NOTICE, KYC_PROCEDURE } = require('../constants/financialKycConstants');

const actorOf = (req) => ({
  _id: req.user?._id, role: req.user?.role,
  platformTenant: req.platformTenant || null, tenantContextSource: req.tenantContextSource || null,
});
const pick = (body, keys) => Object.fromEntries(keys.filter((key) => body?.[key] !== undefined).map((key) => [key, body[key]]));
const handle = (fn, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ status: 'success', data: await fn(req) }); } catch (error) { next(error); }
};

exports.getProcedure = handle(async () => ({
  version: KYC_PROCEDURE.version,
  acceptedDocuments: Object.fromEntries(Object.entries(KYC_PROCEDURE.acceptedDocuments).map(([kind, value]) => [kind, value.slots])),
  privacyNotice: KYC_PRIVACY_NOTICE,
}));

exports.createCase = handle((req) => kyc.createCase({ actor: actorOf(req), ...pick(req.body, ['subjectUserId', 'purpose']) }).then((c) => kyc.serializeCase(c, String(c.subject) === String(req.user?._id) ? 'SUBJECT' : 'TENANT_PREPARER')), 201);
exports.listCases = handle((req) => kyc.listMyCases({ actor: actorOf(req) }));
exports.getCase = handle((req) => kyc.getCase({ actor: actorOf(req), caseId: req.params.caseId }));
exports.updateCase = handle((req) => kyc.updateCase({
  actor: actorOf(req), caseId: req.params.caseId,
  personal: pick(req.body?.personal || {}, ['lastName', 'firstNames', 'birthDate']),
  identityDocument: pick(req.body?.identityDocument || {}, ['kind', 'issuingCountry', 'expiresAt', 'number']),
  expectedRevision: req.body?.expectedRevision,
}));
exports.addDocument = handle((req) => kyc.addDocument({ actor: actorOf(req), caseId: req.params.caseId, slot: req.body?.slot, file: req.file }), 201);
exports.readDocument = async (req, res, next) => {
  try {
    const { buffer, mimeType, slot } = await kyc.readDocument({ actor: actorOf(req), caseId: req.params.caseId, docId: req.params.docId });
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${slot}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Le document ne peut ni exécuter de script, ni être encadré, ni fuiter
    // par l'en-tête Referer.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);
  } catch (error) { next(error); }
};
exports.acknowledgeNotice = handle((req) => kyc.acknowledgePrivacyNotice({ actor: actorOf(req), caseId: req.params.caseId, version: req.body?.version }));
exports.submitCase = handle((req) => kyc.submitCase({ actor: actorOf(req), caseId: req.params.caseId, expectedRevision: req.body?.expectedRevision }));
exports.cancelCase = handle((req) => kyc.cancelCase({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));

exports.reviewQueue = handle((req) => kyc.listReviewQueue({ actor: actorOf(req), status: req.query?.status }));
exports.reviewCase = handle((req) => kyc.getCaseForReview({ actor: actorOf(req), caseId: req.params.caseId }));
exports.takeCase = handle((req) => kyc.takeCase({ actor: actorOf(req), caseId: req.params.caseId }));
exports.requestInformation = handle((req) => kyc.requestInformation({ actor: actorOf(req), caseId: req.params.caseId, ...pick(req.body, ['message', 'items']) }));
exports.checkDocument = handle((req) => kyc.recordDocumentCheck({ actor: actorOf(req), caseId: req.params.caseId, docId: req.params.docId, ...pick(req.body, ['result', 'notes']) }));
exports.approveCase = handle((req) => kyc.approveCase({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.rejectCase = handle((req) => kyc.rejectCase({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.suspendAttestation = handle((req) => kyc.suspendAttestation({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.reinstateAttestation = handle((req) => kyc.reinstateAttestation({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.revokeAttestation = handle((req) => kyc.revokeAttestation({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.invalidateDocument = handle((req) => kyc.invalidateDocument({ actor: actorOf(req), caseId: req.params.caseId, docId: req.params.docId, reason: req.body?.reason }));
exports.requestErasure = handle((req) => retention.requestErasure({ actor: actorOf(req), caseId: req.params.caseId, reason: req.body?.reason }));
exports.setLegalHold = handle((req) => retention.setLegalHold({ actor: actorOf(req), caseId: req.params.caseId, active: req.body?.active === true, reason: req.body?.reason }));
