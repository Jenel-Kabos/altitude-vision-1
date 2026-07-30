const express = require('express');
const { ROLES_PAIEMENTS } = require('../utils/roles');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');
const cinetpay = require('../controllers/cinetpayController');

const protect   = [auth.protect, auth.restrictTo(...ROLES_PAIEMENTS)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

// CinetPay
router.post('/initier',           auth.protect, cinetpay.initierPaiement);
router.post('/webhook-cinetpay',               cinetpay.webhookCinetpay);

// Routes spécifiques AVANT /:id pour éviter les conflits
router.get( '/alertes',            protect, ctrl.getAlertes);
router.get( '/stats',              protect, ctrl.getStats);
router.post('/calculer-penalites', protect, ctrl.calculerPenalites);

router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.put('/:id',    protect, ctrl.update);
router.post('/:id/marquer-paye', protect, ctrl.marquerPaye);
// Une échéance financière ne peut être supprimée que par un administrateur
// et seulement tant qu'aucun encaissement n'a été enregistré (contrôle dans
// le contrôleur). Les rôles de saisie conservent la gestion courante.
router.delete('/:id', adminOnly, ctrl.delete);

module.exports = router;
