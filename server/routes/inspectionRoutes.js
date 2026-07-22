// server/routes/inspectionRoutes.js — Sprint E
// Ownership vérifiée dans le contrôleur via la chambre (Room.hotel).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/inspectionController');

const router = express.Router();
router.use(auth.protect);

router.post('/', ctrl.create);
router.patch('/:id/approve', ctrl.approve);
router.patch('/:id/reject', ctrl.reject);

module.exports = router;
