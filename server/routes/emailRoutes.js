// routes/emailRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { ROLES_DOCS } = require('../utils/roles');
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

// HOTFIX-INBOX-SECURITY-1 — ce routeur ne portait aucune authentification
// (aucun `protect` ici, aucune protection globale dans server.js — chaque
// routeur applique la sienne dans ce projet, jamais une couche commune).
// Politique dérivée de la preuve existante, pas inventée : le seul
// consommateur (`client/lib/services/emailService.js`, `ManageEmailsPage.jsx`
// sur /dashboard/emails) est déjà gaté côté menu par `ROLES_DOCS`
// (`AdminDashboard.jsx`, NAV_SECTIONS) — voir
// server/docs/HOTFIX_INBOX_SECURITY1_ETAT_INITIAL.md.
router.use(auth.protect, auth.restrictTo(...ROLES_DOCS));

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