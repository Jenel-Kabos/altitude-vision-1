// server/routes/rentalPropertyRoutes.js — Sprint A (séparation Vente/Location).
const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalPropertyController');
const { ROLES_ALTIMMO } = require('../utils/roles');

const router = express.Router();
router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO));

router.post('/', ctrl.createFull);
router.put('/:propertyId', ctrl.updateFull);

module.exports = router;
