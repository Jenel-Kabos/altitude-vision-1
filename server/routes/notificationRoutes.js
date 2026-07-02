const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Toutes les routes nécessitent une session valide
router.use(protect);

router.get('/',            ctrl.getMyNotifications);
router.get('/count',       ctrl.getUnreadCount);
router.patch('/read-all',  ctrl.markAllRead);
router.delete('/',         ctrl.clearRead);
router.patch('/:id/read',  ctrl.markRead);
router.delete('/:id',      ctrl.deleteNotification);

module.exports = router;
