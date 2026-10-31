// server/routes/altimmoSearchRoutes.js — endpoint public de recherche unifié Altimmo
// (correctif architecture 2026-07-25). Aucune authentification requise (route publique,
// même politique que GET /api/properties et GET /api/hotels/public).

const express = require('express');
const { search } = require('../controllers/altimmoSearchController');
const { getMapAggregates } = require('../controllers/mapAggregatesController');
const altimmoAssistant = require('../controllers/altimmoAssistantController');
const { altimmoAssistantLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/search', search);
// ALTIMMO-MAP-LOCALITY-CENTROIDS-2 — agrégation publique par localité (n'expose
// jamais les coordonnées de propriétés individuelles).
router.get('/map-aggregates', getMapAggregates);
// ALTIMMO-AI-INTEGRATION-01 — assistant de recherche (public, lecture seule, désactivé par défaut :
// voir config/altimmoAssistant.js). Monté ici pour ne pas modifier server.js.
router.post('/assistant/search', altimmoAssistantLimiter, altimmoAssistant.search);
router.post('/assistant/compare', altimmoAssistantLimiter, altimmoAssistant.compare);

module.exports = router;
