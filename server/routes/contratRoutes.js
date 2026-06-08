const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/contratController');

const protect = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];

router.get('/',    protect, ctrl.getAll);
router.get('/:id', protect, ctrl.getOne);
router.post('/',   protect, ctrl.create);
router.put('/:id', protect, ctrl.update);
router.delete('/:id', protect, ctrl.delete);

// Paiements liés à un contrat
router.get( '/:id/paiements', protect, ctrl.getPaiements);
router.post('/:id/paiements', protect, ctrl.createPaiement);

module.exports = router;
