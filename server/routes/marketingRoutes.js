// MARKETING-AUTOMATION-1 — Routes Altcom Marketing. Même patron RBAC que
// crmAutomationRoutes.js : STAFF pour la lecture (segments, modèles,
// campagnes, journal), MANAGERS pour les écritures sensibles (créer/activer
// un modèle, créer/approuver/annuler/envoyer une campagne).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/marketingController');
const { requirePlatformOperatorCapability, requirePlatformScope } = require('../middleware/platformAuthority');

// Le CRM marketing est un workflow plateforme Altitude Vision. Un rôle ou
// une adhésion tenant ne confère jamais cette autorité.
router.use(auth.protect, requirePlatformOperatorCapability('platform.marketing.manage'), requirePlatformScope);

router.get('/segments', controller.listSegments);
router.get('/segments/:key/preview', controller.previewSegment);

router.get('/templates', controller.listTemplates);
router.get('/templates/:family/history', controller.templateHistory);
router.post('/templates', controller.createTemplateVersion);
router.patch('/templates/:id/activate', controller.activateTemplate);
router.post('/templates/:id/preview', controller.previewTemplate);

router.get('/campaigns', controller.listCampaigns);
router.post('/campaigns', controller.createCampaign);
router.patch('/campaigns/:id/approve', controller.approveCampaign);
router.patch('/campaigns/:id/cancel', controller.cancelCampaign);
router.post('/campaigns/:id/send', controller.sendCampaign);

router.get('/sends', controller.listSends);

module.exports = router;
