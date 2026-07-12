const express = require('express');
const router  = express.Router();
const { creerSignalement, getAllSignalements, traiterSignalement } = require('../controllers/signalementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Upload flexible : images + pdf (fileFilter existant dans cloudinary.js)
const uploadPreuves = upload.array('preuves', 5);

router.post('/',              protect, uploadPreuves, creerSignalement);
router.get('/',               protect, restrictTo('Admin'), getAllSignalements);
router.patch('/:id/traiter',  protect, restrictTo('Admin'), traiterSignalement);

module.exports = router;
