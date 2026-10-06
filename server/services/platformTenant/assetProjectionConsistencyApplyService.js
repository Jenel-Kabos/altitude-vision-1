const crypto = require('crypto');
const mongoose = require('mongoose');
const Property = require('../../models/Property');
const PlatformTenant = require('../../models/PlatformTenant');
const OrgMembership = require('../../models/OrgMembership');
const PlatformOperator = require('../../models/PlatformOperator');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const RealEstateReservation = require('../../models/RealEstateReservation');
const RealEstateApplication = require('../../models/RealEstateApplication');
const RentalManagement = require('../../models/RentalManagement');
const Contrat = require('../../models/Contrat');
const Accommodation = require('../../models/Accommodation');
const AccommodationReservation = require('../../models/AccommodationReservation');
const Hotel = require('../../models/Hotel');
const HotelReservation = require('../../models/HotelReservation');
const ActionLog = require('../../models/ActionLog');
const { ASSET_CLASSIFICATION, classifyOrganizationAsset } = require('./organizationAssetInvariantService');

const REASON = 'C2_8M_LEGACY_ORGANIZATION_ASSET_REGULARIZATION';
const ACTIVE_TRANSACTIONS = ['En cours', 'Paiement en attente', 'Litigée'];
const ACTIVE_APPLICATIONS = ['submitted', 'under_review', 'accepted'];
const ACTIVE_ACCOMMODATION_RESERVATIONS = ['pending', 'pending_payment', 'confirmed', 'checked_in'];
const ACTIVE_HOTEL_RESERVATIONS = ['pending', 'confirmed', 'checked_in'];
const sid = (value) => (value?._id ? String(value._id) : value == null ? null : String(value));

class AssetProjectionRegularizationError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AssetProjectionRegularizationError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => { throw new AssetProjectionRegularizationError(code, message, details); };

function assertInput(input) {
  if (!['preview', 'apply'].includes(input?.mode)) fail('MODE_INVALID', 'mode preview ou apply requis.');
  for (const [field, value] of Object.entries({
    targetTenantId: input.targetTenantId,
    expectedOwnerId: input.expectedOwnerId,
    actorId: input.actorId,
  })) if (!mongoose.isValidObjectId(value)) fail('INPUT_INVALID', `${field} invalide.`);
  if (!Array.isArray(input.propertyIds) || !input.propertyIds.length) fail('PROPERTY_ALLOWLIST_REQUIRED', 'Allowlist Property requise.');
  if (input.propertyIds.some((id) => !mongoose.isValidObjectId(id))) fail('PROPERTY_ALLOWLIST_INVALID', 'Un Property ID est invalide.');
  if (new Set(input.propertyIds.map(sid)).size !== input.propertyIds.length) fail('PROPERTY_ALLOWLIST_DUPLICATE', 'Les Property IDs doivent être uniques.');
  if (!input.reason?.trim()) fail('REASON_REQUIRED', 'Reason requis.');
  if (!input.operationId?.trim()) fail('OPERATION_ID_REQUIRED', 'Operation ID requis.');
}

async function assertActor({ actorId, session }) {
  const [operator, user] = await Promise.all([
    PlatformOperator.findOne({ user: actorId, status: 'active', capabilities: 'platform.properties.manage' }).session(session).lean(),
    User.findOne({ _id: actorId, isActive: true, status: 'Actif', isTechnical: { $ne: true } }).session(session).lean(),
  ]);
  if (!operator || !user) fail('ACTOR_NOT_AUTHORIZED', 'PlatformOperator actif avec platform.properties.manage requis.');
}

async function assertTargetOwnership({ expectedOwnerId, targetTenantId, session }) {
  const tenant = await PlatformTenant.findById(targetTenantId).session(session).lean();
  if (!tenant || !['trial', 'active'].includes(tenant.status)) fail('TARGET_OWNERSHIP_INVALID', 'Tenant cible absent ou inactif.');
  const [active, inactive] = await Promise.all([
    OrgMembership.find({ user: expectedOwnerId, roleInUnit: 'owner', status: 'active' }).session(session).lean(),
    OrgMembership.findOne({ user: expectedOwnerId, roleInUnit: 'owner', status: { $ne: 'active' } }).session(session).lean(),
  ]);
  if (active.length !== 1 || inactive || active[0].businessRole !== 'Admin'
    || sid(active[0].orgUnit) !== sid(tenant.rootOrgUnit)) {
    fail('TARGET_OWNERSHIP_INVALID', 'La propriété canonique owner/Admin du tenant cible n’est plus prouvée.');
  }
  return tenant;
}

async function blockedPropertyIds({ properties, session }) {
  const propertyIds = properties.map(({ _id }) => _id);
  const [transactions, reservations, applications, rentals, contracts, accommodations, hotels] = await Promise.all([
    Transaction.find({ property: { $in: propertyIds }, status: { $in: ACTIVE_TRANSACTIONS } }).select('property').session(session).lean(),
    RealEstateReservation.find({ property: { $in: propertyIds }, status: 'active' }).select('property').session(session).lean(),
    RealEstateApplication.find({ property: { $in: propertyIds }, status: { $in: ACTIVE_APPLICATIONS } }).select('property').session(session).lean(),
    RentalManagement.find({ property: { $in: propertyIds } }).select('property').session(session).lean(),
    Contrat.find({ bien: { $in: propertyIds }, statut: { $in: ['actif', 'en_attente'] } }).select('bien').session(session).lean(),
    Accommodation.find({ property: { $in: propertyIds } }).select('_id property').session(session).lean(),
    Hotel.find({ property: { $in: propertyIds } }).select('_id property').session(session).lean(),
  ]);
  const blocked = new Set([
    ...transactions.map(({ property }) => sid(property)),
    ...reservations.map(({ property }) => sid(property)),
    ...applications.map(({ property }) => sid(property)),
    ...rentals.map(({ property }) => sid(property)),
    ...contracts.map(({ bien }) => sid(bien)),
  ]);
  const accommodationToProperty = new Map(accommodations.map((item) => [sid(item._id), sid(item.property)]));
  const hotelToProperty = new Map(hotels.map((item) => [sid(item._id), sid(item.property)]));
  const [accommodationReservations, hotelReservations] = await Promise.all([
    AccommodationReservation.find({
      accommodation: { $in: accommodations.map(({ _id }) => _id) },
      status: { $in: ACTIVE_ACCOMMODATION_RESERVATIONS },
    }).select('accommodation').session(session).lean(),
    HotelReservation.find({
      hotel: { $in: hotels.map(({ _id }) => _id) },
      status: { $in: ACTIVE_HOTEL_RESERVATIONS },
    }).select('hotel').session(session).lean(),
  ]);
  accommodationReservations.forEach(({ accommodation }) => blocked.add(accommodationToProperty.get(sid(accommodation))));
  hotelReservations.forEach(({ hotel }) => blocked.add(hotelToProperty.get(sid(hotel))));
  blocked.delete(undefined);
  return blocked;
}

function classifyBatch({ properties, expectedOwnerId, targetTenantId, blocked }) {
  return properties.map((property) => {
    const propertyId = sid(property._id);
    if (sid(property.owner) !== sid(expectedOwnerId)) fail('OWNER_MISMATCH', 'Le propriétaire réel a changé.', { propertyId });
    if (property.tenant && sid(property.tenant) !== sid(targetTenantId)) fail('TENANT_CONFLICT', 'Le Property appartient déjà à un autre tenant.', { propertyId });
    const result = classifyOrganizationAsset({
      property,
      ownerId: expectedOwnerId,
      targetTenantId,
      activeWorkflow: blocked.has(propertyId),
    });
    if (result.classification === ASSET_CLASSIFICATION.HISTORICAL_KEEP) fail('HISTORICAL_ASSET_REFUSED', 'Un actif historique ne peut pas migrer.', { propertyId });
    if (result.classification === ASSET_CLASSIFICATION.ACTIVE_WORKFLOW_BLOCKER) fail('ACTIVE_WORKFLOW_BLOCKER', 'Un workflow actif bloque la migration.', { propertyId });
    if (![ASSET_CLASSIFICATION.ELIGIBLE_ACTIVE_ASSET, ASSET_CLASSIFICATION.ALREADY_IN_TARGET].includes(result.classification)) {
      fail('ASSET_NOT_ELIGIBLE', 'Le Property n’est pas éligible.', { propertyId, classification: result.classification });
    }
    return { property, propertyId, ...result };
  });
}

function casFilter(item, expectedOwnerId) {
  const { property } = item;
  const filter = {
    _id: property._id,
    owner: expectedOwnerId,
    tenant: null,
    pole: property.pole,
    status: property.status,
    availability: property.availability,
  };
  if (property.assetCycle !== undefined) filter.assetCycle = property.assetCycle;
  return filter;
}

function injectFailure(input, point) {
  if (input.failureInjection === point) fail('INJECTED_FAILURE', `Failure C2.8M injectée : ${point}.`);
}

async function writeAudit({ item, input, session }) {
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    propertyId: item.propertyId,
    owner: sid(item.property.owner),
    tenant: null,
    targetTenant: sid(input.targetTenantId),
  })).digest('hex');
  await ActionLog.create([{
    tenant: input.targetTenantId,
    action: 'asset_projection_consistency.applied',
    description: `${input.reason} Property`,
    module: 'PlatformAdmin', scopeMode: 'tenant', typeAction: 'MODIFICATION',
    auteur: { id: input.actorId, role: 'PlatformOperator' },
    cible: { id: item.propertyId, type: 'Property', nom: item.property.title },
    metadata: { regularization: {
      batchId: input.operationId,
      resourceType: 'Property', resourceId: item.propertyId,
      classification: 'A', proofs: ['Property.owner', 'Property.tenant', 'OrgMembership.owner.Admin'],
      before: { tenant: null, owner: sid(item.property.owner) },
      after: { tenant: sid(input.targetTenantId), owner: sid(item.property.owner) },
      fingerprintBefore: fingerprint, manifestHash: fingerprint,
      reason: input.reason, operation: 'apply',
    } },
  }], { session });
}

async function executeInTransaction(input, session) {
  await assertActor({ actorId: input.actorId, session });
  await assertTargetOwnership({ expectedOwnerId: input.expectedOwnerId, targetTenantId: input.targetTenantId, session });
  const properties = await Property.find({ _id: { $in: input.propertyIds } }).session(session).lean();
  if (properties.length !== input.propertyIds.length) fail('PROPERTY_ALLOWLIST_MISMATCH', 'La totalité de l’allowlist doit exister.');
  const blocked = await blockedPropertyIds({ properties, session });
  const classified = classifyBatch({
    properties,
    expectedOwnerId: input.expectedOwnerId,
    targetTenantId: input.targetTenantId,
    blocked,
  });
  const ordered = input.propertyIds.map((id) => classified.find(({ propertyId }) => propertyId === sid(id)));
  const candidates = ordered.filter(({ migratable }) => migratable);
  const items = ordered.map(({ propertyId, classification }) => ({
    propertyId,
    classification,
    action: classification === ASSET_CLASSIFICATION.ALREADY_IN_TARGET ? 'ALREADY_IN_TARGET' : 'MIGRATE',
    ownerId: sid(input.expectedOwnerId),
    currentTenantId: classification === ASSET_CLASSIFICATION.ALREADY_IN_TARGET ? sid(input.targetTenantId) : null,
    targetTenantId: sid(input.targetTenantId),
  }));
  if (input.mode === 'preview') return { mode: 'preview', status: 'READY_TO_APPLY', migratedCount: 0, wouldMigrateCount: candidates.length, items };
  injectFailure(input, 'before_first_mutation');
  for (let index = 0; index < candidates.length; index += 1) {
    const item = candidates[index];
    if (index === 1) injectFailure(input, 'before_second_property');
    const update = await Property.updateOne(casFilter(item, input.expectedOwnerId), { $set: { tenant: input.targetTenantId } }, { session });
    if (update.modifiedCount !== 1) fail('CONCURRENT_DIVERGENCE', 'Le CAS Property a échoué.', { propertyId: item.propertyId });
    await writeAudit({ item, input, session });
    if (index === 0) injectFailure(input, 'after_first_property');
  }
  injectFailure(input, 'before_commit');
  return {
    mode: 'apply',
    status: candidates.length ? 'APPLIED' : 'ALREADY_IN_TARGET',
    migratedCount: candidates.length,
    items,
  };
}

async function regularizeAssetProjectionBatch(input) {
  assertInput(input);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await executeInTransaction(input, session); });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  REASON,
  AssetProjectionRegularizationError,
  regularizeAssetProjectionBatch,
};
