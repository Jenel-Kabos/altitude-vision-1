// API-PUBLIC-1 — Point d'entrée versionné /api/public/v1. Chaîne de
// middlewares conforme au schéma du brief :
//   Client externe → Gateway → Validation → Authentification → Rate Limit
//   → API Publique → Services internes → Modules métiers
// (la "validation" ici est le rate-limit IP + la vérification de clé, la
// validation de payload fine est faite par chaque contrôleur/service —
// aucune donnée n'atteint jamais un contrôleur interne directement).
//
// Les commentaires @openapi ci-dessous sont lus par swagger-jsdoc
// (server/config/swaggerSpec.js) pour générer la documentation Phase 7 —
// toute route ajoutée ici doit être documentée de la même façon.
const router = require('express').Router();
const { publicApiLimiter } = require('../../../middleware/rateLimiters');
const { requireApiKey, requireScope } = require('../../../middleware/publicApiAuth');
const { enforceQuota } = require('../../../middleware/publicApiQuota');
const { logApiCall } = require('../../../middleware/publicApiLogging');

const propertyController = require('../../../controllers/publicApi/publicPropertyController');
const hotelController = require('../../../controllers/publicApi/publicHotelController');
const accommodationController = require('../../../controllers/publicApi/publicAccommodationController');
const webhookController = require('../../../controllers/publicApi/publicWebhookController');

// Ordre : limite IP (avant même de savoir si la clé est valide) → clé →
// quota par clé → journalisation (après coup, sur res.finish).
router.use(publicApiLimiter, requireApiKey, enforceQuota, logApiCall);

/**
 * @openapi
 * /properties:
 *   get:
 *     summary: Rechercher des annonces immobilières publiées
 *     tags: [Properties]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste paginée d'annonces publiques.
 *       401:
 *         description: Clé API manquante ou invalide.
 *       429:
 *         description: Quota dépassé.
 */
router.get('/properties', requireScope('properties:read'), propertyController.list);

/**
 * @openapi
 * /properties/{id}:
 *   get:
 *     summary: Détail d'une annonce immobilière publiée
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Annonce trouvée. }
 *       404: { description: Annonce introuvable. }
 */
router.get('/properties/:id', requireScope('properties:read'), propertyController.getOne);

/**
 * @openapi
 * /hotels:
 *   get:
 *     summary: Rechercher des hôtels publiés
 *     tags: [Hotels]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Liste paginée d'hôtels publics. }
 */
router.get('/hotels', requireScope('hotels:read'), hotelController.list);

/**
 * @openapi
 * /hotels/{id}:
 *   get:
 *     summary: Détail d'un hôtel publié (avec ses catégories de chambres)
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Hôtel trouvé. }
 *       404: { description: Hôtel introuvable. }
 */
router.get('/hotels/:id', requireScope('hotels:read'), hotelController.getOne);

/**
 * @openapi
 * /hotels/{id}/availability:
 *   get:
 *     summary: Disponibilité d'une catégorie de chambres sur une période
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: roomCategoryId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: checkInDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: checkOutDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: roomsCount
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: "Disponibilité { available, nights } — aucun champ interne exposé." }
 *       404: { description: Hôtel ou catégorie introuvable. }
 *       422: { description: Paramètres invalides. }
 */
router.get('/hotels/:id/availability', requireScope('hotels:read'), hotelController.availability);

/**
 * @openapi
 * /accommodations/{id}:
 *   get:
 *     summary: Détail d'un hébergement indépendant
 *     tags: [Accommodations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Hébergement trouvé. }
 *       404: { description: Hébergement introuvable. }
 */
router.get('/accommodations/:id', requireScope('accommodations:read'), accommodationController.getOne);

/**
 * @openapi
 * /accommodations/{id}/availability:
 *   get:
 *     summary: Disponibilité et tarif d'un hébergement indépendant sur une période
 *     tags: [Accommodations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: "Disponibilité { available, pricing, unavailableDates }." }
 *       404: { description: Hébergement introuvable. }
 */
router.get('/accommodations/:id/availability', requireScope('accommodations:read'), accommodationController.availability);

/**
 * @openapi
 * /webhooks:
 *   get:
 *     summary: Lister ses abonnements webhook
 *     tags: [Webhooks]
 *     responses:
 *       200: { description: Liste des abonnements de la clé authentifiée. }
 *   post:
 *     summary: Créer un abonnement webhook
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url: { type: string }
 *               events: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: "Abonnement créé — le secret de signature n'est retourné qu'une fois." }
 *       422: { description: Événement(s) non autorisé(s) ou url manquante. }
 */
router.get('/webhooks', requireScope('webhooks:manage'), webhookController.list);
router.post('/webhooks', requireScope('webhooks:manage'), webhookController.create);

/**
 * @openapi
 * /webhooks/{id}/disable:
 *   post:
 *     summary: Désactiver un abonnement webhook
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Abonnement désactivé. }
 *       404: { description: Abonnement introuvable. }
 */
router.post('/webhooks/:id/disable', requireScope('webhooks:manage'), webhookController.disable);

module.exports = router;
