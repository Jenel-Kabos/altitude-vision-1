const express = require('express');
const { STAFF_ALL, STAFF_DOC, STAFF_IMMO, STAFF_CM, STAFF_COMM } = require('../utils/roles');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/gestionDocumentController');

const protect   = [auth.protect, auth.restrictTo(...STAFF_DOC)];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

router.get('/contrat/:contratId',               protect, ctrl.getDocuments);
router.post('/bail/:contratId',                 protect, ctrl.generateBail);
router.post('/quittance/:paiementId',           protect, ctrl.generateQuittance);
router.post('/mise-en-demeure/:paiementId',     protect, ctrl.generateMiseEnDemeure);
router.post('/preavis/:contratId',              protect, ctrl.generatePreavis);
router.post('/etat-des-lieux/:contratId',       protect, ctrl.generateEtatDesLieux);
router.post('/envoyer/:contratId/:docIndex',    protect, ctrl.envoyerDocument);

module.exports = router;
