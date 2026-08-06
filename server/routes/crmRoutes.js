const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/crmController');

const STAFF = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
router.use(auth.protect, auth.restrictTo(...STAFF));
router.post('/sync', controller.sync);
router.get('/dashboard', controller.dashboard);
router.get('/pipeline', controller.pipeline);
router.get('/activities', controller.activities);
router.get('/search', controller.search);
router.get('/duplicates', controller.duplicates);
router.get('/duplicates/:customerA/:customerB', controller.compare);
router.get('/consolidations', controller.consolidations);
router.post('/consolidations', auth.restrictTo('Admin', 'GestionnaireImmobilier'), controller.consolidate);
router.get('/customers', controller.listCustomers);
router.get('/customers/:customerId', controller.getCustomer);
router.post('/customers/:customerId/opportunities', controller.createOpportunity);
router.patch('/opportunities/:opportunityId/stage', controller.moveOpportunity);
router.patch('/opportunities/:opportunityId/outcome', controller.setOpportunityOutcome);
router.post('/customers/:customerId/activities', controller.createActivity);
router.patch('/activities/:activityId', controller.updateActivity);

module.exports = router;
