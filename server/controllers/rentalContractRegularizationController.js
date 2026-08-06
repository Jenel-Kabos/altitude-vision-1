const service = require('../services/rentalContractRegularizationService');

const fail = (res, error) => res.status(error.statusCode || 500).json({
  status: (error.statusCode || 500) >= 500 ? 'error' : 'fail',
  code: error.code || 'REGULARIZATION_ERROR',
  message: error.message,
});

exports.list = async (_req, res) => {
  try {
    const cases = await service.getCases();
    res.json({ status: 'success', results: cases.length, data: { cases } });
  } catch (error) { fail(res, error); }
};

exports.decide = async (req, res) => {
  try {
    const record = await service.decide({ contractId: req.params.contractId, action: req.body.action, data: req.body, actor: req.user });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};

exports.revert = async (req, res) => {
  try {
    const record = await service.revert({ contractId: req.params.contractId, reason: req.body.reason, actor: req.user });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};
