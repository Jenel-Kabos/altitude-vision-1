const express = require('express');
const mongoose = require('mongoose');
const { ROLES_PAIEMENTS } = require('../utils/roles');
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

router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.get('/:id/proof', protect, ctrl.downloadProof);
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
