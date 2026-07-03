const express    = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router     = express.Router();
const auth       = require('../controllers/authController');
const ctrl       = require('../controllers/locataireController');
const { upload } = require('../config/cloudinary');

const protect    = [auth.protect, auth.restrictTo(...STAFF_IMMO)];
const adminOnly  = [auth.protect, auth.restrictTo('Admin')];
const fileField  = upload.single('pieceIdentite');

router.get('/',       protect,   ctrl.getAll);
router.get('/:id',    protect,   ctrl.getOne);
router.post('/',      protect,   fileField, ctrl.create);
router.put('/:id',    adminOnly, fileField, ctrl.update);
router.delete('/:id', adminOnly, ctrl.delete);

module.exports = router;
