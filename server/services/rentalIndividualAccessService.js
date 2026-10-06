const mongoose = require('mongoose');
const Property = require('../models/Property');
const {
  OWNER_ORGANIZATIONAL_STATE,
  inspectOwnerOrganizationalConsistency,
} = require('./platformTenant/organizationAssetInvariantService');
const { MODULE_SCOPE, assertCanUseModule } = require('./subscription/moduleEntitlementService');

class IndividualRentalAccessError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'IndividualRentalAccessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const id = (value) => (mongoose.isValidObjectId(value?._id || value) ? String(value?._id || value) : null);

async function assertIndependentOwnerState(userId, { session } = {}) {
  const inspection = await inspectOwnerOrganizationalConsistency(userId, { session });
  if (inspection.state !== OWNER_ORGANIZATIONAL_STATE.INDEPENDENT) {
    throw new IndividualRentalAccessError(
      'INDIVIDUAL_ORGANIZATION_STATE_CONFLICT',
      'Ce patrimoine nécessite une régularisation organisationnelle avant toute autogestion individuelle.',
      409,
    );
  }
  return inspection;
}

async function assertIndividualEntitlement(userId, { session } = {}) {
  return assertCanUseModule({ scope: MODULE_SCOPE.INDIVIDUAL, userId, module: 'location', session });
}

async function assertIndividualRentalPropertyAccess({ property, userId, session } = {}) {
  const user = id(userId);
  if (!property || property.tenant || !user || id(property.owner) !== user) {
    throw new IndividualRentalAccessError(
      'INDIVIDUAL_RENTAL_RESOURCE_NOT_FOUND',
      'Ressource locative introuvable.',
      404,
    );
  }
  await assertIndependentOwnerState(user, { session });
  const entitlement = await assertIndividualEntitlement(user, { session });
  return { scope: 'INDIVIDUAL', tenantId: null, ownerId: user, entitlement };
}

async function individualRentalPropertyIds(userId, { session } = {}) {
  const user = id(userId);
  if (!user) throw new IndividualRentalAccessError('INDIVIDUAL_OWNER_REQUIRED', 'Propriétaire requis.', 403);
  await assertIndependentOwnerState(user, { session });
  await assertIndividualEntitlement(user, { session });
  const query = Property.find({ owner: user, tenant: null }).distinct('_id');
  if (session) query.session(session);
  return query;
}

module.exports = {
  IndividualRentalAccessError,
  assertIndependentOwnerState,
  assertIndividualEntitlement,
  assertIndividualRentalPropertyAccess,
  individualRentalPropertyIds,
};
