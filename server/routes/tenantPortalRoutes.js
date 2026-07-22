// server/routes/tenantPortalRoutes.js — Dette technique GL-B2 (Mission 2)
//
// Toute route ici résout le dossier locataire depuis `req.user.id` — jamais
// un `:locataireId` d'URL. Accessible à tout compte authentifié (le
// contrôleur renvoie 404 si aucun dossier n'est rattaché) — un User n'est
// pas automatiquement un Locataire (voir tenantLinkService.js).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/tenantPortalController');

const router = express.Router();
router.use(auth.protect);

router.post('/activate', ctrl.activate);
router.post('/request-link', ctrl.requestLink);

router.get('/me', ctrl.getMe);
router.get('/lease', ctrl.getLease);
router.get('/payments', ctrl.getPayments);
router.get('/documents', ctrl.getDocuments);
router.get('/notice', ctrl.getNotice);
router.post('/maintenance', ctrl.createMaintenanceRequest);

module.exports = router;
