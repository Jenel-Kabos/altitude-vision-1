const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');

const protect = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];

// Routes spécifiques AVANT /:id pour éviter les conflits
router.get('/alertes',           protect, ctrl.getAlertes);
router.post('/calculer-penalites', protect, ctrl.calculerPenalites);

router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.put('/:id',    protect, ctrl.update);
router.post('/:id/marquer-paye', protect, ctrl.marquerPaye);
router.delete('/:id', protect, ctrl.delete);

module.exports = router;
