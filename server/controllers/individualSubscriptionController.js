const service = require('../services/subscription/individualSubscriptionService');

const sendError = (res, error) => res.status(error.statusCode || 500).json({ status: 'fail', code: error.code, message: error.message });

exports.getMine = async (req, res) => {
  try { res.json({ status: 'success', data: { subscription: await service.getIndividualSubscription(req.user._id || req.user.id) } }); }
  catch (error) { sendError(res, error); }
};
exports.getForUser = async (req, res) => {
  try { res.json({ status: 'success', data: { subscription: await service.getIndividualSubscription(req.params.userId) } }); }
  catch (error) { sendError(res, error); }
};
exports.changeForUser = async (req, res) => {
  try { res.status(201).json({ status: 'success', data: { subscription: await service.changeIndividualSubscription(req.params.userId, { ...req.body, actor: req.user }) } }); }
  catch (error) { sendError(res, error); }
};
exports.cancelForUser = async (req, res) => {
  try { res.json({ status: 'success', data: { subscription: await service.cancelIndividualSubscription(req.params.userId, { actor: req.user, reason: req.body?.reason }) } }); }
  catch (error) { sendError(res, error); }
};
