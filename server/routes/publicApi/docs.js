// API-PUBLIC-1 (Phase 7) — Documentation OpenAPI/Swagger, volontairement
// SANS authentification par clé API (une doc doit être consultable avant
// même d'avoir une clé) — jamais mêlée à la chaîne de middlewares
// authentifiée de v1/index.js.
const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');
const spec = require('../../config/swaggerSpec');

router.get('/openapi.json', (_req, res) => res.json(spec));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Altitude Vision — API Publique' }));

module.exports = router;
