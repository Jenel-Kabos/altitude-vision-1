const router = require('express').Router();
const auth = require('../controllers/authController');
const controller = require('../controllers/rentalContractRegularizationController');

const staff = [auth.protect, auth.restrictTo('Admin', 'GestionnaireImmobilier', 'Collaborateur')];
router.get('/', staff, controller.list);
router.post('/:contractId/decision', staff, controller.decide);
router.post('/:contractId/revert', auth.protect, auth.restrictTo('Admin'), controller.revert);

module.exports = router;
