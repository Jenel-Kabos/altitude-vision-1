// server/routes/housekeepingRoutes.js — Sprint E
//
// Toutes les routes réservées propriétaire/staff (ownership vérifiée dans
// le contrôleur, jamais uniquement côté route — même convention que
// hotelRoutes.js/roomController). Mission §14 : le client n'a aucun accès —
// en pratique il n'est jamais `hotel.manager`, donc `assertHotelAccess`
// rejette systématiquement un compte Client (même mécanisme que
// roomController/roomAssignmentController, Sprint D).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/housekeepingController');

const router = express.Router();
router.use(auth.protect);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id/assign', ctrl.assign);
router.patch('/:id/start', ctrl.start);
router.patch('/:id/complete', ctrl.complete);
router.patch('/:id/cancel', ctrl.cancel);

module.exports = router;
