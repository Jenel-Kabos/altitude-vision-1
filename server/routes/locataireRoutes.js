const express    = require('express');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/locataireController');
const { upload } = require('../config/cloudinary');

const protect   = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];
const fileField = upload.single('pieceIdentite');

router.get('/',      protect, ctrl.getAll);
router.get('/:id',   protect, ctrl.getOne);
router.post('/',     protect, fileField, ctrl.create);
router.put('/:id',   protect, fileField, ctrl.update);
router.delete('/:id',protect, ctrl.delete);

module.exports = router;
