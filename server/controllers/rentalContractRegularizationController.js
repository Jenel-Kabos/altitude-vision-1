const service = require('../services/rentalContractRegularizationService');
const { expandScopeWithUnaffiliatedUsersIfSoleTenant } = require('../services/unaffiliatedUserScopeService');

const fail = (res, error) => res.status(error.statusCode || 500).json({
  status: (error.statusCode || 500) >= 500 ? 'error' : 'fail',
  code: error.code || 'REGULARIZATION_ERROR',
  message: error.message,
});

// MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — `req.tenantScopeUserIds` (posé par
// `requireTenantScope`) reste le scope brut `OrgMembership`-only. Un
// `Contrat.proprietaire.user` peut référencer un Proprietaire créé par
// inscription publique, sans `OrgMembership` (même cause racine que
// HOTFIX-USERS-COUNT-1) : `isContractInScope` le traitait alors à tort comme
// appartenant à un AUTRE tenant, alors que sur un déploiement à tenant
// unique il appartient sans ambiguïté au seul tenant existant — dossier
// invisible en liste, `decide`/`revert` en 409 CASE_NOT_PENDING. Réutilise
// la même fonction canonique que `getAllUsers`/`router.param('id', …)`,
// jamais réimplémentée, jamais appliquée à `resolveTenantScope` (portée
// globale déjà démontrée dangereuse — voir HOTFIX_USERS_COUNT1_REPORT.md).
const resolveScope = (req) => expandScopeWithUnaffiliatedUsersIfSoleTenant(req.tenantScopeUserIds || [])
  .catch(() => req.tenantScopeUserIds || []);

exports.list = async (req, res) => {
  try {
    // PLATFORM-ADMIN-CERT-1 (V3) — `req.tenantScopeUserIds` borne les dossiers
    // à ceux dont le propriétaire est résolvable au tenant actif, ou
    // authentiquement non attribuables (voir service).
    const tenantScopeUserIds = await resolveScope(req);
    const cases = await service.getCases({ tenantScopeUserIds });
    res.json({ status: 'success', results: cases.length, data: { cases } });
  } catch (error) { fail(res, error); }
};

exports.decide = async (req, res) => {
  try {
    const tenantScopeUserIds = await resolveScope(req);
    const record = await service.decide({
      contractId: req.params.contractId, action: req.body.action, data: req.body, actor: req.user,
      tenantScopeUserIds,
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};

exports.revert = async (req, res) => {
  try {
    const tenantScopeUserIds = await resolveScope(req);
    const record = await service.revert({
      contractId: req.params.contractId, reason: req.body.reason, actor: req.user,
      tenantScopeUserIds,
    });
    res.json({ status: 'success', data: { reconciliation: record } });
  } catch (error) { fail(res, error); }
};
