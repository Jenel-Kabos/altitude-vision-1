const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/paiementController');

const protect = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];

router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.put('/:id',    protect, ctrl.update);
router.delete('/:id', protect, ctrl.delete);

module.exports = router;
