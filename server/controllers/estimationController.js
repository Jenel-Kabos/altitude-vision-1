const Estimation = require('../models/Estimation');

exports.getUnreadEstimationCount = async (_req, res) => {
  const unreadCount = await Estimation.countDocuments({ staffViewedAt: null });
  res.status(200).json({ status: 'success', data: { unreadCount } });
};
