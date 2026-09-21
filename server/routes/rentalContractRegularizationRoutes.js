// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-B — Autorité tenant canonique :
//   protect
//   → requireTenantScope
//   → requireTenantModule('location')
//   → requireTenantMembershipRole(...)
//
// L'ancienne chaîne `restrictTo(...)` lisait `User.role` global comme source
// d'autorité tenant. Après migration : la lecture/décision exige une
// OrgMembership active avec `businessRole ∈ {Admin, GestionnaireImmobilier,
// Collaborateur}` sur un tenant dont le module `location` est actif. Le
// revert exige `businessRole='Admin'`. Aucun fallback User.role.
//
// PLATFORM-ADMIN-CERT-1 (V3) reste actif : la borne cross-tenant du service
// (`req.tenantScopeUserIds`) — qui filtre les contrats par `proprietaire.user`
// résolu au tenant courant — n'est pas remplacée mais complétée par la garde
// membership. Les contrats authentiquement non-attribués (aucun
// `proprietaire.user` lié) restent visibles au staff légitime, exactement
// comme avant, mais aucun tenant ne peut voir un contrat d'un autre tenant.
const router = require('express').Router();
const auth = require('../controllers/authController');
const { requireTenantScope } = require('../middleware/tenantContext');
const { requireTenantModule } = require('../middleware/tenantModuleGate');
const { requireTenantMembershipRole } = require('../middleware/tenantMembershipRole');
const controller = require('../controllers/rentalContractRegularizationController');

const tenantAuthBase = [
  auth.protect,
  requireTenantScope,
  requireTenantModule('location'),
];

router.get('/',
  ...tenantAuthBase,
  requireTenantMembershipRole('Admin', 'GestionnaireImmobilier', 'Collaborateur'),
  controller.list,
);
router.post('/:contractId/decision',
  ...tenantAuthBase,
  requireTenantMembershipRole('Admin', 'GestionnaireImmobilier', 'Collaborateur'),
  controller.decide,
);
router.post('/:contractId/revert',
  ...tenantAuthBase,
  requireTenantMembershipRole('Admin'),
  controller.revert,
);

module.exports = router;
