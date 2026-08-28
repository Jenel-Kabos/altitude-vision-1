const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');
const cinetpay = require('../controllers/cinetpayController');
const { upload } = require('../config/cloudinary');
// TENANT-CERT-2 — même vulnérabilité et même correctif transversal que
// contratRoutes.js/rentalManagementRoutes.js : GET/PUT/DELETE `:id`
// chargeaient le Paiement sans vérification tenant.
const Paiement = require('../models/Paiement');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireCapability } = require('../middleware/capabilityMiddleware');
// SECURITY-CLOSURE-P0-WAVE-1 (P0-B/P0-C, findings RA-02/RA-03) — les routes
// de liste/agrégation (`/`, `/stats`, `/alertes`) et l'encaissement multiple
// (`/encaisser-multiple`) n'appliquaient aucune frontière tenant, à la
// différence des routes `:id` protégées ci-dessous par `router.param`.
// Réutilise le même garde canonique que HF-FINAL-01 (Messaging) : fail-closed
// pour tout staff/PlatformOperator sans tenant résolu, jamais un tenant
// inventé par défaut. Tous les appelants de ce fichier sont déjà
// exclusivement staff (capacités `payments.read`/`payments.manage`), donc
// ce garde ne change rien pour un acteur non-staff (il n'en existe aucun ici).
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');

const readPayments = [auth.protect, requireCapability('payments.read')];
const managePayments = [auth.protect, requireCapability('payments.manage')];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];
// Annulation d'encaissement (GL-DEBT-1, Phase 8) : plus restrictif que
// ROLES_PAIEMENTS — jamais Secretaire/Collaborateur, jamais propriétaire ou
// locataire (qui n'atteignent de toute façon aucune route /paiements).
const cancelReceipt = [auth.protect, requireCapability('payments.reverse')];

// CinetPay — PAY-2 : déprécié par décision produit, les deux handlers
// renvoient désormais 410 PAYMENT_PROVIDER_DEPRECATED sans aucune mutation
// (voir server/docs/PAY2_CINETPAY_DEPRECATION_REPORT.md). Routes conservées
// (non retirées) pour répondre proprement à `notify_url` déjà enregistrée
// chez CinetPay plutôt que de renvoyer un 404 muet.
router.post('/initier',           auth.protect, cinetpay.initierPaiement);
router.post('/webhook-cinetpay',               cinetpay.webhookCinetpay);

// Routes spécifiques AVANT /:id pour éviter les conflits
router.get( '/alertes', readPayments, requireTenantScopeForStaffOrPlatformOperator, ctrl.getAlertes);
router.get( '/stats', readPayments, requireTenantScopeForStaffOrPlatformOperator, ctrl.getStats);
router.post('/calculer-penalites', managePayments, ctrl.calculerPenalites);
// GL-DEBT-1.1 — un encaissement réparti sur plusieurs échéances du même contrat.
// SECURITY-CLOSURE-P0-WAVE-1 — PAS de `requireTenantScopeForStaffOrPlatformOperator`
// ici (contrairement aux 3 routes de liste ci-dessus) : c'est une autorité sur UNE
// ressource précise (`contrat`), pas une liste — le contrôleur réutilise directement
// `assertResourceTenantOrUnattributed` (même tolérance « non attribué » que le
// `router.param('id', …)` ci-dessous, pour ne pas bloquer à tort un Contrat legacy
// sans Property réellement liée, cf. rentalPaymentMultiEcheanceAllocation.mongo.integration.test.js).
router.post('/encaisser-multiple', managePayments, upload.single('preuve'), ctrl.encaisserMultiple);

// TENANT-CERT-2 — `router.param('id', …)` s'exécute avant le tableau de
// middlewares propre à chaque route ci-dessous (donc avant `auth.protect`) :
// sans cette ligne, `req.user` serait encore indéfini au moment du contrôle
// tenant (bug réel constaté lors de la certification). `/initier` et
// `/webhook-cinetpay` restent inchangées (déclarées avant, aucune ne
// consomme `:id`).
router.use(auth.protect);

router.param('id', async (req, res, next, paiementId) => {
  try {
    if (!mongoose.isValidObjectId(paiementId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const paiement = await Paiement.findById(paiementId);
    if (!paiement) return res.status(404).json({ status: 'fail', message: 'Paiement introuvable.' });
    // Un Paiement dont le Contrat n'a lui-même aucune Property réellement
    // liée (adresse en texte libre, données antérieures à PlatformTenant)
    // n'a AUCUNE frontière tenant à faire respecter — voir
    // assertResourceTenantOrUnattributed. Dès qu'une attribution existe,
    // elle doit correspondre au tenant de l'acteur (`tenant?._id` reste
    // `undefined` si l'acteur n'a lui-même aucun tenant : ne matche jamais
    // un `tenantId` réel, donc refuse correctement sans branche séparée).
    // PLATFORM-ADMIN-1 — transmet l'en-tête de sélection explicite : sans
    // cela, un PlatformOperator (zéro membership par construction) resterait
    // bloqué ici même après sélection d'un tenant dans l'UI, puisque
    // `resolveTenantForUser` sans second argument ignore totalement l'en-tête.
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Paiement', resource: paiement, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Paiement introuvable.' });
  }
});

router.get('/', readPayments, requireTenantScopeForStaffOrPlatformOperator, ctrl.getAll);
router.get('/:id', readPayments, ctrl.getOne);
router.get('/:id/proof', readPayments, ctrl.downloadProof);
router.put('/:id', managePayments, ctrl.update);
// upload.single ne touche req.body/req.file que pour une requête
// multipart/form-data réelle — un appel JSON existant (sans preuve jointe)
// traverse ce middleware sans aucun changement de comportement.
router.post('/:id/marquer-paye', managePayments, upload.single('preuve'), ctrl.marquerPaye);
// Historique détaillé des versements (Phase 6) et annulation contrôlée (Phase 8).
router.get( '/:id/receipts', readPayments, ctrl.listReceipts);
router.post('/:id/receipts/:receiptId/cancel', cancelReceipt, ctrl.cancelReceipt);
// Une échéance financière ne peut être supprimée que par un administrateur
// et seulement tant qu'aucun encaissement n'a été enregistré (contrôle dans
// le contrôleur). Les rôles de saisie conservent la gestion courante.
router.delete('/:id', adminOnly, ctrl.delete);

module.exports = router;
