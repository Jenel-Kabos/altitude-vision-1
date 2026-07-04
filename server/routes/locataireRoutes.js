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
router.get('/:id',    readAll,   ctrl.getOne);
router.post('/',      protect,   fileField, ctrl.create);
router.put('/:id',    protect,   fileField, ctrl.update);
router.delete('/:id', protect,   ctrl.delete);

module.exports = router;
