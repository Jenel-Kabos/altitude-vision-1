const express    = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/locataireController');
const { upload } = require('../config/cloudinary');

const protect    = [auth.protect, auth.restrictTo(...STAFF_IMMO)];
const readAll    = [auth.protect, auth.restrictTo(...STAFF_IMMO, 'Secretaire')];
const adminOnly  = [auth.protect, auth.restrictTo('Admin')];
const fileField  = upload.single('pieceIdentite');

router.get('/',       readAll,   ctrl.getAll);
// Sprint GL-B2 — littéraux/2-segments AVANT le fallback générique /:id
// (convention de routage déjà établie dans ce projet, voir hotelRoutes.js).
router.get('/dossiers', readAll, ctrl.listDossiers);
// Dette technique GL-B2 — liaison User ↔ Locataire (Missions 1 & 3),
// littéraux avant /:id également.
router.get('/link-requests', protect, ctrl.listLinkRequests);
router.patch('/link-requests/:requestId/review', protect, ctrl.reviewLinkRequest);
router.patch('/invitations/:requestId/cancel', protect, ctrl.cancelInvitation);
router.post('/invitations/:requestId/resend', protect, ctrl.resendInvitation);
router.get('/:id/dossier', readAll, ctrl.getDossier);
router.post('/:id/invite', protect, ctrl.invite);
router.get('/:id',    readAll,   ctrl.getOne);
router.post('/',      protect,   fileField, ctrl.create);
router.put('/:id',    protect,   fileField, ctrl.update);
router.delete('/:id', protect,   ctrl.delete);

module.exports = router;
