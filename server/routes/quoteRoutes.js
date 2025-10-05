const express = require('express');
const router = express.Router();
const { createQuote } = require('../controllers/quoteController');

// Route pour '/api/quotes'
// N'importe quel visiteur peut envoyer une requête POST pour créer un devis.
router.route('/').post(createQuote);

module.exports = router;