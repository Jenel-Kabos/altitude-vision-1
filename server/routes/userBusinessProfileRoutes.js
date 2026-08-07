// USER-ARCH-1 — Routes du profil métier. Octroi/suspension/révocation
// strictement Admin (identité sensible) ; lecture ouverte à l'utilisateur
// concerné et au staff (vérifié dans le contrôleur/middleware ci-dessous),
// même esprit que propertyAssetRoutes.js (GL-ASSET-1).
const express = require('express');
const auth = require('../middleware/authMiddleware');
const { ROLES_DOCS } = require('../utils/roles');
const ctrl = require('../controllers/userBusinessProfileController');

const router = express.Router();
router.use(auth.protect);

function selfOrStaff(req, res, next) {
  const isSelf = String(req.user._id || req.user.id) === String(req.params.userId);
  const isStaff = ROLES_DOCS.includes(req.user.role);
  if (!isSelf && !isStaff) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  next();
}

function staffOnly(req, res, next) {
  if (!ROLES_DOCS.includes(req.user.role)) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
  next();
}

router.get('/:userId', selfOrStaff, ctrl.list);
router.get('/:userId/history', staffOnly, ctrl.history);
router.post('/:userId', auth.restrictTo('Admin'), ctrl.grant);
router.post('/:userId/:profileType/suspend', auth.restrictTo('Admin'), ctrl.suspend);
router.post('/:userId/:profileType/revoke', auth.restrictTo('Admin'), ctrl.revoke);

module.exports = router;
