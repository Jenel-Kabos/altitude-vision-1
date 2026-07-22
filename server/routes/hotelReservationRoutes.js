// server/routes/hotelReservationRoutes.js — Sprint C
//
// Ordre volontairement conforme à l'audit du mois précédent
// (routes-ordering) : TOUTES les routes littérales (/mine, /owner,
// /admin/list, /status/pending) sont déclarées avant tout paramètre
// dynamique à segment équivalent (/:id, /:id/cancel, /:id/confirm...), et
// les routes à action nommée (/:id/cancel) avant le fallback générique
// (/:id) — jamais l'inverse.

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/hotelReservationController');
const { ROLES_ALTIMMO } = require('../utils/roles');

const router = express.Router();
router.use(auth.protect);

// Client connecté — littéral, avant /:id.
router.get('/mine', ctrl.mine);

// Propriétaire (+ staff, ownership vérifiée dans le contrôleur) — littéral,
// avant /:id.
router.get('/owner', ctrl.ownerList);
router.post('/owner', ctrl.ownerCreate);

// Administration — littéral, avant /:id.
router.get('/admin/list', auth.restrictTo(...ROLES_ALTIMMO), ctrl.listAdmin);
router.get('/status/pending', auth.restrictTo(...ROLES_ALTIMMO), ctrl.pending);

// Actions nommées à 2 segments — avant le fallback générique /:id.
router.patch('/:id/cancel', ctrl.cancel);
router.patch('/:id/confirm', ctrl.confirm);
router.patch('/:id/reject', ctrl.reject);
// Sprint D — jamais accessible au client (ownership vérifiée dans le contrôleur).
router.patch('/:id/check-in', ctrl.checkIn);
router.patch('/:id/check-out', ctrl.checkOut);
// Correctif Sprint D — lecture persistante de l'affectation active (voir
// mission "AFFECTATION PERSISTANTE"). Accessible au client, mais projection
// nulle avant check-in (contrôlée dans le contrôleur).
router.get('/:id/room-assignment', ctrl.getRoomAssignment);

// Génériques — toujours en dernier.
router.patch('/:id', ctrl.update);
router.get('/:id', ctrl.getOne);

module.exports = router;
