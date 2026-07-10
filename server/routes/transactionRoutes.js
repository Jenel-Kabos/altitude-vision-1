const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/transactionController');
const pCtrl   = require('../controllers/paiementTransactionController');
const { upload } = require('../config/cloudinary');
const { STAFF_DOC } = require('../utils/roles');

const protect   = auth.protect;
const staffOnly = [auth.protect, auth.restrictTo(...STAFF_DOC)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

// Webhooks publics (pas d'auth)
router.post('/webhook/cinetpay', pCtrl.webhookCinetpay); // legacy — conservé, non utilisé par les nouveaux paiements
router.post('/paiements/webhook', pCtrl.webhookYabetoo);

// Stats (staff)
router.get('/stats', staffOnly, ctrl.getStats);

// Client : ses transactions
router.get('/my', protect, ctrl.getMyTransactions);

// Staff : toutes les transactions
router.get('/',    staffOnly, ctrl.getAllTransactions);
router.post('/',   staffOnly, ctrl.createTransaction);

// Transaction unique
router.get   ('/:id',          protect,   ctrl.getTransaction);
router.post  ('/:id/finalize', staffOnly, ctrl.finalizeTransaction);
router.patch ('/:id/cancel',   staffOnly, ctrl.cancelTransaction);
router.patch ('/:id/notes',    staffOnly, ctrl.updateNotes);

// Paiements
router.get   ('/:id/paiements',                                        protect,   pCtrl.getPaiements);
router.post  ('/:id/paiements/initier',                                protect,   pCtrl.initierPaiement);
router.get   ('/:id/paiements/verifier/:intentId',                     protect,   pCtrl.verifierPaiement);
router.post  ('/:id/paiements/virement', upload.single('preuve'),      protect,   pCtrl.soumettreVirement);
router.post  ('/:id/paiements/especes',                                staffOnly, pCtrl.enregistrerEspecesCheque);
router.patch ('/:txId/paiements/:pId/valider',                         adminOnly, pCtrl.validerVirement);

module.exports = router;
