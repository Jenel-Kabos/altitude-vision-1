const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/individualSubscriptionController');
const { requirePlatformOperatorCapability, requirePlatformGovernanceScope } = require('../middleware/platformAuthority');

router.use(auth.protect);
router.get('/me', ctrl.getMine);
router.get('/:userId', requirePlatformOperatorCapability('platform.rentals.read'), ctrl.getForUser);
router.post('/:userId', requirePlatformOperatorCapability('platform.rentals.manage'), requirePlatformGovernanceScope, ctrl.changeForUser);
router.delete('/:userId', requirePlatformOperatorCapability('platform.rentals.manage'), requirePlatformGovernanceScope, ctrl.cancelForUser);

module.exports = router;
