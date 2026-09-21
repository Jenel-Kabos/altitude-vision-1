const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();
const auth    = require('../controllers/authController');
const ctrl    = require('../controllers/contratController');
// TENANT-CERT-2 — audit adversarial : GET/PUT/DELETE `:id` (et les routes
// paiements imbriquées) chargeaient le Contrat demandé sans aucune
// vérification tenant, un membre STAFF_IMMO/STAFF_DOC du Tenant A pouvait
// consulter/modifier/supprimer un contrat du Tenant B en connaissant son
// ObjectId (vulnérabilité confirmée par test adversarial, voir
// __tests__/tenantCert2.gl.adversarial.mongo.integration.test.js). Même
// couche transversale que rentalManagementRoutes.js — `router.param('id')`,
// jamais une modification contrôleur par contrôleur.
const Contrat = require('../models/Contrat');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { requirePlatformOperatorCapability } = require('../middleware/platformAuthority');
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIII — POST-CONTRACT-CONTRAT-
// TENANT-AUTHORITY. Migration des surfaces post-contrat de l'autorité legacy
// `requireCapability('leases.*'/'payments.*')` + `restrictTo('Admin')`
// (User.role global) vers la chaîne canonique tenant :
//   protect → requireTenantScope → requireTenantMembershipRole(...) →
//   router.param('id', …) (frontière ressource déjà en place).
// Décision B1 (polymorphic router location/vente) : PAS de gate
// `requireTenantModule('location')` sur GET/PUT/DELETE — sinon les
// contrats de vente devraient être scindés dans un router dédié (non
// autorisé dans ce lot). Le gate `location` est appliqué UNIQUEMENT
// à GET /:id/paiements qui est prouvé rental-only en pratique.
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const { requireTenantModule } = require('../middleware/tenantModuleGate');

// TENANT-CERT-2 — `router.param('id', …)` s'exécute AVANT le tableau de
// middlewares propre à chaque route (donc avant `auth.protect` ci-dessus) :
// sans cette ligne, `req.user` serait encore indéfini au moment du contrôle
// tenant (bug réel constaté lors de la certification). Toutes les routes de
// ce fichier exigent déjà une authentification staff, donc aucune route
// publique n'est affectée.
router.use(auth.protect);

router.param('id', async (req, res, next, contratId) => {
  try {
    if (!mongoose.isValidObjectId(contratId)) return res.status(400).json({ status: 'fail', message: 'Identifiant invalide.' });
    const contrat = await Contrat.findById(contratId);
    if (!contrat) return res.status(404).json({ status: 'fail', message: 'Contrat introuvable.' });
    // Un Contrat sans `bien` réellement lié (adresse en texte libre,
    // données antérieures à PlatformTenant) n'a aucune frontière tenant à
    // faire respecter — voir assertResourceTenantOrUnattributed.
    // PLATFORM-ADMIN-1 — voir paiementRoutes.js pour la même justification :
    // sans transmission explicite, un PlatformOperator resterait bloqué même
    // après sélection d'un tenant dans l'UI.
    const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
    const tenant = await resolveTenantForUser(req.user._id || req.user.id, explicitTenantId);
    await assertResourceTenantOrUnattributed({ resourceType: 'Contrat', resource: contrat, tenantId: tenant?._id });
    next();
  } catch (error) {
    res.status(error.statusCode || 404).json({ status: 'fail', message: error.statusCode ? error.message : 'Contrat introuvable.' });
  }
});

// Rôles canoniques par surface (voir §11/§22/§25/§37 du lot PCCTA) :
//  READ générique (list + getOne) : Admin, GestionnaireImmobilier,
//    Collaborateur, Secretaire.
//  PUT post-contrat : Admin, GestionnaireImmobilier, Collaborateur
//    (Secretaire exclu — pas d'autorité structurelle sur le bail).
//  DELETE (administration tenant) : Admin uniquement.
//  GET /:id/paiements (rental payment read, matrice B.2) : Admin,
//    Secretaire, Collaborateur. GestionnaireImmobilier exclu.
const READ_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur', 'Secretaire'];
const MUTATE_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];
const DELETE_ROLES = ['Admin'];
const PAYMENT_READ_ROLES = ['Admin', 'Secretaire', 'Collaborateur'];

const tenantRead = [requireTenantScope, requireTenantMembershipRole(...READ_ROLES)];
const tenantMutate = [requireTenantScope, requireTenantMembershipRole(...MUTATE_ROLES)];
const tenantDelete = [requireTenantScope, requireTenantMembershipRole(...DELETE_ROLES)];
const tenantPaymentRead = [requireTenantScope, requireTenantModule('location'), requireTenantMembershipRole(...PAYMENT_READ_ROLES)];

router.get('/', ...tenantRead, ctrl.getAll);
router.get('/:id', ...tenantRead, ctrl.getOne);
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X — MARKETPLACE-RENTAL-COMMERCIAL-
// BOUNDARY — la conclusion marketplace reste PLATFORM-ONLY. NE PAS composer
// avec la chaîne tenant ci-dessus : cette route n'exige NI membership tenant
// NI module `location` — l'autorité provient de `platform.commercial.manage`.
router.post('/', auth.protect, requirePlatformOperatorCapability('platform.commercial.manage'), ctrl.create);
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3C — LEGACY-CONTRAT-MUTATION-
// RETIREMENT. Les mutations polymorphiques legacy sont retirées : les
// surfaces canoniques restent `/api/contrats/location/:id` et
// `/api/contrats/vente/:id`. La chaîne d'autorité (protect + tenant scope
// + resource attribution via router.param + membership businessRole)
// reste appliquée AVANT le 410 : jamais un oracle non authentifié ou
// cross-tenant. La réponse porte le code stable
// `CONTRACT_LEGACY_MUTATION_RETIRED` — distinct de
// `CONTRACT_PAYMENT_ENDPOINT_RETIRED` (POST /:id/paiements, décision B3).
const legacyMutationRetired = (_req, res) => res.status(410).json({
  status: 'fail',
  code: 'CONTRACT_LEGACY_MUTATION_RETIRED',
  message: "Opération retirée. Utilisez la surface typée /api/contrats/location/:id ou /api/contrats/vente/:id.",
});
router.put('/:id', ...tenantMutate, legacyMutationRetired);
router.delete('/:id', ...tenantDelete, legacyMutationRetired);

// Paiements liés à un contrat — lecture rental-only (matrice B.2).
router.get('/:id/paiements', ...tenantPaymentRead, ctrl.getPaiements);
// Décision B3 : le point d'écriture historique (bare `Paiement.create` sans
// idempotence/CAS/receipt) est RETIRÉ. Le refus 410 s'applique APRÈS la
// résolution de la frontière tenant : jamais un oracle non authentifié.
router.post('/:id/paiements', ...tenantPaymentRead, ctrl.createPaiement);

module.exports = router;
