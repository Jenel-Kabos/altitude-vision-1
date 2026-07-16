const express = require('express');
const { ROLES_UNIVERSAL } = require('../utils/roles');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createVisite,
  getMyVisites,
  getAllVisites,
  getUnreadCount,
  updateVisite,
  cancelVisite,
  getOwnerVisites,
  getOwnerUnreadCount,
  ownerAction,
  updatePaiementVisite,
  getAllPayments,
  getMyPayments,
  initierPaiementVisite,
  verifierPaiementVisite,
} = require('../controllers/visiteController');

// 🔒 Toutes les routes nécessitent un token valide
router.use(protect);

// ── Routes statiques (AVANT /:id) ────────────────────────────────────────────

// Client : voir ses propres visites
router.get('/my', getMyVisites);

// Propriétaire : voir les visites sur ses biens
router.get('/owner', restrictTo('Proprietaire', 'Admin'), getOwnerVisites);
router.get('/owner/unread-count', restrictTo('Proprietaire', 'Admin'), getOwnerUnreadCount);

// Staff : voir toutes les visites avec paiement requis
router.get('/all-payments', restrictTo(...ROLES_UNIVERSAL), getAllPayments);

// Client : voir ses propres visites avec paiement requis
router.get('/my-payments', getMyPayments);

// Client : vérifie le statut d'un paiement YabetooPay (polling)
router.get('/paiement/verifier/:intentId', verifierPaiementVisite);

// Staff : voir toutes les visites
router.get('/unread-count', restrictTo(...ROLES_UNIVERSAL), getUnreadCount);
router.get('/', restrictTo(...ROLES_UNIVERSAL), getAllVisites);

// Client : créer une demande de visite
router.post('/', createVisite);

// ── Routes dynamiques ────────────────────────────────────────────────────────

// Client : initie un paiement YabetooPay pour une visite
router.post('/:id/paiement/initier', initierPaiementVisite);

// Staff : mettre à jour (dateProposee, dateConfirmee, statut, notes)
router.patch('/:id', restrictTo(...ROLES_UNIVERSAL), updateVisite);

// Staff : mettre à jour le paiement (paiementStatus, paiementRef)
router.patch('/:id/paiement', restrictTo(...ROLES_UNIVERSAL), updatePaiementVisite);

// Client : annuler sa propre visite
router.patch('/:id/cancel', cancelVisite);
router.patch('/:id/owner/:action(start|complete|client-absent|request-cancellation|report-incident)', restrictTo('Proprietaire', 'Admin'), ownerAction);

module.exports = router;
