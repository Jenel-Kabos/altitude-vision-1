const service = require('../services/rentalContractRegularizationService');

const fail = (res, error) => res.status(error.statusCode || 500).json({
  status: (error.statusCode || 500) >= 500 ? 'error' : 'fail',
  code: error.code || 'REGULARIZATION_ERROR',
  message: error.message,
});

exports.list = async (req, res) => {
  try {
    // PLATFORM-ADMIN-CERT-1 (V3) — `req.tenantScopeUserIds` borne les dossiers
    // à ceux dont le propriétaire est résolvable au tenant actif, ou
    // authentiquement non attribuables (voir service).
    const cases = await service.getCases({ tenantScopeUserIds: req.tenantScopeUserIds || [] });
    res.json({ status: 'success', results: cases.length, data: { cases } });
  } catch (error) { fail(res, error); }
};

exports.decide = async (req, res) => {
  try {
    const record = await service.decide({
      contractId: req.params.contractId, action: req.body.action, data: req.body, actor: req.user,
      tenantScopeUserIds: req.tenantScopeUserIds || [],
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};

exports.revert = async (req, res) => {
  try {
    const record = await service.revert({
      contractId: req.params.contractId, reason: req.body.reason, actor: req.user,
      tenantScopeUserIds: req.tenantScopeUserIds || [],
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};
