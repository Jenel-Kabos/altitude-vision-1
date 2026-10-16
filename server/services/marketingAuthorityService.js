const PlatformOperator = require('../models/PlatformOperator');
const User = require('../models/User');

class MarketingAuthorityError extends Error {
  constructor(code = 'PLATFORM_MARKETING_AUTHORITY_REQUIRED') {
    super(code === 'MARKETING_TENANT_SCOPE_FORBIDDEN'
      ? 'Le marketing commercial est réservé à Altitude Vision : aucun modèle ni aucune campagne ne peut être rattaché à une organisation.'
      : 'Autorité marketing Altitude Vision requise.');
    this.name = 'MarketingAuthorityError';
    this.code = code;
    this.statusCode = 403;
  }
}

const actorId = (actor) => actor?._id || actor?.id || actor;

// Lecture fraîche immédiatement avant chaque mutation ou livraison. Le rôle
// User et les adhésions tenant ne participent jamais à cette décision.
async function assertPlatformMarketingAuthority(actor, { session = null } = {}) {
  const userId = actorId(actor);
  if (!userId) throw new MarketingAuthorityError();
  const operatorQuery = PlatformOperator.findOne({
    user: userId,
    status: 'active',
    capabilities: 'platform.marketing.manage',
  });
  const userQuery = User.findOne({
    _id: userId,
    isActive: { $ne: false },
    status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] },
  });
  if (session) { operatorQuery.session(session); userQuery.session(session); }
  const [operator, user] = await Promise.all([operatorQuery.lean(), userQuery.select('_id').lean()]);
  if (!operator || !user) throw new MarketingAuthorityError();
  return operator;
}

// LOT E — le consentement marketing appartient à Altitude Vision : aucun
// objet marketing (modèle, campagne) ne peut être créé, activé, approuvé ou
// envoyé pour le compte d'un tenant, y compris par un opérateur habilité.
function assertPlatformMarketingScope(tenant) {
  if (tenant) throw new MarketingAuthorityError('MARKETING_TENANT_SCOPE_FORBIDDEN');
}

module.exports = { MarketingAuthorityError, assertPlatformMarketingAuthority, assertPlatformMarketingScope };
