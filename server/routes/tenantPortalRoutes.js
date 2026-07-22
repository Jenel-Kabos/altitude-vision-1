// server/routes/tenantPortalRoutes.js — Dette technique GL-B2 (Mission 2)
//
// Toute route ici résout le dossier locataire depuis `req.user.id` — jamais
// un `:locataireId` d'URL. Accessible à tout compte authentifié (le
// contrôleur renvoie 404 si aucun dossier n'est rattaché) — un User n'est
// pas automatiquement un Locataire (voir tenantLinkService.js).

const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/tenantPortalController');
const { rentalMaintenanceUpload, upload } = require('../config/cloudinary');
// `upload` fallback keeps compatibility with legacy test/application mocks;
// production always exports the stricter dedicated middleware.
const maintenanceUpload = rentalMaintenanceUpload || upload;

const router = express.Router();
router.use(auth.protect);

router.post('/activate', ctrl.activate);
router.post('/request-link', ctrl.requestLink);
router.get('/link-status', ctrl.getLinkStatus);

router.get('/dashboard', ctrl.getDashboard);
router.get('/me', ctrl.getMe);
router.get('/lease', ctrl.getLease);
router.get('/leases', ctrl.getLeases);
router.get('/payments', ctrl.getPayments);
router.get('/documents', ctrl.getDocuments);
router.get('/documents/:documentId/download', ctrl.downloadDocument);
router.get('/notice', ctrl.getNotice);
router.get('/maintenance', ctrl.getMaintenance);
router.post('/maintenance', maintenanceUpload.array('photos', 5), ctrl.createMaintenanceRequest);

module.exports = router;
