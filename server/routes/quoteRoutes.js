// server/routes/quoteRoutes.js
const express = require('express');
const quoteController = require('../controllers/quoteController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================================================
// 📤 ROUTE PUBLIQUE - Soumettre une demande de devis
// ======================================================
// POST /api/v1/quotes
// Accessible à tous (clients non connectés)
router.post('/', quoteController.createQuoteRequest);

// ======================================================
// 🔒 PROTECTION - Routes suivantes réservées aux admins/collaborateurs
// ======================================================
router.use(authController.protect);
router.use(authController.restrictTo('Admin', 'Collaborateur'));

// ======================================================
// 📊 STATISTIQUES - Récupérer les stats des devis
// ======================================================
// GET /api/v1/quotes/stats
router.get('/stats', quoteController.getQuoteStats);

// ======================================================
// 📋 LISTE & DÉTAILS - Gérer tous les devis
// ======================================================
// GET /api/v1/quotes - Récupérer tous les devis
router.get('/', quoteController.getAllQuotes);

// GET /api/v1/quotes/:id - Récupérer un devis spécifique
router.get('/:id', quoteController.getQuoteById);

// ======================================================
// ✏️ MISE À JOUR - Modifier le statut d'un devis
// ======================================================
// PATCH /api/v1/quotes/:id
router.patch('/:id', quoteController.updateQuoteStatus);

// ======================================================
// 📧 RÉPONSE - Envoyer un devis au client
// ======================================================
// POST /api/v1/quotes/:id/respond
router.post('/:id/respond', quoteController.sendQuoteResponse);

// ======================================================
// 🗑️ SUPPRESSION - Supprimer un devis (Admin uniquement)
// ======================================================
// DELETE /api/v1/quotes/:id
router.delete(
    '/:id',
    authController.restrictTo('Admin'), // Seul Admin peut supprimer
    quoteController.deleteQuote
);

module.exports = router;