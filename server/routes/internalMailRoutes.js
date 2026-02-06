// server/routes/internalMailRoutes.js
const express = require('express');
const router = express.Router();

// ✅ IMPORT 1 : Sécurité unifiée
const authController = require('../controllers/authController');

// ✅ IMPORT 2 : Configuration Cloudinary (Pour les pièces jointes sur Render)
const upload = require('../config/cloudinary');

// ✅ IMPORT 3 : Le Contrôleur
const internalMailController = require('../controllers/internalMailController');

// 🔒 Sécurité : Toutes les routes nécessitent d'être connecté
router.use(authController.protect);

// ==========================================================
// --- 📌 Routes de récupération (GET) ---
// ==========================================================

// ✅ CRITIQUE : Cette route doit être en PREMIER pour éviter les conflits d'ID
router.get('/count/unread', internalMailController.getUnreadCount);

// Listes de messages
router.get('/received', internalMailController.getInbox);
router.get('/sent', internalMailController.getSent);
router.get('/unread', internalMailController.getUnread);
router.get('/starred', internalMailController.getStarred);
router.get('/drafts', internalMailController.getDrafts);
router.get('/trash', internalMailController.getTrash);


// ==========================================================
// --- 📤 Routes d'envoi et de gestion des brouillons ---
// ==========================================================

// Envoyer un email (avec pièces jointes Cloudinary)
// 'attachments' est le nom du champ dans le FormData, max 5 fichiers
router.post(
    '/', 
    upload.array('attachments', 5), 
    internalMailController.sendInternalMail
);

// Sauvegarder un brouillon
router.post(
    '/drafts', 
    upload.array('attachments', 5), 
    internalMailController.saveDraft
);

// Mettre à jour un brouillon
router.put(
    '/drafts/:draftId', 
    upload.array('attachments', 5), 
    internalMailController.updateDraft
);

// Supprimer un brouillon
router.delete('/drafts/:draftId', internalMailController.deleteDraft);


// ==========================================================
// --- 🗑️ Actions Globales ---
// ==========================================================

// Vider la corbeille (Doit être avant les routes dynamiques /:mailId)
router.delete('/trash/empty', internalMailController.emptyTrash);


// ==========================================================
// --- 🔗 Routes Dynamiques (Actions sur un email spécifique) ---
// ⚠️ Doivent être À LA FIN du fichier
// ==========================================================

// Lecture
router.patch('/:mailId/read', internalMailController.markAsRead);
router.patch('/:mailId/unread', internalMailController.markAsUnread);

// Favoris
router.patch('/:mailId/star', internalMailController.addStar);
router.patch('/:mailId/unstar', internalMailController.removeStar);

// Corbeille & Suppression
router.patch('/:mailId/trash', internalMailController.moveToTrash);
router.patch('/:mailId/restore', internalMailController.restoreFromTrash);
router.delete('/:mailId/permanent', internalMailController.permanentlyDelete);

module.exports = router;