const express = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/contratController');

const protect   = [auth.protect, auth.restrictTo(...STAFF_IMMO)];
const readAll   = [auth.protect, auth.restrictTo(...STAFF_IMMO, 'Secretaire')];
const docOnly   = [auth.protect, auth.restrictTo(...STAFF_DOC)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

router.get('/',       readAll,  ctrl.getAll);
router.get('/:id',    readAll,  ctrl.getOne);
router.post('/',      protect,  ctrl.create);
router.put('/:id',    protect,  ctrl.update);
router.delete('/:id', protect,  ctrl.delete);

// Paiements liés à un contrat
router.get( '/:id/paiements', readAll,  ctrl.getPaiements);
router.post('/:id/paiements', docOnly,  ctrl.createPaiement);

module.exports = router;
