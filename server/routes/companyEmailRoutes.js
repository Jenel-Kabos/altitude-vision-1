// server/routes/companyEmailRoutes.js
const express = require('express');
const companyEmailController = require('../controllers/companyEmailController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// ======================================================
// 🔒 PROTECTION - Toutes les routes sont réservées aux Admin/Collaborateurs
// ======================================================
router.use(protect);
router.use(restrictTo('Admin', 'Collaborateur'));

// ======================================================
// 📊 STATISTIQUES
// ======================================================
// GET /api/company-emails/stats - Récupérer les statistiques globales
router.get('/stats', companyEmailController.getGlobalStats);

// ======================================================
// 📋 LISTE & CRÉATION
// ======================================================
// GET /api/company-emails - Récupérer tous les emails
router.get('/', companyEmailController.getAllEmails);

// GET /api/company-emails/active - Récupérer uniquement les emails actifs
router.get('/active', companyEmailController.getActiveEmails);

// POST /api/company-emails - Créer un nouvel email
router.post('/', companyEmailController.createEmail);

// ======================================================
// 🔔 NOTIFICATIONS SPÉCIFIQUES
// ======================================================
// GET /api/company-emails/notifications/quotes - Emails recevant notifications devis
router.get('/notifications/quotes', companyEmailController.getQuoteNotificationEmails);

// GET /api/company-emails/notifications/contact - Emails recevant notifications contact
router.get('/notifications/contact', companyEmailController.getContactNotificationEmails);

// ======================================================
// 👤 PAR UTILISATEUR
// ======================================================
// GET /api/company-emails/user/:userId - Emails d'un collaborateur spécifique
router.get('/user/:userId', companyEmailController.getEmailsByUser);

// ======================================================
// 🔍 DÉTAILS, MISE À JOUR, SUPPRESSION
// ======================================================
// GET /api/company-emails/:id - Récupérer un email spécifique
router.get('/:id', companyEmailController.getEmailById);

// PUT /api/company-emails/:id - Mettre à jour un email
router.put('/:id', companyEmailController.updateEmail);

// DELETE /api/company-emails/:id - Supprimer un email (Admin uniquement)
router.delete('/:id', restrictTo('Admin'), companyEmailController.deleteEmail);

// ======================================================
// 🔄 ACTIONS SPÉCIFIQUES
// ======================================================
// PATCH /api/company-emails/:id/toggle-status - Activer/Désactiver
router.patch('/:id/toggle-status', companyEmailController.toggleEmailStatus);

// PATCH /api/company-emails/:id/notifications - Mettre à jour les notifications
router.patch('/:id/notifications', companyEmailController.updateNotifications);

// PATCH /api/company-emails/:id/increment-sent - Incrémenter emails envoyés
router.patch('/:id/increment-sent', companyEmailController.incrementSent);

// PATCH /api/company-emails/:id/increment-received - Incrémenter emails reçus
router.patch('/:id/increment-received', companyEmailController.incrementReceived);

module.exports = router;