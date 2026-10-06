const service = require('../services/rentalContractRegularizationService');

const fail = (res, error) => res.status(error.statusCode || 500).json({
  status: (error.statusCode || 500) >= 500 ? 'error' : 'fail',
  code: error.code || 'REGULARIZATION_ERROR',
  message: error.message,
});

// MICRO-HOTFIX-RENTAL-REG-SCOPE-1 (historique) — l'extension « tenant unique »
// qui rattachait les Proprietaire sans OrgMembership au seul tenant existant
// est retirée par C2.10A (décision D3 : aucune heuristique de tenant unique).
// C2.10A — le périmètre du centre est le tenant sélectionné, résolu côté
// service par provenance canonique (Property.tenant / fiche Proprietaire.tenant).
// Plus d'extension « tenant unique » ni de scope `owner ∈ membres`.
const scopeOf = (req) => ({ tenantId: req.platformTenant?._id || null });

exports.list = async (req, res) => {
  try {
    // PLATFORM-ADMIN-CERT-1 (V3) / C2.10A — seuls les dossiers de provenance
    // canonique = tenant actif sont listés (voir service).
    const cases = await service.getCases(scopeOf(req));
    res.json({ status: 'success', results: cases.length, data: { cases } });
  } catch (error) { fail(res, error); }
};

exports.decide = async (req, res) => {
  try {
    const record = await service.decide({
      contractId: req.params.contractId, action: req.body.action, data: req.body, actor: req.user,
      actorBusinessRole: req.tenantBusinessRole || null,
      ...scopeOf(req),
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};

exports.revert = async (req, res) => {
  try {
    const record = await service.revert({
      contractId: req.params.contractId, reason: req.body.reason, actor: req.user,
      actorBusinessRole: req.tenantBusinessRole || null,
      ...scopeOf(req),
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};
