// MARKETING-AUTOMATION-1 — Routes Altcom Marketing. Même patron RBAC que
// crmAutomationRoutes.js : STAFF pour la lecture (segments, modèles,
// campagnes, journal), MANAGERS pour les écritures sensibles (créer/activer
// un modèle, créer/approuver/annuler/envoyer une campagne).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/marketingController');
const { ROLES_CM } = require('../utils/roles');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');

const STAFF = ROLES_CM; // ['Admin', 'Collaborateur', 'CommunityManager'] — même périmètre qu'Altcom
const MANAGERS = ['Admin', 'CommunityManager'];

router.use(auth.protect, requireTenantScope, requireTenantMembershipRole(...STAFF));

router.get('/segments', controller.listSegments);
router.get('/segments/:key/preview', controller.previewSegment);

router.get('/templates', controller.listTemplates);
router.get('/templates/:family/history', controller.templateHistory);
router.post('/templates', requireTenantMembershipRole(...MANAGERS), controller.createTemplateVersion);
router.patch('/templates/:id/activate', requireTenantMembershipRole(...MANAGERS), controller.activateTemplate);
router.post('/templates/:id/preview', controller.previewTemplate);

router.get('/campaigns', controller.listCampaigns);
router.post('/campaigns', requireTenantMembershipRole(...MANAGERS), controller.createCampaign);
router.patch('/campaigns/:id/approve', requireTenantMembershipRole(...MANAGERS), controller.approveCampaign);
router.patch('/campaigns/:id/cancel', requireTenantMembershipRole(...MANAGERS), controller.cancelCampaign);
router.post('/campaigns/:id/send', requireTenantMembershipRole(...MANAGERS), controller.sendCampaign);

router.get('/sends', controller.listSends);

module.exports = router;
