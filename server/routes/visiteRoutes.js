const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { requireCapability } = require('../middleware/capabilityMiddleware');
// SECURITY-CLOSURE-P1-WAVE-1 (P1-B, finding RA-06) — routes staff sans
// aucune frontière tenant, contrairement au reste de la campagne. Même
// garde canonique que HF-FINAL-01/P0-B.
const { requireTenantScopeForStaffOrPlatformOperator } = require('../middleware/tenantContext');
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
  getAvailability,
} = require('../controllers/visiteController');

// 🔒 Toutes les routes nécessitent un token valide
router.use(protect);

// ── Routes statiques (AVANT /:id) ────────────────────────────────────────────

// Client : voir ses propres visites
router.get('/my', getMyVisites);

// Client : créneaux disponibles pour un bien à une date donnée
router.get('/availability', getAvailability);

// Propriétaire : voir les visites sur ses biens
router.get('/owner', restrictTo('Proprietaire', 'Admin'), getOwnerVisites);
router.get('/owner/unread-count', restrictTo('Proprietaire', 'Admin'), getOwnerUnreadCount);

// Staff : voir toutes les visites avec paiement requis
router.get('/all-payments', requireCapability('visits.read'), requireTenantScopeForStaffOrPlatformOperator, getAllPayments);

// Client : voir ses propres visites avec paiement requis
router.get('/my-payments', getMyPayments);

// Client : vérifie le statut d'un paiement YabetooPay (polling)
router.get('/paiement/verifier/:intentId', verifierPaiementVisite);

// Staff : voir toutes les visites
router.get('/unread-count', requireCapability('visits.read'), requireTenantScopeForStaffOrPlatformOperator, getUnreadCount);
router.get('/', requireCapability('visits.read'), requireTenantScopeForStaffOrPlatformOperator, getAllVisites);

// Client : créer une demande de visite
router.post('/', createVisite);

// ── Routes dynamiques ────────────────────────────────────────────────────────

// Client : initie un paiement YabetooPay pour une visite
router.post('/:id/paiement/initier', initierPaiementVisite);

// Staff : mettre à jour (dateProposee, dateConfirmee, statut, notes)
router.patch('/:id', requireCapability('visits.manage'), requireTenantScopeForStaffOrPlatformOperator, updateVisite);

// Staff : mettre à jour le paiement (paiementStatus, paiementRef)
router.patch('/:id/paiement', requireCapability('visits.manage'), requireTenantScopeForStaffOrPlatformOperator, updatePaiementVisite);

// Client : annuler sa propre visite
router.patch('/:id/cancel', cancelVisite);
router.patch('/:id/owner/:action(start|complete|client-absent|request-cancellation|report-incident)', restrictTo('Proprietaire', 'Admin'), ownerAction);

module.exports = router;
