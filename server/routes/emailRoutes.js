const express = require('express');
const router = express.Router();
const {
  getAllEmails,
  createEmail,
  updateEmail,
  deleteEmail,
  toggleEmailStatus,
  updateNotifications,
  getGlobalStats,
  sendEmailViaZoho,
  syncWithZoho
} = require('../services/emailService');

// Récupérer tous les emails
router.get('/', async (req, res) => {
  try {
    const emails = await getAllEmails();
    res.json(emails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Créer un nouvel email
router.post('/', async (req, res) => {
  try {
    const email = await createEmail(req.body);
    res.status(201).json(email);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mettre à jour un email
router.put('/:id', async (req, res) => {
  try {
    const email = await updateEmail(req.params.id, req.body);
    res.json(email);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Supprimer un email
router.delete('/:id', async (req, res) => {
  try {
    await deleteEmail(req.params.id);
    res.json({ message: 'Email supprimé avec succès' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Activer/Désactiver un email
router.patch('/:id/toggle', async (req, res) => {
  try {
    const email = await toggleEmailStatus(req.params.id);
    res.json(email);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mettre à jour les notifications
router.patch('/:id/notifications', async (req, res) => {
  try {
    const email = await updateNotifications(req.params.id, req.body.notifications);
    res.json(email);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Obtenir les statistiques
router.get('/stats/global', async (req, res) => {
  try {
    const stats = await getGlobalStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Envoyer un email via Zoho
router.post('/send', async (req, res) => {
  try {
    const { fromEmail, toEmail, subject, content } = req.body;
    const result = await sendEmailViaZoho(fromEmail, toEmail, subject, content);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Synchroniser avec Zoho
router.post('/sync-zoho', async (req, res) => {
  try {
    const result = await syncWithZoho();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;