const express = require('express');
const { ROLES_PAIEMENTS } = require('../utils/roles');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');
const cinetpay = require('../controllers/cinetpayController');
const { upload } = require('../config/cloudinary');

const protect   = [auth.protect, auth.restrictTo(...ROLES_PAIEMENTS)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];
// Annulation d'encaissement (GL-DEBT-1, Phase 8) : plus restrictif que
// ROLES_PAIEMENTS — jamais Secretaire/Collaborateur, jamais propriétaire ou
// locataire (qui n'atteignent de toute façon aucune route /paiements).
const cancelReceipt = [auth.protect, auth.restrictTo('Admin', 'GestionnaireImmobilier')];

// CinetPay
router.post('/initier',           auth.protect, cinetpay.initierPaiement);
router.post('/webhook-cinetpay',               cinetpay.webhookCinetpay);

// Routes spécifiques AVANT /:id pour éviter les conflits
router.get( '/alertes',            protect, ctrl.getAlertes);
router.get( '/stats',              protect, ctrl.getStats);
router.post('/calculer-penalites', protect, ctrl.calculerPenalites);
// GL-DEBT-1.1 — un encaissement réparti sur plusieurs échéances du même contrat.
router.post('/encaisser-multiple', protect, upload.single('preuve'), ctrl.encaisserMultiple);

router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.put('/:id',    protect, ctrl.update);
// upload.single ne touche req.body/req.file que pour une requête
// multipart/form-data réelle — un appel JSON existant (sans preuve jointe)
// traverse ce middleware sans aucun changement de comportement.
router.post('/:id/marquer-paye', protect, upload.single('preuve'), ctrl.marquerPaye);
// Historique détaillé des versements (Phase 6) et annulation contrôlée (Phase 8).
router.get( '/:id/receipts',                protect,       ctrl.listReceipts);
router.post('/:id/receipts/:receiptId/cancel', cancelReceipt, ctrl.cancelReceipt);
// Une échéance financière ne peut être supprimée que par un administrateur
// et seulement tant qu'aucun encaissement n'a été enregistré (contrôle dans
// le contrôleur). Les rôles de saisie conservent la gestion courante.
router.delete('/:id', adminOnly, ctrl.delete);

module.exports = router;
