// MARKETING-AUTOMATION-1 — Routes Altcom Marketing. Même patron RBAC que
// crmAutomationRoutes.js : STAFF pour la lecture (segments, modèles,
// campagnes, journal), MANAGERS pour les écritures sensibles (créer/activer
// un modèle, créer/approuver/annuler/envoyer une campagne).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/marketingController');
const { ROLES_CM } = require('../utils/roles');

const STAFF = ROLES_CM; // ['Admin', 'Collaborateur', 'CommunityManager'] — même périmètre qu'Altcom
const MANAGERS = ['Admin', 'CommunityManager'];

router.use(auth.protect, auth.restrictTo(...STAFF));

router.get('/segments', controller.listSegments);
router.get('/segments/:key/preview', controller.previewSegment);

router.get('/templates', controller.listTemplates);
router.get('/templates/:family/history', controller.templateHistory);
router.post('/templates', auth.restrictTo(...MANAGERS), controller.createTemplateVersion);
router.patch('/templates/:id/activate', auth.restrictTo(...MANAGERS), controller.activateTemplate);
router.post('/templates/:id/preview', controller.previewTemplate);

router.get('/campaigns', controller.listCampaigns);
router.post('/campaigns', auth.restrictTo(...MANAGERS), controller.createCampaign);
router.patch('/campaigns/:id/approve', auth.restrictTo(...MANAGERS), controller.approveCampaign);
router.patch('/campaigns/:id/cancel', auth.restrictTo(...MANAGERS), controller.cancelCampaign);
router.post('/campaigns/:id/send', auth.restrictTo(...MANAGERS), controller.sendCampaign);

router.get('/sends', controller.listSends);

module.exports = router;
