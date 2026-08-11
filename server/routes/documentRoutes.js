const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const writeWindowMiddleware = require('../middleware/writeWindowMiddleware');
const { STAFF_DOC } = require('../utils/roles');

const router = express.Router();
const { requireTenantScope } = require('../middleware/tenantContext');

const protect   = [authController.protect, authController.restrictTo(...STAFF_DOC)];
const adminOnly = [authController.protect, authController.restrictTo('Admin')];

// Lecture : Admin + Collaborateur
router.use(protect, requireTenantScope);
router.get('/',    documentController.getAllDocuments);
router.get('/:id', documentController.getDocument);

// Création : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.post('/', writeWindowMiddleware, documentController.createDocument);

// Modification : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.patch('/:id', writeWindowMiddleware, documentController.updateDocument);

// Suppression : Admin uniquement
router.delete('/:id', adminOnly, documentController.deleteDocument);

module.exports = router;
