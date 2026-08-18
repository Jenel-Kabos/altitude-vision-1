// server/routes/salePropertyRoutes.js — Sprint A (séparation Vente/Location).
const express = require('express');
const auth = require('../controllers/authController');
const ctrl = require('../controllers/salePropertyController');
const { ROLES_ALTIMMO } = require('../utils/roles');
const { upload } = require('../config/cloudinary');

const router = express.Router();
// UX-OWNER-2 — `Proprietaire` ajouté explicitement (jamais fondu dans
// `ROLES_ALTIMMO`, qui reste un ensemble staff pur réutilisé ailleurs) : le
// contrôleur applique ses propres frontières pour ce rôle (ownership forcée,
// jamais un `owner`/`agencyCommission` arbitraire côté body, voir
// salePropertyController.js) — jamais un accès Admin élargi au propriétaire.
router.use(auth.protect, auth.restrictTo(...ROLES_ALTIMMO, 'Proprietaire'));

// UX-OWNER-2 — bug réel pré-existant découvert en vérifiant ce sprint dans
// un vrai navigateur (jamais introduit par ce sprint, reproduit également
// avec un acteur Admin) : aucun middleware `multer` ne parsait le
// `multipart/form-data` envoyé par SalePropertyForm.jsx (`new FormData()` +
// fichiers réels) — `req.body`/`req.files` restaient vides côté serveur,
// 422 « Titre, description et prix sont obligatoires » sur TOUTE création
// avec image réelle. Même middleware que propertyRoutes.js/accommodationRoutes.js
// (`upload.array('images', 10)`), jamais construit depuis zéro.
router.post('/', upload.array('images', 10), ctrl.createFull);
router.put('/:propertyId', upload.array('images', 10), ctrl.updateFull);

module.exports = router;
