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
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');

const router = express.Router();
router.use(auth.protect);

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-C — OWNERSHIP path.
// Un Proprietaire individuel peut gérer SES propres ressources sans passer
// par le rattachement tenant. `restrictTo('Proprietaire')` reste une garde
// GLOBAL User.role — jamais un rôle tenant. Le contrôleur filtre en interne
// par `owner: req.user.id`, ce qui constitue le contrat ownership.
router.get('/owner/payments', auth.restrictTo('Proprietaire'), ctrl.ownerPayments);
router.get('/owner/my', auth.restrictTo('Proprietaire'), ctrl.ownerList);
router.post('/:id/owner/:action', auth.restrictTo('Proprietaire'), ctrl.ownerRequest);

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-C — TENANT path.
// À partir d'ici toute route est tenant-scopée. La chaîne canonique est :
//   protect → requireTenantScope → requireTenantModule('location') → requireTenantMembershipRole(...)
// Aucune lecture de `User.role` comme autorité tenant. `requireTenantScope`
// pose `req.platformTenant` ; `requireTenantModule('location')` refuse si
// le tenant n'a pas souscrit / activé la gestion locative ; le membership
// role fournit l'autorité tenant. `restrictTo(...)` legacy et
// `requireCapability(...)` (qui lisait `User.role`) sont retirés sur cette
// section.
router.use(requireTenantScope);
router.use(requireTenantModule('location'));

// Rôles GL par action, dérivés du DEFAULT_CAPABILITIES existant :
//  - rental.read / occupancy.read / maintenance.read / notice.read
//    → GestionnaireImmobilier natif + Admin + Collaborateur (legacy.full)
//  - rental.manage / occupancy.manage / maintenance.manage / notice.manage
//    → GestionnaireImmobilier natif + Admin (mutations sensibles).
const GL_READ = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const GL_MANAGE = ['Admin', 'GestionnaireImmobilier'];

router.get('/onboarding/options', requireTenantMembershipRole(...GL_MANAGE), ctrl.onboardingOptions);
router.post('/onboarding', requireTenantMembershipRole(...GL_MANAGE), ctrl.onboard);

router.param('id', async (req, res, next, rentalId) => {
  try {
    // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-C — la garde cross-tenant
    // se déclenche pour toute route TENANT (celle qui a franchi
    // requireTenantMembershipRole → `req.tenantBusinessRole` renseigné). La
    // route OWNERSHIP `/:id/owner/:action` reste régie par le contrôleur
    // (filtre `owner: req.user.id`) — le path check `/owner/` la reconnaît.
    // L'ancien filtre `staffRoles.includes(req.user?.role)` reposait sur
    // User.role global comme proxy de "staff tenant" — obsolète après Lot C.
    if (req.path.includes('/owner/')) return next();
    // Tenant path — `requireTenantScope` + `requireTenantModule('location')`
    // ont déjà posé `req.platformTenant` avant router.param. On borne à ce
    // tenant l'attribution de la ressource : `router.param` s'exécute AVANT
    // `requireTenantMembershipRole` (défini par route), donc on ne peut pas
    // lire `req.tenantBusinessRole` ici — mais on n'en a pas besoin : le
    // membership est validé au niveau du handler, la garde ici se limite au
    // scope tenant de la ressource.
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

router.get('/stats', requireTenantMembershipRole(...GL_READ), ctrl.stats);
router.get('/', requireTenantMembershipRole(...GL_READ), ctrl.list);
router.post('/', requireTenantMembershipRole(...GL_MANAGE), ctrl.create);
router.get('/:id', requireTenantMembershipRole(...GL_READ), ctrl.getOne);
router.patch('/:id', requireTenantMembershipRole(...GL_MANAGE), ctrl.update);
router.post('/:id/deactivate', requireTenantMembershipRole(...GL_MANAGE), ctrl.deactivate);
router.get('/:id/history', requireTenantMembershipRole(...GL_READ), ctrl.history);
router.post('/:id/publish', requireTenantMembershipRole(...GL_MANAGE), ctrl.publish);
router.post('/:id/suspend-listing', requireTenantMembershipRole(...GL_MANAGE), ctrl.suspend);
router.post('/:id/mark-rented', requireTenantMembershipRole(...GL_MANAGE), ctrl.markRented);
router.post('/:id/mark-vacant', requireTenantMembershipRole(...GL_MANAGE), ctrl.markVacant);
router.post('/:id/maintenance', requireTenantMembershipRole(...GL_MANAGE), ctrl.markMaintenance);
router.post('/:id/complete-maintenance', requireTenantMembershipRole(...GL_MANAGE), ctrl.completeMaintenance);
router.post('/:id/start-notice', requireTenantMembershipRole(...GL_MANAGE), ctrl.startNotice);
router.post('/:id/acknowledge-notice', requireTenantMembershipRole(...GL_MANAGE), ctrl.acknowledgeNotice);
router.post('/:id/cancel-notice', requireTenantMembershipRole(...GL_MANAGE), ctrl.cancelNotice);
router.post('/:id/validate-exit', requireTenantMembershipRole(...GL_MANAGE), ctrl.validateExitInspection);
router.post('/:id/requests/:requestId/resolve', requireTenantMembershipRole(...GL_MANAGE), ctrl.resolveRequest);

module.exports = router;
