const express = require('express');
const mongoose = require('mongoose');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalManagementController');
const { ROLES_GL } = require('../utils/roles');
// TENANT-CERT-2 — audit adversarial : chaque route `:id` de ce routeur
// (getOne/update/deactivate/publish/suspend/mark-*/maintenance/notice/
// validate-exit/resolve) chargeait le RentalManagement demandé SANS aucune
// vérification tenant — un membre GL du Tenant A pouvait consulter/modifier
// n'importe quel dossier du Tenant B en devinant/connaissant son ObjectId
// (vulnérabilité confirmée par test adversarial, voir
// __tests__/tenantCert2.gl.adversarial.mongo.integration.test.js). Fixé une
// seule fois via `router.param('id', …)` — une couche transversale, jamais
// une modification de chacun des contrôleurs listés ci-dessous — en
// réutilisant la même `tenantResourceAttributionService.assertResourceTenant`
// déjà utilisée par Hotel/Finance/Documents/Conversations pour
// `RentalManagement`.
const RentalManagement = require('../models/RentalManagement');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');

const router = express.Router();
router.use(auth.protect);
router.get('/owner/my', auth.restrictTo('Proprietaire'), ctrl.ownerList);
router.post('/:id/owner/:action', auth.restrictTo('Proprietaire'), ctrl.ownerRequest);
router.get('/onboarding/options', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.onboardingOptions);
router.post('/onboarding', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.onboard);
router.use(auth.restrictTo(...ROLES_GL));

router.param('id', async (req, res, next, rentalId) => {
  try {
    if (!mongoose.isValidObjectId(rentalId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const rental = await RentalManagement.findById(rentalId);
    if (!rental) return res.status(404).json({ status: 'fail', message: 'Dossier introuvable.' });
    // Ce paramètre est partagé par la route self-service `/:id/owner/:action`
    // (Proprietaire, souvent sans aucun OrgMembership) : la propriété directe
    // du dossier suffit à elle seule, exactement comme le reste du domaine
    // Property/GL — jamais bloquée par l'absence de contexte tenant.
    if (rental.owner && String(rental.owner) === String(req.user._id || req.user.id)) return next();
    // Un dossier dont le propriétaire n'a lui-même aucune attribution
    // tenant traçable (données antérieures à PlatformTenant) n'a aucune
    // frontière tenant à faire respecter — voir
    // assertResourceTenantOrUnattributed.
    const tenant = await resolveTenantForUser(req.user._id || req.user.id);
    await assertResourceTenantOrUnattributed({ resourceType: 'RentalManagement', resource: rental, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Dossier introuvable.' });
  }
});

router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.post('/:id/deactivate', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.deactivate);
router.get('/:id/history', ctrl.history);
router.post('/:id/publish', ctrl.publish);
router.post('/:id/suspend-listing', ctrl.suspend);
router.post('/:id/mark-rented', ctrl.markRented);
router.post('/:id/mark-vacant', ctrl.markVacant);
router.post('/:id/maintenance', ctrl.markMaintenance);
router.post('/:id/complete-maintenance', ctrl.completeMaintenance);
router.post('/:id/start-notice', ctrl.startNotice);
router.post('/:id/acknowledge-notice', ctrl.acknowledgeNotice);
router.post('/:id/cancel-notice', ctrl.cancelNotice);
router.post('/:id/validate-exit', ctrl.validateExitInspection);
router.post('/:id/requests/:requestId/resolve', ctrl.resolveRequest);

module.exports = router;
