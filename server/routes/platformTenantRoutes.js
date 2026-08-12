// TENANT-CORE-1 — Administration SaaS, réservée Admin (même périmètre que
// ORGANIZATION_ADMIN/API_PLATFORM_ADMIN/ERP_DASHBOARD, dont ce module est
// la couche englobante).
//
// TENANT-CERT-3-PRE — vulnérabilité critique découverte et corrigée : ce
// routeur n'imposait AUCUNE frontière tenant sur les routes `:id` — tout
// utilisateur `role === 'Admin'` (y compris l'admin bootstrap d'un tenant
// donné, créé avec ce même rôle par `platformTenantService.createTenant`,
// voir les fixtures `createTenantFixture`) pouvait suspendre, réarchiver,
// reconfigurer settings/theme/domaines/features/abonnement, ou consulter
// l'overview de N'IMPORTE QUEL AUTRE tenant. Il n'existe aucune capacité
// "Platform Admin" distincte de `role === 'Admin'` dans ce dépôt (confirmé
// par TENANT-HARDENING-2 §8 : "role === 'Admin' ne donne jamais un accès
// global" — cette route en était l'exception non auditée). Corrigé sans
// inventer de nouveau rôle : un Admin membre d'AU MOINS UN tenant (via
// `resolveAvailableTenantsForUser`, le même service déjà utilisé partout
// ailleurs) ne peut agir que sur SES PROPRES tenants. TENANT-CERT-3-FINAL
// a démontré qu'assimiler l'absence de membership à un opérateur plateforme
// permettait à un Admin tenant de devenir global par simple révocation de sa
// dernière membership. Aucun rôle/capability/provisionnement plus fort
// n'existe actuellement : l'absence d'appartenance échoue donc fermée.
// TENANT-CERT-3-FINAL a également reproduit que `GET /` exposait Tenant B
// à Admin A et que `POST /` lui permettait de créer un tenant. Tant qu'une
// capacité opérateur plateforme vérifiable n'existe pas, ces deux opérations
// globales HTTP échouent fermées. Le service interne de bootstrap demeure
// disponible aux processus contrôlés et aux fixtures.
const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/platformTenantController');
const PlatformTenantDomain = require('../models/PlatformTenantDomain');
const { resolveAvailableTenantsForUser } = require('../services/platformTenant/tenantContextService');

router.use(auth.protect, auth.restrictTo('Admin'));

async function assertOwnTenantOrPlatformOperator(req, targetTenantId) {
  const tenants = await resolveAvailableTenantsForUser(req.user._id || req.user.id);
  if (!tenants || tenants.length === 0) {
    const error = new Error('Action refusée : aucune capacité opérateur plateforme vérifiable.');
    error.statusCode = 403;
    throw error;
  }
  const allowed = tenants.some((t) => String(t._id) === String(targetTenantId));
  if (!allowed) {
    const error = new Error('Action réservée à un opérateur plateforme ou au tenant concerné.');
    error.statusCode = 403;
    throw error;
  }
}

router.param('id', async (req, res, next, tenantId) => {
  try {
    if (!mongoose.isValidObjectId(tenantId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    await assertOwnTenantOrPlatformOperator(req, tenantId);
    next();
  } catch (error) {
    res.status(error.statusCode || 403).json({ status: 'fail', message: error.statusCode ? error.message : 'Action refusée.' });
  }
});

// `/domains/:domainId/verify` ne porte pas `:id` — le tenant concerné doit
// être résolu depuis le domaine lui-même avant d'appliquer la même garde.
router.param('domainId', async (req, res, next, domainId) => {
  try {
    if (!mongoose.isValidObjectId(domainId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const domain = await PlatformTenantDomain.findById(domainId).select('tenant').lean();
    if (!domain) return res.status(404).json({ status: 'fail', message: 'Domaine introuvable.' });
    await assertOwnTenantOrPlatformOperator(req, domain.tenant);
    next();
  } catch (error) {
    res.status(error.statusCode || 403).json({ status: 'fail', message: error.statusCode ? error.message : 'Action refusée.' });
  }
});

const rejectUnprovenPlatformOperation = (req, res) => res.status(403).json({
  status: 'fail', message: 'Action refusée : aucune capacité opérateur plateforme vérifiable.',
});

router.get('/', rejectUnprovenPlatformOperation);
router.post('/', rejectUnprovenPlatformOperation);
router.get('/:id', controller.getTenantOverview);
router.patch('/:id/suspend', controller.suspendTenant);
router.patch('/:id/reactivate', controller.reactivateTenant);
router.patch('/:id/archive', controller.archiveTenant);

router.patch('/:id/settings', controller.updateSettings);
router.patch('/:id/theme', controller.updateTheme);

router.post('/:id/domains', controller.addDomain);
router.patch('/domains/:domainId/verify', controller.verifyDomain);

router.get('/:id/features', controller.listFeatures);
router.patch('/:id/features/:module', controller.setFeature);

router.post('/:id/subscription', controller.changeSubscription);
router.delete('/:id/subscription', controller.cancelSubscription);

module.exports = router;
