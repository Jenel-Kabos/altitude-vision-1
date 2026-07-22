// server/routes/maintenanceRoutes.js — Sprint E
// Ownership vérifiée dans le contrôleur (assertHotelAccess).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/maintenanceController');

const router = express.Router();
router.use(auth.protect);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id/assign', ctrl.assign);
router.patch('/:id/start', ctrl.start);
router.patch('/:id/resolve', ctrl.resolve);
router.patch('/:id/close', ctrl.close);

module.exports = router;
