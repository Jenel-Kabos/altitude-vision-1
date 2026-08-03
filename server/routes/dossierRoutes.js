// DOC-EVO-1 — Route générique du moteur de dossier métier. Authentification
// seule ici (`protect`) : le contrôle d'accès fin (staff/propriétaire/
// locataire/client, selon le domaine) est délégué à chaque adaptateur, qui
// connaît seul les règles réelles de son domaine — voir
// server/services/dossier/*.js.
const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/dossierController');
const { STAFF_DOC } = require('../utils/roles');

const router = express.Router();
// DOC-EVO-1 — recherche globale : réservée au staff documentaire (même
// périmètre que /api/documents) — jamais de fuite inter-domaine vers un
// propriétaire/locataire/client via la recherche. Déclarée avant la route
// dynamique ci-dessous par convention, même si `/search` (un seul segment)
// ne peut de toute façon pas être capturée par `/:domain/:entityId` (deux
// segments requis).
router.get('/search', auth.protect, auth.restrictTo(...STAFF_DOC), ctrl.search);
router.get('/:domain/:entityId', auth.protect, ctrl.getDossier);

module.exports = router;
