const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/crmController');

const STAFF = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
router.use(auth.protect, auth.restrictTo(...STAFF));
router.post('/sync', controller.sync);
router.get('/customers', controller.listCustomers);
router.get('/customers/:customerId', controller.getCustomer);
router.post('/customers/:customerId/opportunities', controller.createOpportunity);
router.patch('/opportunities/:opportunityId/stage', controller.moveOpportunity);
router.post('/customers/:customerId/activities', controller.createActivity);
router.patch('/activities/:activityId', controller.updateActivity);

module.exports = router;
