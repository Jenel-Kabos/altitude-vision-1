// MARKETING-CONSENT-1 — Route publique de désinscription. POST uniquement :
// un simple GET (préchargement de lien par un client de messagerie ou un
// antivirus) ne doit jamais désinscrire. La page web
// /desinscription-marketing affiche une confirmation puis appelle ce POST.
const router = require('express').Router();
const controller = require('../controllers/marketingPreferencesController');
const { publicApiLimiter } = require('../middleware/rateLimiters');

router.post('/unsubscribe', publicApiLimiter, controller.unsubscribe);

module.exports = router;
