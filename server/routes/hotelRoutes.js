const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/hotelController');
const { ROLES_ALTIMMO } = require('../utils/roles');

const router = express.Router();
router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
