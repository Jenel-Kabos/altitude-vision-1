// server/routes/webhookRoutes.js
const express = require('express');
const router  = express.Router();
const { handleZohoIncoming, testWebhook } = require('../controllers/webhookController');

// ⚠️  PAS de middleware JWT ici — Zoho appelle directement
// La sécurité est assurée par ZOHO_WEBHOOK_SECRET (HMAC SHA-256)

// Route de test — vérifier que le webhook est joignable
router.get('/test', testWebhook);

// Route principale — recevoir les emails entrants de Zoho
router.post('/zoho-incoming', handleZohoIncoming);

module.exports = router;