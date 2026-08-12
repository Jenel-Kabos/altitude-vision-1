const express = require('express');
const router  = express.Router();
const { creerSignalement, getAllSignalements, traiterSignalement, downloadProof } = require('../controllers/signalementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const { ROLES_LITIGES } = require('../utils/roles');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

router.post('/',              protect, uploadPreuves, creerSignalement);
router.get('/',               protect, restrictTo(...ROLES_LITIGES), getAllSignalements);
router.get('/:id/proofs/:proofIndex', protect, restrictTo(...ROLES_LITIGES), downloadProof);
router.patch('/:id/traiter',  protect, restrictTo(...ROLES_LITIGES), traiterSignalement);

module.exports = router;
