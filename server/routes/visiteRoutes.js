const express = require('express');
const { ROLES_UNIVERSAL } = require('../utils/roles');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createVisite,
  getMyVisites,
  getAllVisites,
  updateVisite,
  cancelVisite,
  getOwnerVisites,
} = require('../controllers/visiteController');

// 🔒 Toutes les routes nécessitent un token valide
router.use(protect);

// ── Routes statiques (AVANT /:id) ────────────────────────────────────────────

// Client : voir ses propres visites
router.get('/my', getMyVisites);

// Propriétaire : voir les visites sur ses biens
router.get('/owner', restrictTo('Proprietaire', 'Admin'), getOwnerVisites);

// Staff : voir toutes les visites
router.get('/', restrictTo(...ROLES_UNIVERSAL), getAllVisites);

// Client : créer une demande de visite
router.post('/', createVisite);

// ── Routes dynamiques ────────────────────────────────────────────────────────

// Staff : mettre à jour (dateProposee, dateConfirmee, statut, notes)
router.patch('/:id', restrictTo(...ROLES_UNIVERSAL), updateVisite);

// Client : annuler sa propre visite
router.patch('/:id/cancel', cancelVisite);

module.exports = router;
