const express = require('express');
const router  = express.Router();
const { creerSignalement, getAllSignalements, traiterSignalement } = require('../controllers/signalementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/',              protect, creerSignalement);
router.get('/',               protect, restrictTo('Admin'), getAllSignalements);
router.patch('/:id/traiter',  protect, restrictTo('Admin'), traiterSignalement);

module.exports = router;
