// server/routes/altimmoSearchRoutes.js — endpoint public de recherche unifié Altimmo
// (correctif architecture 2026-07-25). Aucune authentification requise (route publique,
// même politique que GET /api/properties et GET /api/hotels/public), sauf les routes /advisor/*
// du conseiller conversationnel, réservées aux comptes internes autorisés.

const express = require('express');
const { search } = require('../controllers/altimmoSearchController');
const { getMapAggregates } = require('../controllers/mapAggregatesController');
const altimmoAssistant = require('../controllers/altimmoAssistantController');
const { altimmoAssistantLimiter, altimmoAdvisorLimiter } = require('../middleware/rateLimiters');
const altimmoAdvisor = require('../controllers/altimmoAdvisorController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/search', search);
// ALTIMMO-MAP-LOCALITY-CENTROIDS-2 — agrégation publique par localité (n'expose
// jamais les coordonnées de propriétés individuelles).
router.get('/map-aggregates', getMapAggregates);
// ALTIMMO-AI-INTEGRATION-01 — assistant de recherche (public, lecture seule, désactivé par défaut :
// voir config/altimmoAssistant.js). Monté ici pour ne pas modifier server.js.
router.get('/assistant/status', altimmoAssistant.status);
router.post('/assistant/search', altimmoAssistantLimiter, altimmoAssistant.search);
router.post('/assistant/compare', altimmoAssistantLimiter, altimmoAssistant.compare);
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel : session obligatoire, puis décision
// serveur (interrupteur, environnement, compte autorisé) avant toute lecture. Désactivé par défaut :
// voir config/altimmoAdvisor.js. L'assistant ci-dessus reste le parcours de tous les autres visiteurs.
const advisor = [protect, altimmoAdvisor.requireAdvisorAccess];
router.get('/advisor/status', protect, altimmoAdvisor.status);
router.post('/advisor/conversations/:conversationId/turns', ...advisor, altimmoAdvisorLimiter, altimmoAdvisor.turn);
router.delete('/advisor/conversations/:conversationId/turns/:turnId', ...advisor, altimmoAdvisor.cancel);
router.get('/advisor/conversations/:conversationId', ...advisor, altimmoAdvisor.conversation);
router.delete('/advisor/conversations/:conversationId', ...advisor, altimmoAdvisor.reset);
router.get('/advisor/usage', ...advisor, altimmoAdvisor.usage);
router.post('/advisor/llm/stop', ...advisor, altimmoAdvisor.stopLlm);

module.exports = router;
