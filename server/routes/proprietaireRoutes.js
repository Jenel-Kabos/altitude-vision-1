const express    = require('express');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/proprietaireController');
const { upload } = require('../config/cloudinary');

const protect   = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];
const single    = upload.single('pieceIdentite');
const multiPics = upload.array('photos', 20);

// ── CRUD Proprietaire ─────────────────────────────────────────
router.get('/',       protect, ctrl.getAll);
router.get('/:id',    protect, ctrl.getOne);
router.post('/',      protect, single, ctrl.create);
router.put('/:id',    protect, single, ctrl.update);
router.delete('/:id', protect, ctrl.delete);

// ── Gestion des biens ─────────────────────────────────────────
router.post(  '/:id/biens',                           protect, multiPics, ctrl.addBien);
router.put(   '/:id/biens/:bienIndex',                protect, ctrl.updateBien);
router.delete('/:id/biens/:bienIndex',                protect, ctrl.deleteBien);
router.post(  '/:id/biens/:bienIndex/photos',         protect, multiPics, ctrl.addBienPhotos);
router.delete('/:id/biens/:bienIndex/photos/:photoIndex', protect, ctrl.deleteBienPhoto);

module.exports = router;
