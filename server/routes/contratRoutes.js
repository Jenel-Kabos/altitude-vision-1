const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/contratController');
// TENANT-CERT-2 — audit adversarial : GET/PUT/DELETE `:id` (et les routes
// paiements imbriquées) chargeaient le Contrat demandé sans aucune
// vérification tenant, un membre STAFF_IMMO/STAFF_DOC du Tenant A pouvait
// consulter/modifier/supprimer un contrat du Tenant B en connaissant son
// ObjectId (vulnérabilité confirmée par test adversarial, voir
// __tests__/tenantCert2.gl.adversarial.mongo.integration.test.js). Même
// couche transversale que rentalManagementRoutes.js — `router.param('id')`,
// jamais une modification contrôleur par contrôleur.
const Contrat = require('../models/Contrat');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requireCapability } = require('../middleware/capabilityMiddleware');

const manageLeases = [auth.protect, requireCapability('leases.manage')];
const readLeases = [auth.protect, requireCapability('leases.read')];
const managePayments = [auth.protect, requireCapability('payments.manage')];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

// TENANT-CERT-2 — `router.param('id', …)` s'exécute AVANT le tableau de
// middlewares propre à chaque route (donc avant `auth.protect` ci-dessus) :
// sans cette ligne, `req.user` serait encore indéfini au moment du contrôle
// tenant (bug réel constaté lors de la certification). Toutes les routes de
// ce fichier exigent déjà une authentification staff, donc aucune route
// publique n'est affectée.
router.use(auth.protect);

router.param('id', async (req, res, next, contratId) => {
  try {
    if (!mongoose.isValidObjectId(contratId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const contrat = await Contrat.findById(contratId);
    if (!contrat) return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    // Un Contrat sans `bien` réellement lié (adresse en texte libre,
    // données antérieures à PlatformTenant) n'a aucune frontière tenant à
    // faire respecter — voir assertResourceTenantOrUnattributed.
    // PLATFORM-ADMIN-1 — voir paiementRoutes.js pour la même justification :
    // sans transmission explicite, un PlatformOperator resterait bloqué même
    // après sélection d'un tenant dans l'UI.
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Contrat', resource: contrat, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Contrat introuvable.' });
  }
});

router.get('/', readLeases, ctrl.getAll);
router.get('/:id', readLeases, ctrl.getOne);
router.post('/', manageLeases, ctrl.create);
router.put('/:id', manageLeases, ctrl.update);
router.delete('/:id', adminOnly, ctrl.delete);

// Paiements liés à un contrat
router.get('/:id/paiements', requireCapability('leases.read', 'payments.read'), ctrl.getPaiements);
router.post('/:id/paiements', managePayments, ctrl.createPaiement);

module.exports = router;
