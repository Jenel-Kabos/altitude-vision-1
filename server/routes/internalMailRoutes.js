// server/routes/internalMailRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadAttachments } = require('../middleware/uploadMiddleware');

const {
  sendInternalMail,
  saveDraft,
  updateDraft,
  deleteDraft,
  getInbox,
  getSent,
  getUnread,
  getStarred,
  getDrafts,
  getTrash,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  addStar,
  removeStar,
  moveToTrash,
  restoreFromTrash,
  permanentlyDelete,
  emptyTrash,
} = require('../controllers/internalMailController');

// ==========================================================
// --- 📌 Routes de récupération (GET) ---
// ==========================================================

// Routes spécifiques (doivent être avant les routes dynamiques)
router.get('/received', protect, getInbox);
router.get('/sent', protect, getSent);
router.get('/unread', protect, getUnread);
router.get('/starred', protect, getStarred);
router.get('/drafts', protect, getDrafts);
router.get('/trash', protect, getTrash);
router.get('/count/unread', protect, getUnreadCount);

// ==========================================================
// --- 📤 Routes d'envoi et de gestion des brouillons ---
// ==========================================================

// Envoyer un email
router.post('/', protect, uploadAttachments, sendInternalMail);

// Gestion des brouillons
router.post('/drafts', protect, uploadAttachments, saveDraft);
router.put('/drafts/:draftId', protect, uploadAttachments, updateDraft);
router.delete('/drafts/:draftId', protect, deleteDraft);

// ==========================================================
// --- 🗑️ Gestion de la corbeille ---
// ==========================================================

// Vider la corbeille (doit être avant /:mailId)
router.delete('/trash/empty', protect, emptyTrash);

// ==========================================================
// --- ✏️ Routes de modification (PATCH/DELETE) ---
// ==========================================================

// Marquer comme lu/non lu
router.patch('/:mailId/read', protect, markAsRead);
router.patch('/:mailId/unread', protect, markAsUnread);

// Gérer les favoris
router.patch('/:mailId/star', protect, addStar);
router.patch('/:mailId/unstar', protect, removeStar);

// Corbeille
router.patch('/:mailId/trash', protect, moveToTrash);
router.patch('/:mailId/restore', protect, restoreFromTrash);
router.delete('/:mailId/permanent', protect, permanentlyDelete);

module.exports = router;