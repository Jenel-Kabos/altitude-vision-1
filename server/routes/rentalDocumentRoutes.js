const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalDocumentController');

const router = express.Router();

// Authentification obligatoire — le contrôleur applique ensuite la
// vérification fine du rôle et de la relation avec le bail (staff, ou
// propriétaire/locataire strictement scopé à son propre dossier).
router.get('/:documentId/download', auth.protect, ctrl.download);

module.exports = router;
