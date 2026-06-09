const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');

const router = express.Router();

const protect   = [authController.protect, authController.restrictTo('Admin', 'Collaborateur')];
const adminOnly = [authController.protect, authController.restrictTo('Admin')];

router.get('/',    protect,   documentController.getAllDocuments);
router.post('/',   adminOnly, documentController.createDocument);

router.get('/:id',    protect,   documentController.getDocument);
router.patch('/:id',  adminOnly, documentController.updateDocument);
router.delete('/:id', adminOnly, documentController.deleteDocument);

module.exports = router;