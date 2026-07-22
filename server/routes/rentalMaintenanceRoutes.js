// server/routes/rentalMaintenanceRoutes.js — Sprint GL-B2
// Ownership vérifiée dans le contrôleur (propriétaire du bien ou staff ROLES_GL).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalMaintenanceController');

const router = express.Router();
router.use(auth.protect);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id/assign', ctrl.assign);
router.patch('/:id/schedule', ctrl.schedule);
router.patch('/:id/start', ctrl.start);
router.patch('/:id/resolve', ctrl.resolve);
router.patch('/:id/close', ctrl.close);

module.exports = router;
