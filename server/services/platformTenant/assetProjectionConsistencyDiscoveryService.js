const Property = require('../../models/Property');
const Accommodation = require('../../models/Accommodation');
const Hotel = require('../../models/Hotel');
const Transaction = require('../../models/Transaction');
const AccommodationReservation = require('../../models/AccommodationReservation');
const HotelReservation = require('../../models/HotelReservation');
const OrgMembership = require('../../models/OrgMembership');
const PlatformTenant = require('../../models/PlatformTenant');
const {
  classifyOrganizationAsset,
} = require('./organizationAssetInvariantService');

const ACTIVE_TRANSACTIONS = ['En cours', 'Paiement en attente', 'Litigée'];
const ACTIVE_ACCOMMODATION_RESERVATIONS = ['pending', 'pending_payment', 'confirmed', 'checked_in'];
const ACTIVE_HOTEL_RESERVATIONS = ['pending', 'confirmed', 'checked_in'];
const sid = (value) => (value?._id ? String(value._id) : value == null ? null : String(value));

async function selectedLean(model, filter, selection) {
  return model.find(filter).select(selection).lean();
}

// C2.8M — l'organisation cible n'est jamais acceptée sur parole. Lecture seule,
// même règle canonique que tenantApplicationService.assertApplicantEligibleForProvisioning :
// exactement une OrgMembership active roleInUnit owner, businessRole Admin, aucun
// historique owner inactif, racine résolue vers ce tenant, tenant trial/active.
// Jamais createdBy, manager, User.role, simple membership ni en-tête client.
async function proveTargetOwnership({ ownerId, targetTenantId, M }) {
  const [active, inactive] = await Promise.all([
    selectedLean(M.OrgMembership, { user: ownerId, roleInUnit: 'owner', status: 'active' }, 'orgUnit businessRole'),
    selectedLean(M.OrgMembership, { user: ownerId, roleInUnit: 'owner', status: { $ne: 'active' } }, '_id'),
  ]);
  const tenants = active.length
    ? await selectedLean(M.PlatformTenant, { rootOrgUnit: { $in: active.map(({ orgUnit }) => orgUnit) } }, '_id rootOrgUnit status')
    : [];
  const ownerOrganizationTenantIds = tenants.map(({ _id }) => sid(_id));
  const verdict = (proven, reason) => ({ proven, reason, ownerOrganizationTenantIds });
  if (!active.length) return verdict(false, 'NOT_ORGANIZATION_OWNER');
  if (active.length > 1) return verdict(false, 'OWNER_ORGANIZATION_AMBIGUOUS');
  if (inactive.length) return verdict(false, 'OWNER_MEMBERSHIP_HISTORY_CONFLICT');
  if (active[0].businessRole !== 'Admin') return verdict(false, 'OWNER_BUSINESS_ROLE_NOT_ADMIN');
  if (tenants.length !== 1) return verdict(false, 'OWNER_ORGANIZATION_UNRESOLVED');
  if (sid(tenants[0]._id) !== sid(targetTenantId)) return verdict(false, 'TARGET_TENANT_MISMATCH');
  if (!['trial', 'active'].includes(tenants[0].status)) return verdict(false, 'TARGET_TENANT_INACTIVE');
  return verdict(true, 'CANONICAL_OWNER_ORGANIZATION');
}

async function discoverAssetProjectionConsistency({ ownerId, targetTenantId, models = {} } = {}) {
  if (!ownerId) throw new Error('ASSET_PROJECTION_DISCOVERY_OWNER_REQUIRED');
  if (!targetTenantId) throw new Error('ASSET_PROJECTION_DISCOVERY_TARGET_TENANT_REQUIRED');
  const M = {
    Property, Accommodation, Hotel, Transaction, AccommodationReservation, HotelReservation, OrgMembership, PlatformTenant, ...models,
  };
  const targetOwnership = await proveTargetOwnership({ ownerId, targetTenantId, M });
  const properties = await selectedLean(
    M.Property,
    { owner: ownerId },
    '_id owner tenant pole status availability assetCycle',
  );
  const propertyIds = properties.map(({ _id }) => _id);
  const propertyIdSet = new Set(propertyIds.map(sid));
  const [accommodations, hotels, activeTransactions] = await Promise.all([
    selectedLean(M.Accommodation, { property: { $in: propertyIds } }, '_id property tenant'),
    selectedLean(M.Hotel, { $or: [{ property: { $in: propertyIds } }, { tenant: targetTenantId }] }, '_id property tenant'),
    selectedLean(M.Transaction, { property: { $in: propertyIds }, status: { $in: ACTIVE_TRANSACTIONS } }, 'property status'),
  ]);
  const hotelPropertyIds = [...new Set(hotels.map(({ property }) => sid(property)).filter(Boolean))];
  const existingHotelProperties = await selectedLean(
    M.Property,
    { _id: { $in: hotelPropertyIds } },
    '_id',
  );
  const existingHotelPropertyIds = new Set(existingHotelProperties.map(({ _id }) => sid(_id)));
  const accommodationIds = accommodations.map(({ _id }) => _id);
  const hotelIds = hotels.filter(({ property }) => propertyIdSet.has(sid(property))).map(({ _id }) => _id);
  const [activeAccommodationReservations, activeHotelReservations] = await Promise.all([
    selectedLean(M.AccommodationReservation, {
      accommodation: { $in: accommodationIds }, status: { $in: ACTIVE_ACCOMMODATION_RESERVATIONS },
    }, 'accommodation status'),
    selectedLean(M.HotelReservation, {
      hotel: { $in: hotelIds }, status: { $in: ACTIVE_HOTEL_RESERVATIONS },
    }, 'hotel status'),
  ]);

  const propertyByAccommodation = new Map(accommodations.map((item) => [sid(item._id), sid(item.property)]));
  const propertyByHotel = new Map(hotels.map((item) => [sid(item._id), sid(item.property)]));
  const blocked = new Set(activeTransactions.map((item) => sid(item.property)));
  activeAccommodationReservations.forEach((item) => blocked.add(propertyByAccommodation.get(sid(item.accommodation))));
  activeHotelReservations.forEach((item) => blocked.add(propertyByHotel.get(sid(item.hotel))));

  const classifications = properties.map((property) => ({
    propertyId: sid(property._id),
    ...classifyOrganizationAsset({
      property,
      ownerId,
      targetTenantId,
      activeWorkflow: blocked.has(sid(property._id)),
    }),
  }));
  const counts = {};
  classifications.forEach(({ classification }) => { counts[classification] = (counts[classification] || 0) + 1; });
  const danglingHotelAnchors = hotels
    .filter((hotel) => sid(hotel.tenant) === sid(targetTenantId) && !existingHotelPropertyIds.has(sid(hotel.property)))
    .map((hotel) => ({ hotelId: sid(hotel._id), propertyId: sid(hotel.property), tenantId: sid(hotel.tenant) }));

  return {
    readOnly: true,
    ownerId: sid(ownerId),
    targetTenantId: sid(targetTenantId),
    targetOwnership,
    counts,
    classifications,
    migrationCandidatePropertyIds: targetOwnership.proven
      ? classifications.filter(({ migratable }) => migratable).map(({ propertyId }) => propertyId)
      : [],
    danglingHotelAnchors,
  };
}

module.exports = {
  ACTIVE_TRANSACTIONS,
  ACTIVE_ACCOMMODATION_RESERVATIONS,
  ACTIVE_HOTEL_RESERVATIONS,
  discoverAssetProjectionConsistency,
};
