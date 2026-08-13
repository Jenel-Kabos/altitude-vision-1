// PLATFORM-ADMIN-CERT-1 — vulnérabilité V3 corrigée : ce routeur n'imposait
// AUCUNE frontière tenant. `getCases()` interrogeait `Contrat.find({})`
// globalement et `decide()` permettait d'attribuer un contrat historique à
// une Property de N'IMPORTE QUEL tenant, sans jamais vérifier que l'acteur
// avait un lien légitime avec ce contrat (démontré par test adversarial).
// `requireTenantScope` attache `req.tenantScopeUserIds`, transmis au
// service pour filtrer les dossiers dont le propriétaire (`proprietaire.user`)
// est résolvable à un AUTRE tenant que celui de l'acteur. Les contrats
// authentiquement non attribuables (aucun `proprietaire.user` lié) restent
// visibles à tout staff autorisé — c'est le cas d'usage même de ce centre —
// mais un dossier dont le tenant est connu ne doit plus jamais fuiter vers
// un autre tenant.
const router = require('express').Router();
const auth = require('../controllers/authController');
const { requireTenantScope } = require('../middleware/tenantContext');
const controller = require('../controllers/rentalContractRegularizationController');

const staff = [auth.protect, auth.restrictTo('Admin', 'GestionnaireImmobilier', 'Collaborateur'), requireTenantScope];
router.get('/', staff, controller.list);
router.post('/:contractId/decision', staff, controller.decide);
router.post('/:contractId/revert', auth.protect, auth.restrictTo('Admin'), requireTenantScope, controller.revert);

module.exports = router;
