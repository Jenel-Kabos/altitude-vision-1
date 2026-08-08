// API-PUBLIC-1 (Phase 9) — Routes admin du portail développeur. Réservé
// Admin (émission/révocation/rotation de clés = action sensible, même
// périmètre que la gestion des utilisateurs).
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/apiPlatformAdminController');

router.use(auth.protect, auth.restrictTo('Admin'));

router.get('/keys', controller.listKeys);
router.post('/keys', controller.createKey);
router.post('/keys/:id/revoke', controller.revokeKey);
router.post('/keys/:id/rotate', controller.rotateKey);
router.get('/call-logs', controller.getCallLogs);
router.get('/webhooks', controller.getWebhookSubscriptions);

module.exports = router;
