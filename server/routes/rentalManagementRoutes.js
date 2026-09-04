const express = require('express');
const mongoose = require('mongoose');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalManagementController');
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
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireCapability } = require('../middleware/capabilityMiddleware');

const router = express.Router();
router.use(auth.protect);
router.get('/owner/payments', auth.restrictTo('Proprietaire'), ctrl.ownerPayments);
router.get('/owner/my', auth.restrictTo('Proprietaire'), ctrl.ownerList);
router.post('/:id/owner/:action', auth.restrictTo('Proprietaire'), ctrl.ownerRequest);
router.use(requireTenantScope);
router.get('/onboarding/options', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.onboardingOptions);
router.post('/onboarding', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.onboard);

router.param('id', async (req, res, next, rentalId) => {
  try {
    // Les routes staff appliquent ensuite leur capability. Ne pas révéler
    // l'existence d'un dossier (404) à un compte non-staff avant son 403.
    // La route self-service propriétaire conserve son contrôle ressource.
    const staffRoles = ['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'];
    if (!staffRoles.includes(req.user?.role) && !req.path.includes('/owner/')) return next();
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
    // PLATFORM-ADMIN-CERT-1 — voir accommodationController.js pour la même justification.
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'RentalManagement', resource: rental, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Dossier introuvable.' });
  }
});

router.get('/stats', requireCapability('rental.read'), ctrl.stats);
router.get('/', requireCapability('rental.read'), ctrl.list);
router.post('/', requireCapability('rental.manage'), ctrl.create);
router.get('/:id', requireCapability('rental.read'), ctrl.getOne);
router.patch('/:id', requireCapability('rental.manage'), ctrl.update);
router.post('/:id/deactivate', auth.restrictTo('Admin', 'GestionnaireImmobilier'), ctrl.deactivate);
router.get('/:id/history', requireCapability('rental.read'), ctrl.history);
router.post('/:id/publish', requireCapability('rental.manage'), ctrl.publish);
router.post('/:id/suspend-listing', requireCapability('rental.manage'), ctrl.suspend);
router.post('/:id/mark-rented', requireCapability('occupancy.manage'), ctrl.markRented);
router.post('/:id/mark-vacant', requireCapability('occupancy.manage'), ctrl.markVacant);
router.post('/:id/maintenance', requireCapability('maintenance.manage'), ctrl.markMaintenance);
router.post('/:id/complete-maintenance', requireCapability('maintenance.manage'), ctrl.completeMaintenance);
router.post('/:id/start-notice', requireCapability('notice.manage'), ctrl.startNotice);
router.post('/:id/acknowledge-notice', requireCapability('notice.manage'), ctrl.acknowledgeNotice);
router.post('/:id/cancel-notice', requireCapability('notice.manage'), ctrl.cancelNotice);
router.post('/:id/validate-exit', requireCapability('occupancy.manage'), ctrl.validateExitInspection);
router.post('/:id/requests/:requestId/resolve', requireCapability('rental.manage'), ctrl.resolveRequest);

module.exports = router;
