const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/realEstateApplicationController');
const realEstateApplicationUpload = require('../middleware/realEstateApplicationUpload');
// SECURITY-CLOSURE-P1-WAVE-1 (P1-D, finding RA-08) — même garde que
// HF-FINAL-01/P1-C : conditionné par rôle, no-op pour un non-staff
// (propriétaire/candidat), fail-closed pour un staff sans tenant résolu.
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');

const router = express.Router();
router.use(auth.protect);
router.get('/', requireTenantScopeForStaffOrPlatformOperator, ctrl.list);
router.post('/', ctrl.create);
// SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 (FCA1-02) — même garde que les
// endpoints Application ci-dessous (no-op pour client/propriétaire,
// fail-closed pour un staff sans tenant résolu).
router.get('/reservations/:id', requireTenantScopeForStaffOrPlatformOperator, ctrl.getReservation);
router.post('/reservations/:id/cancel', requireTenantScopeForStaffOrPlatformOperator, ctrl.cancelReservation);
router.post('/:id/attachments', realEstateApplicationUpload.array('attachments', 5), ctrl.uploadAttachments);
router.get('/:id/attachments/:attachmentId', requireTenantScopeForStaffOrPlatformOperator, ctrl.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', ctrl.deleteAttachment);
router.get('/:id', requireTenantScopeForStaffOrPlatformOperator, ctrl.getOne);
router.post('/:id/review', requireTenantScopeForStaffOrPlatformOperator, ctrl.review);
router.post('/:id/accept', requireTenantScopeForStaffOrPlatformOperator, ctrl.accept);
router.post('/:id/reject', requireTenantScopeForStaffOrPlatformOperator, ctrl.reject);
router.post('/:id/withdraw', ctrl.withdraw);
module.exports = router;
