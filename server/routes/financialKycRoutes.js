// F-U1.I — Routes v1 du KYC financier (montées sous /api/v1/financial-kyc).
//
// /cases/*  : personne concernée et organisation préparatrice (niveau 1).
// /review/* : agents Altitude Vision porteurs de `contractual.kyc.attest`, en
//             vue plateforme (niveau 2). L'approbation finale est en outre
//             bloquée tant que la procédure n'est pas validée
//             (KYC_PROCEDURE_VALIDATED_VERSION) ; le dépôt de pièces tant que
//             le stockage n'est pas validé (KYC_DOCUMENT_STORAGE_ENABLED).
// Aucune route n'accorde d'habilitation : KYC approuvé ≠ habilitation.
// F-U1.J : aucune route de purge (procédure hors API, simulation par défaut).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/financialKycController');
const kycDocumentUpload = require('../middleware/kycDocumentUpload');
const { attachTenantScopeIfResolvable } = require('../middleware/tenantContext');
const { kycNoStore, kycDocumentReadLimiter, kycDocumentUploadLimiter } = require('../middleware/kycSecurity');

const router = express.Router();
router.use(kycNoStore, auth.protect, attachTenantScopeIfResolvable);

router.get('/procedure', ctrl.getProcedure);
router.get('/cases', ctrl.listCases);
router.post('/cases', ctrl.createCase);
router.get('/cases/:caseId', ctrl.getCase);
router.patch('/cases/:caseId', ctrl.updateCase);
router.post('/cases/:caseId/documents', kycDocumentUploadLimiter, kycDocumentUpload, ctrl.addDocument);
router.get('/cases/:caseId/documents/:docId', kycDocumentReadLimiter, ctrl.readDocument);
router.post('/cases/:caseId/privacy-notice', ctrl.acknowledgeNotice);
router.post('/cases/:caseId/submit', ctrl.submitCase);
router.post('/cases/:caseId/cancel', ctrl.cancelCase);
router.post('/cases/:caseId/erasure-request', ctrl.requestErasure);

router.get('/review/cases', ctrl.reviewQueue);
router.get('/review/cases/:caseId', ctrl.reviewCase);
router.get('/review/cases/:caseId/documents/:docId', kycDocumentReadLimiter, ctrl.readDocument);
router.post('/review/cases/:caseId/take', ctrl.takeCase);
router.post('/review/cases/:caseId/request-information', ctrl.requestInformation);
router.post('/review/cases/:caseId/documents/:docId/check', ctrl.checkDocument);
router.post('/review/cases/:caseId/documents/:docId/invalidate', ctrl.invalidateDocument);
router.post('/review/cases/:caseId/approve', ctrl.approveCase);
router.post('/review/cases/:caseId/reject', ctrl.rejectCase);
router.post('/review/cases/:caseId/attestation/suspend', ctrl.suspendAttestation);
router.post('/review/cases/:caseId/attestation/reinstate', ctrl.reinstateAttestation);
router.post('/review/cases/:caseId/attestation/revoke', ctrl.revokeAttestation);
router.post('/review/cases/:caseId/legal-hold', ctrl.setLegalHold);

module.exports = router;
