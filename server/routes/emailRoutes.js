// routes/emailRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllEmails,
  getActiveEmails,
  getGlobalStats,
  getQuoteNotificationEmails,
  getContactNotificationEmails,
  getEmailsByUser,
  getEmailById,
  createEmail,
  updateEmail,
  deleteEmail,
  toggleEmailStatus,
  updateNotifications,
  sendEmailViaZoho,
  syncWithZoho
} = require('../controllers/emailController');

// ⚠️ IMPORTANT : Les routes spécifiques DOIVENT être déclarées
// AVANT les routes avec paramètres dynamiques (/:id)
// sinon Express interprète "stats", "active", etc. comme des :id

// ─────────────────────────────────────────────
// 📋 Routes GET spécifiques (sans paramètre)
// ─────────────────────────────────────────────
router.get('/active',                   getActiveEmails);
router.get('/stats/global',             getGlobalStats);
router.get('/notifications/quotes',     getQuoteNotificationEmails);
router.get('/notifications/contact',    getContactNotificationEmails);
router.get('/user/:userId',             getEmailsByUser);

// ─────────────────────────────────────────────
// 📋 Routes CRUD de base
// ─────────────────────────────────────────────
router.get('/',    getAllEmails);
router.post('/',   createEmail);

// ─────────────────────────────────────────────
// 📤 Routes d'action (sans :id)
// ─────────────────────────────────────────────
router.post('/send',       sendEmailViaZoho);
router.post('/sync-zoho',  syncWithZoho);

// ─────────────────────────────────────────────
// 🔑 Routes avec paramètre dynamique /:id
// Ces routes DOIVENT être en dernier
// ─────────────────────────────────────────────
router.get('/:id',                      getEmailById);
router.put('/:id',                      updateEmail);
router.delete('/:id',                   deleteEmail);
router.patch('/:id/toggle',             toggleEmailStatus);
router.patch('/:id/notifications',      updateNotifications);

module.exports = router;