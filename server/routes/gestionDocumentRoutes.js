const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/gestionDocumentController');

const protect   = [auth.protect, auth.restrictTo('Admin', 'Collaborateur')];
const adminOnly = [auth.protect, auth.restrictTo('Admin')];

router.get('/contrat/:contratId',               protect,   ctrl.getDocuments);
router.post('/bail/:contratId',                 adminOnly, ctrl.generateBail);
router.post('/quittance/:paiementId',           adminOnly, ctrl.generateQuittance);
router.post('/mise-en-demeure/:paiementId',     adminOnly, ctrl.generateMiseEnDemeure);
router.post('/preavis/:contratId',              adminOnly, ctrl.generatePreavis);
router.post('/etat-des-lieux/:contratId',       protect,   ctrl.generateEtatDesLieux);
router.post('/envoyer/:contratId/:docIndex',    adminOnly, ctrl.envoyerDocument);

module.exports = router;
