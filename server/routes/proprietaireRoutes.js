const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/proprietaireController');
const { upload } = require('../config/cloudinary');

const protect   = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];
const multiPics = upload.array('photos', 20);

// Multer dédié pièce d'identité : 5 MB, PDF + images uniquement
const PIECE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const single = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    PIECE_MIMES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non supporté. Utilisez PDF, JPEG ou PNG'), false);
  },
}).single('pieceIdentite');

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
