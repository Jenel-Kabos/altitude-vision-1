// server/routes/rentalPropertyRoutes.js — Sprint A (séparation Vente/Location).
const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/rentalPropertyController');
const { ROLES_ALTIMMO } = require('../utils/roles');
const { upload } = require('../config/cloudinary');

const router = express.Router();
// UX-OWNER-2 — `Proprietaire` ajouté explicitement (jamais fondu dans
// `ROLES_ALTIMMO`, qui reste un ensemble staff pur réutilisé ailleurs) : le
// contrôleur applique ses propres frontières pour ce rôle (ownership forcée,
// jamais un `owner`/`managementFee` arbitraire côté body, voir
// rentalPropertyController.js) — jamais un accès Admin élargi au propriétaire.
router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO, 'Proprietaire'));

// UX-OWNER-2 — même bug réel pré-existant que salePropertyRoutes.js (jamais
// introduit par ce sprint, reproduit aussi côté Admin) : middleware
// `multer` manquant pour parser le `multipart/form-data` réel.
router.post('/', upload.array('images', 10), ctrl.createFull);
router.put('/:propertyId', upload.array('images', 10), ctrl.updateFull);

module.exports = router;
