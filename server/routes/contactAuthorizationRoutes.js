const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/contactAuthorizationController');
const { requirePlatformOperatorCapability, requirePlatformGovernanceScope } = require('../middleware/platformAuthority');

router.use(auth.protect);
router.get('/:id', controller.getOne);
router.use(requirePlatformOperatorCapability('platform.commercial.manage'));
router.use(requirePlatformGovernanceScope);
router.get('/', controller.list);
router.post('/', controller.grant);
router.patch('/:id/revoke', controller.revoke);

module.exports = router;

