const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const writeWindowMiddleware = require('../middleware/writeWindowMiddleware');
const { STAFF_DOC } = require('../utils/roles');

const router = express.Router();

const protect   = [authController.protect, authController.restrictTo(...STAFF_DOC)];
const adminOnly = [authController.protect, authController.restrictTo('Admin')];

// Lecture : Admin + Collaborateur
router.get('/',    protect, documentController.getAllDocuments);
router.get('/:id', protect, documentController.getDocument);

// Création : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.post('/', protect, writeWindowMiddleware, documentController.createDocument);

// Modification : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.patch('/:id', protect, writeWindowMiddleware, documentController.updateDocument);

// Suppression : Admin uniquement
router.delete('/:id', adminOnly, documentController.deleteDocument);

module.exports = router;
