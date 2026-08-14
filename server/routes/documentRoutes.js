const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');
const writeWindowMiddleware = require('../middleware/writeWindowMiddleware');
const { requireCapability } = require('../middleware/capabilityMiddleware');

const router = express.Router();
const { requireTenantScope } = require('../middleware/tenantContext');

const adminOnly = [authController.protect, authController.restrictTo('Admin')];

// Lecture : Admin + Collaborateur
router.use(authController.protect, requireTenantScope);
router.get('/', requireCapability('documents.read'), documentController.getAllDocuments);
router.get('/:id', requireCapability('documents.read'), documentController.getDocument);

// Création : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.post('/', requireCapability('documents.manage'), writeWindowMiddleware, documentController.createDocument);

// Modification : Admin + Collaborateur (avec fenêtre d'écriture pour les collaborateurs)
router.patch('/:id', requireCapability('documents.manage'), writeWindowMiddleware, documentController.updateDocument);

// Suppression : Admin uniquement
router.delete('/:id', adminOnly, documentController.deleteDocument);

module.exports = router;
