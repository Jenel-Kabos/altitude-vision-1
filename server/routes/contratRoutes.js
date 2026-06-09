const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/contratController');

const protect   = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

router.get('/',       protect,   ctrl.getAll);
router.get('/:id',    protect,   ctrl.getOne);
router.post('/',      protect,   ctrl.create);
router.put('/:id',    adminOnly, ctrl.update);
router.delete('/:id', adminOnly, ctrl.delete);

// Paiements liés à un contrat
router.get( '/:id/paiements', protect, ctrl.getPaiements);
router.post('/:id/paiements', protect, ctrl.createPaiement);

module.exports = router;
