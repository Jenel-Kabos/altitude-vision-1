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
const { resolveActiveOperator, hasCapability } = require('../services/platformOperator/platformOperatorService');

router.use(auth.protect, auth.restrictTo('Admin'));

// PLATFORM-ADMIN-1 — remplace l'ancienne vérification par appartenance
// seule. Un PlatformOperator ACTIF détenant `platform.tenants.read` (ou
// `.manage` pour les mutations, vérifié séparément par route) peut agir sur
// N'IMPORTE QUEL tenant, y compris suspendu/archivé (jamais filtré par
// statut ici — un opérateur doit pouvoir réactiver un tenant suspendu).
// Sans capacité opérateur active, comportement STRICTEMENT inchangé depuis
// TENANT-CERT-3-FINAL : appartenance requise, aucune exception.
async function assertOwnTenantOrPlatformOperator(req, targetTenantId, { capability = 'platform.tenants.read' } = {}) {
  const operator = await resolveActiveOperator(req.user._id || req.user.id);
  if (operator && hasCapability(operator, capability)) {
    req.isPlatformOperatorContext = true;
    req.platformOperatorCapabilities = operator.capabilities || [];
    return;
  }
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

// GET → capacité lecture suffit ; toute autre méthode (PATCH/POST/DELETE)
// mute l'état d'un tenant → capacité `.manage` requise. Sans objet pour la
// branche "Admin de son propre tenant" (aucune capacité vérifiée dans ce
// cas, comportement historique inchangé).
const mutationCapability = (req) => (req.method === 'GET' ? 'platform.tenants.read' : 'platform.tenants.manage');

router.param('id', async (req, res, next, tenantId) => {
  try {
    if (!mongoose.isValidObjectId(tenantId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    await assertOwnTenantOrPlatformOperator(req, tenantId, { capability: mutationCapability(req) });
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
    await assertOwnTenantOrPlatformOperator(req, domain.tenant, { capability: mutationCapability(req) });
    next();
  } catch (error) {
    res.status(error.statusCode || 403).json({ status: 'fail', message: error.statusCode ? error.message : 'Action refusée.' });
  }
});

// PLATFORM-ADMIN-1 — `GET /` (liste) et `POST /` (création) restent
// inaccessibles à quiconque n'est PAS un PlatformOperator actif avec la
// capacité requise. Un Tenant Admin (même avec de multiples memberships)
// continue de recevoir 403 ici, exactement comme avant — seule l'existence
// d'un opérateur réel change l'issue.
const requirePlatformOperatorCapability = (capability) => async (req, res, next) => {
  const operator = await resolveActiveOperator(req.user._id || req.user.id).catch(() => null);
  if (!operator || !hasCapability(operator, capability)) {
    return res.status(403).json({ status: 'fail', message: 'Action refusée : aucune capacité opérateur plateforme vérifiable.' });
  }
  req.isPlatformOperatorContext = true;
  req.platformOperatorCapabilities = operator.capabilities || [];
  next();
};

router.get('/', requirePlatformOperatorCapability('platform.tenants.read'), controller.listTenants);
router.post('/', requirePlatformOperatorCapability('platform.tenants.manage'), controller.createTenant);
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
