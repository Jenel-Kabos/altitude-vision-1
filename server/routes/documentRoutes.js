const express = require('express');
const documentController = require('../controllers/documentController');
const authController = require('../controllers/authController');

const router = express.Router();

// --- Protect all routes in this file ---
// Only Admins and Collaborators can access the document management system.
router.use(authController.protect, authController.restrictTo('Admin', 'Collaborateur'));

router.route('/')
    .get(documentController.getAllDocuments)
    .post(documentController.createDocument);

router.route('/:id')
    .get(documentController.getDocument)
    .patch(documentController.updateDocument)
    .delete(documentController.deleteDocument);

module.exports = router;