const express = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');
const cinetpay = require('../controllers/cinetpayController');

const protect   = [auth.protect, auth.restrictTo(...STAFF_DOC)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

// CinetPay
router.post('/initier',           auth.protect,  cinetpay.initierPaiement);
router.post('/webhook-cinetpay',                 cinetpay.webhookCinetpay);

// Routes spécifiques AVANT /:id pour éviter les conflits
router.get( '/alertes',            protect,   ctrl.getAlertes);
router.post('/calculer-penalites', adminOnly, ctrl.calculerPenalites);

router.get('/',       protect,   ctrl.getAll);
router.get('/:id',    protect,   ctrl.getOne);
router.put('/:id',    adminOnly, ctrl.update);
router.post('/:id/marquer-paye', adminOnly, ctrl.marquerPaye);
router.delete('/:id', adminOnly, ctrl.delete);

module.exports = router;
