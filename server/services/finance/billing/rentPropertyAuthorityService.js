// Périmètre d'autorité sur un bien loué (source unique pour la facturation
// des loyers et les politiques contractuelles des baux) : PLATFORM uniquement
// pour un bien sans organisation sous mandat PLATFORM explicite ; sinon le
// tenant du bien (un bien sans tenant ni mandat PLATFORM n'est administrable
// par aucun gestionnaire — seul son propriétaire agit en libre-service).
const C = require('../../../constants/contractualFinanceConstants');
const authz = require('../contractual/contractualFinanceAuthorizationService');

const resourceScope = (property, mandate) => (mandate?.mandataryType === C.MANDATARY_TYPES.PLATFORM && !property.tenant
  ? { mandataryType: C.MANDATARY_TYPES.PLATFORM, tenant: null }
  : { mandataryType: C.MANDATARY_TYPES.TENANT, tenant: property.tenant || null });

async function authorizeOnProperty(actor, capability, property, mandate) {
  return authz.authorizeOnResource(actor, capability, resourceScope(property, mandate));
}

module.exports = { resourceScope, authorizeOnProperty };
