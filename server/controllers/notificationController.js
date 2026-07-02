const asyncHandler  = require('express-async-handler');
const Notification  = require('../models/Notification');

const PAGE_SIZE = 20;

// GET /api/notifications
// Query params : page (default 1), filter (all|unread)
exports.getMyNotifications = asyncHandler(async (req, res) => {
  const page      = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const unreadOnly = req.query.filter === 'unread';

  const match = { recipient: req.user._id };
  if (unreadOnly) match.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Notification.countDocuments(match),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      notifications,
      pagination: {
        page,
        pages: Math.ceil(total / PAGE_SIZE),
        total,
      },
      unreadCount,
    },
  });
});

// GET /api/notifications/count
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    read: false,
  });
  res.status(200).json({ status: 'success', data: { count } });
});

// PATCH /api/notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { new: true },
  );
  if (!notif) {
    res.status(404);
    throw new Error('Notification introuvable.');
  }
  res.status(200).json({ status: 'success', data: { notification: notif } });
});

// PATCH /api/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true },
  );
  res.status(200).json({
    status: 'success',
    data: { updated: result.modifiedCount },
  });
});

// DELETE /api/notifications/:id
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (!notif) {
    res.status(404);
    throw new Error('Notification introuvable.');
  }
  res.status(204).send();
});

// DELETE /api/notifications — supprime toutes les notifs lues
exports.clearRead = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({
    recipient: req.user._id,
    read: true,
  });
  res.status(200).json({
    status: 'success',
    data: { deleted: result.deletedCount },
  });
});
