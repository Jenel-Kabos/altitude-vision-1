const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/hotelController');
const roomCategoryCtrl = require('../controllers/roomCategoryController');
const roomCtrl = require('../controllers/roomController');
const roomAssignmentCtrl = require('../controllers/roomAssignmentController');
const reservationCtrl = require('../controllers/hotelReservationController');
const reviewCtrl = require('../controllers/hotelReviewController');
const faqCtrl = require('../controllers/hotelFaqController');
const staffCtrl = require('../controllers/hotelStaffAssignmentController');
const inventoryCtrl = require('../controllers/hotelInventoryController');
const { requireHotelCapability } = require('../middleware/hotelAccessMiddleware');
const { HOTEL_OPERATIONAL_CAPABILITIES } = require('../constants/hotelAccessConstants');
const { ROLES_ALTIMMO, ROLES_MODERATION } = require('../utils/roles');
const { upload } = require('../config/cloudinary');
const { attachTenantScopeIfResolvable, requireTenantScopeForStaffAllowPlatformWide } = require('../middleware/tenantContext');

const router = express.Router();

// Public — liste et fiche hôtel (pages publiques), AVANT auth.protect.
router.get('/public', ctrl.listPublic);
router.get('/public/:id', ctrl.getPublic);
// PHASE-H2 — recherche multi-catégories, entièrement publique (même garde
// de publication que getPublic ci-dessus, jamais un rôle/capacité requis).
router.get('/public/:hotelId/availability', reservationCtrl.searchPublicAvailability);
// PHASE-H3 — avis (séjour vérifié uniquement) et FAQ publiques, même garde
// de publication que getPublic ci-dessus.
router.get('/public/:hotelId/reviews', reviewCtrl.listPublic);
router.get('/public/:hotelId/faq', faqCtrl.listPublic);
// PHASE-H4 — hôtels à proximité (distance géospatiale réelle), même garde
// de publication que getPublic ci-dessus.
router.get('/public/:hotelId/nearby', ctrl.nearby);

// Sprint C — disponibilité + demande de réservation, accessibles sans
// compte. `auth.optionalAuth` attache req.user si un jeton valide est
// fourni (pour rattacher la demande à un compte client existant), sans
// jamais l'exiger — voir hotelReservationController.createPublicReservation.
router.get('/:hotelId/availability', auth.optionalAuth, reservationCtrl.getPublicAvailability);
router.post('/:hotelId/reservations', auth.optionalAuth, reservationCtrl.createPublicReservation);

// TENANT-SCOPE-HOTFIX-3 — `requireTenantScope` bloquait ICI, avant même
// d'atteindre le contrôleur, tout exploitant/Proprietaire public-signup
// sans OrgMembership sur ses propres routes self-service (`/mine`,
// room-categories, rooms, inventory, room-assignments…) : bug réel
// démontré (voir server/docs/TENANT_SCOPE_AUDIT2B_REPORT.md), alors que
// `hotelAccessScopeService.assertOperationalHotelAccess` contient déjà le
// contournement ownership nécessaire pour ce cas exact. `attachTenantScopeIfResolvable`
// résout `req.platformTenant`/`req.tenantScopeUserIds` (et enrichit
// `req.user` À L'IDENTIQUE de `requireTenantScope`) quand un tenant EXISTE
// — aucun changement pour le staff — mais ne bloque plus quand aucun
// tenant ne se résout, laissant `assertOperationalHotelAccess` (jamais
// modifié) appliquer la vraie vérification d'ownership. Chaque route
// strictement staff-only de ce routeur reste protégée indépendamment par
// `auth.restrictTo(...)`/capacité (jamais par la seule présence d'un
// tenant) — voir TENANT_SCOPE_HOTFIX3_ROUTE_MATRIX.md pour la preuve
// route par route.
router.use(auth.protect, attachTenantScopeIfResolvable);

// F2.6 — hôtels accessibles à l'utilisateur courant (Admin, manager legacy ou rattachement actif).
// Placée avant '/:id' générique pour ne jamais être capturée par le paramètre.
router.get('/accessible', staffCtrl.accessibleHotels);
// Portefeuille validé : filtre de publication non paramétrable côté serveur.
router.get('/portfolio', requireTenantScopeForStaffAllowPlatformWide, ctrl.portfolio);
router.get('/portfolio/:id', ctrl.portfolioOne);

// F2.6 — gouvernance des accès hôteliers (gestion du personnel rattaché).
const staffView = requireHotelCapability(HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_VIEW, (req) => req.params.hotelId);
const staffManage = requireHotelCapability(HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_MANAGE, (req) => req.params.hotelId);
router.get('/:hotelId/staff-assignments', staffView, staffCtrl.list);
router.post('/:hotelId/staff-assignments', staffManage, staffCtrl.create);
router.get('/:hotelId/staff-assignments/:assignmentId', staffView, staffCtrl.get);
router.patch('/:hotelId/staff-assignments/:assignmentId', staffManage, staffCtrl.update);
router.post('/:hotelId/staff-assignments/:assignmentId/suspend', staffManage, staffCtrl.suspend);
router.post('/:hotelId/staff-assignments/:assignmentId/reactivate', staffManage, staffCtrl.reactivate);
router.post('/:hotelId/staff-assignments/:assignmentId/revoke', staffManage, staffCtrl.revoke);

// Staff (dashboard admin) — placées AVANT '/:id' pour ne jamais être
// capturées par le paramètre générique.
router.post('/admin', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.createFull);
router.put('/admin/:hotelId', auth.restrictTo(...ROLES_ALTIMMO), upload.array('images', 10), ctrl.updateFull);
router.get('/admin/list', auth.restrictTo(...ROLES_ALTIMMO), requireTenantScopeForStaffAllowPlatformWide, ctrl.listAdmin);
router.get('/status/pending', auth.restrictTo(...ROLES_MODERATION), requireTenantScopeForStaffAllowPlatformWide, ctrl.pending);
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

// PHASE-H3 — création d'avis : authentification obligatoire (jamais un avis
// invité, contrairement à la réservation), ownership/séjour-terminé/
// unicité vérifiés dans le service (jamais dans le contrôleur).
router.post('/:hotelId/reviews', reviewCtrl.create);

// PHASE-H3 — FAQ (propriétaire + staff, même convention d'accès que les
// catégories de chambres ci-dessous).
router.get('/:hotelId/faq', faqCtrl.list);
router.post('/:hotelId/faq', faqCtrl.create);
router.patch('/:hotelId/faq/:faqId', faqCtrl.update);
router.delete('/:hotelId/faq/:faqId', faqCtrl.remove);

// Catégories de chambres (propriétaire + staff, filtré par assertHotelAccess)
router.get('/:hotelId/room-categories', roomCategoryCtrl.list);
router.post('/:hotelId/room-categories', roomCategoryCtrl.create);
router.patch('/room-categories/:id', roomCategoryCtrl.update);
// PHASE-HX1 — upload de photos de catégorie (jamais un second champ ni une
// seconde route pour la galerie elle-même, voir roomCategoryController.uploadGallery).
router.post('/room-categories/:id/gallery', upload.array('images', 10), roomCategoryCtrl.uploadGallery);
router.delete('/room-categories/:id', roomCategoryCtrl.remove);
router.post('/room-categories/:id/duplicate', roomCategoryCtrl.duplicate);
router.patch('/room-categories/:id/deactivate', roomCategoryCtrl.deactivate);
router.patch('/room-categories/:id/activate', roomCategoryCtrl.activate);
router.get('/room-categories/:id/rate-plans', roomCategoryCtrl.listRates);
router.post('/room-categories/:id/rate-plans', roomCategoryCtrl.upsertRate);
router.delete('/room-categories/:id/rate-plans/:rateId', roomCategoryCtrl.archiveRate);

// Sprint D — chambres physiques (propriétaire + staff, filtré par assertHotelAccess)
router.get('/:hotelId/rooms', roomCtrl.list);
router.post('/:hotelId/rooms', roomCtrl.create);
router.patch('/rooms/:id', roomCtrl.update);
router.delete('/rooms/:id', roomCtrl.remove);

const inventoryView = requireHotelCapability(HOTEL_OPERATIONAL_CAPABILITIES.INVENTORY_VIEW, (req) => req.params.hotelId);
const inventoryManage = requireHotelCapability(HOTEL_OPERATIONAL_CAPABILITIES.INVENTORY_MANAGE, (req) => req.params.hotelId);
router.get('/:hotelId/inventory/calendar', inventoryView, inventoryCtrl.calendar);
router.patch('/:hotelId/inventory/range', inventoryManage, inventoryCtrl.updateRange);
// PHASE-HX1 — édition professionnelle par date (stock vendable), même garde
// de capacité que updateRange ci-dessus.
router.patch('/:hotelId/inventory/days', inventoryManage, inventoryCtrl.updateSellable);
router.post('/:hotelId/inventory/rebuild', inventoryManage, inventoryCtrl.rebuild);

// Sprint D — affectation de chambre (accès résolu via l'hôtel de la
// réservation, jamais un :hotelId d'URL — voir roomAssignmentController).
router.post('/room-assignments', roomAssignmentCtrl.assign);
router.post('/room-assignments/auto', roomAssignmentCtrl.autoAssign);
router.patch('/room-assignments/change', roomAssignmentCtrl.change);
router.patch('/room-assignments/release', roomAssignmentCtrl.release);

// Staff — validate|reject|suspend|unsuspend (même convention qu'Accommodation)
router.patch('/:id/:action', auth.restrictTo(...ROLES_MODERATION), ctrl.reviewDecision);

// Sélecteur admin (Sprint Hôtel, inchangé) — routes génériques en dernier
router.get('/', auth.restrictTo(...ROLES_ALTIMMO), ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
