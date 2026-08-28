const asyncHandler = require('express-async-handler');
const { getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');

// TENANT-SCOPE-AUDIT-1 — `req.tenantScopeUserIds` reste le scope brut
// `OrgMembership`-only : un bien appartenant à un Proprietaire créé par
// inscription publique, sans `OrgMembership`, restait invisible du
// portefeuille backoffice STAFF (route privée `/api/properties/portfolio`,
// authentification + `requireTenantScope`) — même défaut que
// HOTFIX-USERS-COUNT-1. Réutilise la même fonction canonique, appliquée
// STRICTEMENT ici (jamais dans `resolveTenantScope` ni dans le catalogue
// PUBLIC `publicPropertyService.js`, qui doit rester inchangé — un premier
// élargissement global de cette nature avait provoqué une fuite réelle
// démontrée par test sur ce catalogue, voir HOTFIX_USERS_COUNT1_REPORT.md).
exports.list = asyncHandler(async (req, res) => {
  const portfolio = await getPropertyPortfolioForTenantScope({ scopeUserIds: req.tenantScopeUserIds || [] });
  res.status(200).json({ status: 'success', results: portfolio.items.length, data: portfolio });
});
