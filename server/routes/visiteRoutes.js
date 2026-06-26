const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createVisite,
  getMyVisites,
  getAllVisites,
  updateVisite,
  cancelVisite,
} = require('../controllers/visiteController');

// 🔒 Toutes les routes nécessitent un token valide
router.use(protect);

// ── Routes statiques (AVANT /:id) ────────────────────────────────────────────

// Client : voir ses propres visites
router.get('/my', getMyVisites);

// Staff : voir toutes les visites
router.get('/', restrictTo('Admin', 'Collaborateur'), getAllVisites);

// Client : créer une demande de visite
router.post('/', createVisite);

// ── Routes dynamiques ────────────────────────────────────────────────────────

// Staff : mettre à jour (dateProposee, dateConfirmee, statut, notes)
router.patch('/:id', restrictTo('Admin', 'Collaborateur'), updateVisite);

// Client : annuler sa propre visite
router.patch('/:id/cancel', cancelVisite);

module.exports = router;
