const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/transactionController');
const pCtrl   = require('../controllers/paiementTransactionController');
const { upload } = require('../config/cloudinary');
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-C.1 —
// SALE marketplace commercial authority is PLATFORM-ONLY (business
// contract §1-§6 explicit). Tenant Admin, tenant Collaborateur,
// tenant Secretaire, Proprietaire, Client do NOT gain marketplace
// commercial or financial authority merely from workspace/ownership
// status. Only canonical platform authority (User.role='Admin' + active
// PlatformOperator + exact capability) may perform sensitive commercial
// mutations that materially affect platform financial state
// (finalize, validate virement, record cash payment, create/cancel a
// commercial transaction — all touch `Transaction.commission` and
// downstream FinancialLedger / Document invoice).
//
// Owner/Client self-service reads and client-initiated online payment
// flows remain on `auth.protect` — filtered inside the controllers by
// resource ownership/participation, not by staff role.
//
// P0-C boundary preserved: `requireTenantScopeForStaffOrPlatformOperator`
// remains on the list/stats routes so that a scoped PlatformOperator
// can inspect a tenant's transactions without inheriting workspace
// authority.
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');

const platformFinanceRead = [auth.protect, requirePlatformOperatorCapability('platform.finance.read')];
const platformFinanceManage = [auth.protect, requirePlatformOperatorCapability('platform.finance.manage')];
const platformCommercialManage = [auth.protect, requirePlatformOperatorCapability('platform.commercial.manage')];

// Webhooks publics (pas d'auth)
router.post('/webhook/cinetpay', pCtrl.webhookCinetpay); // legacy — conservé, non utilisé par les nouveaux paiements
router.post('/paiements/webhook', pCtrl.webhookYabetoo);

// PLATFORM COMMERCIAL READ — stats + list all transactions.
router.get('/stats', platformFinanceRead, requireTenantScopeForStaffOrPlatformOperator, ctrl.getStats);
router.get('/',    platformFinanceRead, requireTenantScopeForStaffOrPlatformOperator, ctrl.getAllTransactions);

// Client self-service reads
router.get('/my', auth.protect, ctrl.getMyTransactions);

// PLATFORM COMMERCIAL WRITE — creation freezes an initial `commission`
// state via `calcCommission`, so it is a platform financial mutation.
router.post('/',   platformFinanceManage, ctrl.createTransaction);

// Owner/client detail read — filtered in-controller by ownership/participation.
router.get   ('/:id',          auth.protect,   ctrl.getTransaction);

// PLATFORM FINANCIAL MUTATIONS — sensitive.
router.post  ('/:id/finalize', platformFinanceManage, ctrl.finalizeTransaction);
router.patch ('/:id/cancel',   platformFinanceManage, ctrl.cancelTransaction);

// PLATFORM COMMERCIAL NON-FINANCIAL WRITE — notes only. Requires
// platform.commercial.manage (not finance.manage — capabilities are
// independent; finance does not imply commercial and vice versa).
router.patch ('/:id/notes',    platformCommercialManage, ctrl.updateNotes);

// Owner/client payment self-service reads.
router.get   ('/:id/paiements',                                        auth.protect,   pCtrl.getPaiements);
router.get   ('/:id/paiements/:pId/proof',                             auth.protect,   pCtrl.downloadProof);

// Client-initiated online payment flows — the buyer starts/verifies/submits
// their own payment on their own transaction. Ownership/participation is
// enforced inside the controller.
router.post  ('/:id/paiements/initier',                                auth.protect,   pCtrl.initierPaiement);
router.get   ('/:id/paiements/verifier/:intentId',                     auth.protect,   pCtrl.verifierPaiement);
router.post  ('/:id/paiements/virement', upload.single('preuve'),      auth.protect,   pCtrl.soumettreVirement);

// PLATFORM FINANCIAL MUTATIONS — cash/check recording and virement
// validation are Altitude Vision financial operations; they freeze
// platform revenue/settlement state.
router.post  ('/:id/paiements/especes',                                platformFinanceManage, pCtrl.enregistrerEspecesCheque);
router.patch ('/:txId/paiements/:pId/valider',                         platformFinanceManage, pCtrl.validerVirement);

module.exports = router;
