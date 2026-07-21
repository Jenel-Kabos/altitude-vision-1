const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/hotelController');
const roomCategoryCtrl = require('../controllers/roomCategoryController');
const reservationCtrl = require('../controllers/hotelReservationController');
const { ROLES_ALTIMMO } = require('../utils/roles');
const { upload } = require('../config/cloudinary');

const router = express.Router();

// Public — liste et fiche hôtel (pages publiques), AVANT auth.protect.
router.get('/public', ctrl.listPublic);
router.get('/public/:id', ctrl.getPublic);

// Sprint C — disponibilité + demande de réservation, accessibles sans
// compte. `auth.optionalAuth` attache req.user si un jeton valide est
// fourni (pour rattacher la demande à un compte client existant), sans
// jamais l'exiger — voir hotelReservationController.createPublicReservation.
router.get('/:hotelId/availability', auth.optionalAuth, reservationCtrl.getPublicAvailability);
router.post('/:hotelId/reservations', auth.optionalAuth, reservationCtrl.createPublicReservation);

router.use(auth.protect);

// Staff (dashboard admin) — placées AVANT '/:id' pour ne jamais être
// capturées par le paramètre générique.
router.post('/admin', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.createFull);
router.put('/admin/:hotelId', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.updateFull);
router.get('/admin/list', auth.restrictTo(...ROLES_ALTIMMO), ctrl.listAdmin);
router.get('/status/pending', auth.restrictTo(...ROLES_ALTIMMO), ctrl.pending);
// Contrôle final (audit Sprint B2) — réconciliation manuelle en cas de
// désynchronisation Hotel↔Accommodation constatée (voir hotelService.
// resyncLinkedAccommodations). Réservé au staff : action de récupération
// d'incident, jamais un levier de cycle de vie normal.
router.post('/:id/resync', auth.restrictTo(...ROLES_ALTIMMO), ctrl.resync);

// Propriétaire — "Mes hôtels" (mêmes contrôleurs que le dashboard admin ;
// ownership vérifiée dans le contrôleur, jamais uniquement côté route).
router.get('/mine', ctrl.mine);
router.post('/mine', upload.array('images', 10), ctrl.createFull);
router.put('/mine/:hotelId', upload.array('images', 10), ctrl.updateFull);
router.post('/:id/submit', ctrl.submit);
router.post('/:id/duplicate', ctrl.duplicate);
router.patch('/:id/deactivate', ctrl.deactivate);
router.patch('/:id/reactivate', ctrl.reactivate);
router.delete('/:id', ctrl.remove);

// Catégories de chambres (propriétaire + staff, filtré par assertHotelAccess)
router.get('/:hotelId/room-categories', roomCategoryCtrl.list);
router.post('/:hotelId/room-categories', roomCategoryCtrl.create);
router.patch('/room-categories/:id', roomCategoryCtrl.update);
router.delete('/room-categories/:id', roomCategoryCtrl.remove);
router.post('/room-categories/:id/duplicate', roomCategoryCtrl.duplicate);
router.patch('/room-categories/:id/deactivate', roomCategoryCtrl.deactivate);
router.patch('/room-categories/:id/activate', roomCategoryCtrl.activate);
router.get('/room-categories/:id/rate-plans', roomCategoryCtrl.listRates);
router.post('/room-categories/:id/rate-plans', roomCategoryCtrl.upsertRate);
router.delete('/room-categories/:id/rate-plans/:rateId', roomCategoryCtrl.archiveRate);

// Staff — validate|reject|suspend|unsuspend (même convention qu'Accommodation)
router.patch('/:id/:action', auth.restrictTo(...ROLES_ALTIMMO), ctrl.reviewDecision);

// Sélecteur admin (Sprint Hôtel, inchangé) — routes génériques en dernier
router.get('/', auth.restrictTo(...ROLES_ALTIMMO), ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
