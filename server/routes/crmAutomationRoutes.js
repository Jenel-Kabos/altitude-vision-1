// CRM-AUTOMATION-1 — Routes admin du moteur d'automatisation. Même
// périmètre staff que crmRoutes.js ; les écritures (créer/modifier/activer)
// sont réservées à Admin/GestionnaireImmobilier, la lecture (règles,
// journal, score, cockpit) au staff CRM au sens large.
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/crmAutomationController');

const STAFF = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
const MANAGERS = ['Admin', 'GestionnaireImmobilier'];

router.use(auth.protect, auth.restrictTo(...STAFF));

router.get('/rules', controller.listRules);
router.post('/rules', auth.restrictTo(...MANAGERS), controller.createRule);
router.patch('/rules/:id', auth.restrictTo(...MANAGERS), controller.updateRule);
router.patch('/rules/:id/enabled', auth.restrictTo(...MANAGERS), controller.setEnabled);
router.post('/simulate', auth.restrictTo(...MANAGERS), controller.simulate);
router.get('/runs', controller.listRuns);
router.get('/score/:customerId', controller.getCustomerScore);
router.get('/cockpit', controller.getCockpit);

module.exports = router;
