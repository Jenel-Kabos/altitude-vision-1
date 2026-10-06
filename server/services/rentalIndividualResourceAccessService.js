const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const { RENTAL_SCOPE, resolveRentalResourceScope } = require('./platformTenant/rentalScopeService');
const {
  IndividualRentalAccessError,
  assertIndependentOwnerState,
  assertIndividualEntitlement,
  individualRentalPropertyIds,
} = require('./rentalIndividualAccessService');

const id = (value) => String(value?._id || value);

async function assertIndividualRentalResourceAccess({ resourceType, resource, userId, session } = {}) {
  const scope = await resolveRentalResourceScope({ resourceType, resource });
  if (scope.status !== 'resolved' || scope.scope !== RENTAL_SCOPE.INDIVIDUAL) {
    throw new IndividualRentalAccessError('INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', 'Ressource locative introuvable.', 404);
  }
  const ownerId = id(userId);
  const query = Property.find({ _id: { $in: scope.propertyIds } }).select('_id owner tenant');
  if (session) query.session(session);
  const properties = await query.lean();
  const directIndividualOwner = resource?.individualOwner ? id(resource.individualOwner) : null;
  const directPartyWithoutProperty = ['Locataire', 'Proprietaire'].includes(resourceType) && scope.propertyIds.length === 0;
  if ((directPartyWithoutProperty && directIndividualOwner !== ownerId)
    || (!directPartyWithoutProperty && (properties.length !== scope.propertyIds.length || properties.some((property) => property.tenant || id(property.owner) !== ownerId)))
    || (directIndividualOwner && directIndividualOwner !== ownerId)) {
    throw new IndividualRentalAccessError('INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', 'Ressource locative introuvable.', 404);
  }
  await assertIndependentOwnerState(ownerId, { session });
  const entitlement = await assertIndividualEntitlement(ownerId, { session });
  return { ...scope, ownerId, entitlement };
}

async function assertIndividualRentalResourceSetAccess({ resourceType, resources, userId, session } = {}) {
  const rows = Array.isArray(resources) ? resources : [];
  if (rows.length === 0) {
    throw new IndividualRentalAccessError('INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND', 'Ressource locative introuvable.', 404);
  }
  const decisions = await Promise.all(rows.map((resource) => assertIndividualRentalResourceAccess({
    resourceType, resource, userId, session,
  })));
  return { resources: rows, decisions };
}

async function individualRentalDomainIds(userId, { session } = {}) {
  const propertyIds = await individualRentalPropertyIds(userId, { session });
  const contractQuery = Contrat.find({ bien: { $in: propertyIds }, type: 'location' });
  if (session) contractQuery.session(session);
  const contracts = await contractQuery.select('_id locataire proprietaire').lean();
  const contractIds = contracts.map(({ _id }) => _id);
  const tenantPartyIds = [...new Map(contracts.filter(({ locataire }) => locataire).map(({ locataire }) => [id(locataire), locataire])).values()];
  const ownerPartyIds = [...new Map(contracts.filter(({ proprietaire }) => proprietaire).map(({ proprietaire }) => [id(proprietaire), proprietaire])).values()];
  const [paymentIds, maintenanceIds] = await Promise.all([
    contractIds.length ? Paiement.find({ contrat: { $in: contractIds } }).distinct('_id') : [],
    propertyIds.length ? RentalMaintenanceTicket.find({ property: { $in: propertyIds } }).distinct('_id') : [],
  ]);
  return { propertyIds, contractIds, tenantPartyIds, ownerPartyIds, paymentIds, maintenanceIds };
}

module.exports = { assertIndividualRentalResourceAccess, assertIndividualRentalResourceSetAccess, individualRentalDomainIds };
