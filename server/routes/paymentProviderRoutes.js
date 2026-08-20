// PAY-4 — routeur dédié aux callbacks provider de paiement, monté hors de
// `/api/financial` (public, sans JWT — un provider externe ne s'authentifie
// jamais comme un utilisateur applicatif). Conformément au mandat PAY-3 §30,
// aucune route vide n'est créée pour des providers non implémentés : seul
// `mtn` existe ici, `airtel`/`yabetoo`/`card` seront ajoutés au sprint qui
// les implémentera réellement, jamais avant.
const express = require('express');
const router = express.Router();
const mtnCtrl = require('../controllers/mtnMomoPaymentController');

router.post('/mtn/callback', mtnCtrl.callback);

module.exports = router;
