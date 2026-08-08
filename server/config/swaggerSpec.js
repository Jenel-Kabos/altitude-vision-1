// API-PUBLIC-1 (Phase 7) — Génère la spécification OpenAPI 3 à partir des
// annotations JSDoc déjà présentes sur les routes publiques
// (routes/publicApi/v1/index.js). Aucune route interne n'est documentée
// ici : `apis` ne pointe que vers le dossier publicApi.
const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Altitude Vision — API Publique',
      version: '1.0.0',
      description: "API publique en lecture seule pour les partenaires externes (annonces immobilières, hôtels, hébergements). Authentification par clé API — voir le schéma de sécurité `ApiKeyAuth`.",
    },
    servers: [{ url: '/api/public/v1', description: 'Version 1' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Clé API (ou `Authorization: Bearer <clé>`).' },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: [
    require('path').join(__dirname, '../routes/publicApi/v1/*.js'),
    require('path').join(__dirname, '../routes/publicApi/v1/**/*.js'),
  ],
});

module.exports = spec;
