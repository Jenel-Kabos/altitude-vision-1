const express = require('express');
const router  = express.Router();
const { creerSignalement, getAllSignalements, traiterSignalement, downloadProof } = require('../controllers/signalementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const { ROLES_LITIGES } = require('../utils/roles');
// SECURITY-CLOSURE-P1-WAVE-1 (P1-C, finding RA-07) — mêmes routes que
// litigeRoutes.js, toutes strictement staff ici.
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

router.post('/',              protect, uploadPreuves, creerSignalement);
router.get('/',               protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, getAllSignalements);
router.get('/:id/proofs/:proofIndex', protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, downloadProof);
router.patch('/:id/traiter',  protect, restrictTo(...ROLES_LITIGES), requireTenantScopeForStaffOrPlatformOperator, traiterSignalement);

module.exports = router;
