const asyncHandler = require('express-async-handler');
const { getPropertyPortfolio, getPropertyPortfolioForTenantScope } = require('../services/propertyPortfolioService');

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
  if (req.isPlatformOperatorContext && !req.platformOperatorCapabilities?.includes('platform.properties.read')) {
    return res.status(403).json({ status: 'fail', message: 'Action refusée : capacité opérateur plateforme requise.' });
  }
  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-E — forward the selected
  // tenant so the portfolio filters strictly by `Property.tenant` when a
  // canonical tenant context is resolved. PlatformOperator platform-wide
  // (no tenant selected) keeps the unscoped variant.
  const portfolio = req.isPlatformOperatorContext && !req.platformTenant
    ? await getPropertyPortfolio()
    : await getPropertyPortfolioForTenantScope({
      scopeUserIds: req.tenantScopeUserIds || [],
      tenantId: req.platformTenant?._id || null,
    });
  res.status(200).json({ status: 'success', results: portfolio.items.length, data: portfolio });
});
