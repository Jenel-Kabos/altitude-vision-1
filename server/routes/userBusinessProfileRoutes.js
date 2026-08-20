// USER-ARCH-1 — Routes du profil métier. Octroi/suspension/révocation
// strictement Admin (identité sensible) ; lecture ouverte à l'utilisateur
// concerné et au staff (vérifié dans le contrôleur/middleware ci-dessous),
// même esprit que propertyAssetRoutes.js (GL-ASSET-1).
const express = require('express');
const auth = require('../middleware/authMiddleware');
const { ROLES_DOCS } = require('../utils/roles');
const ctrl = require('../controllers/userBusinessProfileController');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const User = require('../models/User');

const router = express.Router();
router.use(auth.protect);

// TENANT-SCOPE-AUDIT-2B (Phase C) — `assertResourceTenant` (STRICTE) traitait
// une cible sans OrgMembership (Proprietaire/exploitant public-signup, cas
// typique de ce module) comme un échec, bloquant le staff légitime du
// tenant unique alors même que l'auto-lecture (`isSelf`, ci-dessous) ne
// dépend déjà d'AUCUNE frontière tenant pour ce même utilisateur — les
// profils métier sont dérivés par pur ownership (Property.owner,
// Hotel.manager…), jamais par OrgMembership (voir
// userBusinessProfileService.deriveProfilesFromExistingData). Réutilise la
// même primitive fail-open déjà certifiée ailleurs (documentController.js,
// userController.downloadContractDocument, propertyController.js…) : un
// résultat `resolved` vers un AUTRE tenant reste refusé à l'identique.
async function assertTargetInActorTenant(req) {
  const tenant = await resolveTenantForUser(req.user._id || req.user.id, req.headers['x-platform-tenant-id']);
  if (!tenant) {
    const error = new Error('Contexte tenant requis ou ambigu pour cette action.');
    error.statusCode = 403;
    throw error;
  }
  const target = await User.findById(req.params.userId).select('_id').lean();
  if (!target) {
    const error = new Error('Ressource inaccessible dans ce contexte tenant.');
    error.statusCode = 404;
    throw error;
  }
  await assertResourceTenantOrUnattributed({ resourceType: 'User', resource: target, tenantId: tenant._id });
}

function tenantBoundaryResponse(res, error) {
  return res.status(error.statusCode === 403 ? 403 : 404).json({
    status: 'fail', message: 'Ressource inaccessible dans ce contexte tenant.',
  });
}

async function selfOrStaff(req, res, next) {
  const isSelf = String(req.user._id || req.user.id) === String(req.params.userId);
  const isStaff = ROLES_DOCS.includes(req.user.role);
  if (!isSelf && !isStaff) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  if (isSelf) return next();
  try { await assertTargetInActorTenant(req); return next(); } catch (error) { return tenantBoundaryResponse(res, error); }
}

async function staffOnly(req, res, next) {
  if (!ROLES_DOCS.includes(req.user.role)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  try { await assertTargetInActorTenant(req); return next(); } catch (error) { return tenantBoundaryResponse(res, error); }
}

async function adminTargetOnly(req, res, next) {
  try { await assertTargetInActorTenant(req); return next(); } catch (error) { return tenantBoundaryResponse(res, error); }
}

router.get('/:userId', selfOrStaff, ctrl.list);
router.get('/:userId/history', staffOnly, ctrl.history);
router.post('/:userId', auth.restrictTo('Admin'), adminTargetOnly, ctrl.grant);
router.post('/:userId/:profileType/suspend', auth.restrictTo('Admin'), adminTargetOnly, ctrl.suspend);
router.post('/:userId/:profileType/revoke', auth.restrictTo('Admin'), adminTargetOnly, ctrl.revoke);

module.exports = router;
