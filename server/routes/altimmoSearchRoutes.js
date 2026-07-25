// server/routes/altimmoSearchRoutes.js — endpoint public de recherche unifié Altimmo
// (correctif architecture 2026-07-25). Aucune authentification requise (route publique,
// même politique que GET /api/properties et GET /api/hotels/public).

const express = require('express');
const { search } = require('../controllers/altimmoSearchController');

const router = express.Router();

router.get('/search', search);

module.exports = router;
