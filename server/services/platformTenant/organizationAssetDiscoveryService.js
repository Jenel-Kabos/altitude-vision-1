const PlatformTenant = require('../../models/PlatformTenant');
const OrgMembership = require('../../models/OrgMembership');
const Property = require('../../models/Property');
const Hotel = require('../../models/Hotel');
const HotelReservation = require('../../models/HotelReservation');
const PlatformOperator = require('../../models/PlatformOperator');

const TERMINAL_PROPERTY_CYCLES = new Set(['vendu', 'archive']);
const TERMINAL_PROPERTY_AVAILABILITY = new Set(['Vendu', 'Retiré']);
const ACTIVE_HOTEL_RESERVATIONS = ['pending', 'confirmed', 'checked_in'];
const sid = (value) => value?._id ? String(value._id) : value == null ? null : String(value);
const push = (map, key, value) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(value); };

async function readCursor(query, consume, metrics, batchSize) {
  const cursor = query.lean().cursor({ batchSize });
  let inBatch = 0;
  for await (const document of cursor) {
    consume(document); metrics.documentsScanned += 1; inBatch += 1;
    if (inBatch === batchSize) { metrics.batchCount += 1; inBatch = 0; }
  }
  if (inBatch) metrics.batchCount += 1;
  metrics.queries += 1;
}

async function discoverOrganizationAssetInvariants({ batchSize = 500, models = {} } = {}) {
  const M = { PlatformTenant, OrgMembership, Property, Hotel, HotelReservation, PlatformOperator, ...models };
  const startedAt = Date.now();
  const metrics = { queries: 0, documentsScanned: 0, batchCount: 0, batchSize };
  const tenants = new Map(); const ownedTenants = new Map(); const membershipsByUser = new Map();
  const propertiesByOwner = new Map(); const hotels = []; const operatorStatus = new Map(); const activeReservationHotels = new Set();

  await readCursor(M.PlatformTenant.find({}).select('_id rootOrgUnit createdBy'), (tenant) => tenants.set(sid(tenant.rootOrgUnit), tenant), metrics, batchSize);
  await readCursor(M.OrgMembership.find({ status: 'active' }).select('user orgUnit roleInUnit businessRole'), (membership) => {
    push(membershipsByUser, sid(membership.user), membership);
    if (membership.roleInUnit === 'owner') {
      const tenant = tenants.get(sid(membership.orgUnit));
      if (tenant) push(ownedTenants, sid(membership.user), tenant);
    }
  }, metrics, batchSize);
  await readCursor(M.Property.find({}).select('_id owner tenant pole status availability assetCycle'), (property) => push(propertiesByOwner, sid(property.owner), property), metrics, batchSize);
  await readCursor(M.Hotel.find({}).select('_id tenant manager property createdBy'), (hotel) => hotels.push(hotel), metrics, batchSize);
  await readCursor(M.PlatformOperator.find({}).select('user status'), (operator) => operatorStatus.set(sid(operator.user), operator.status), metrics, batchSize);
  await readCursor(M.HotelReservation.find({ status: { $in: ACTIVE_HOTEL_RESERVATIONS } }).select('hotel'), (reservation) => activeReservationHotels.add(sid(reservation.hotel)), metrics, batchSize);

  const categories = Object.fromEntries([
    'INDEPENDENT_CLEAN', 'ORGANIZATION_CLEAN', 'HYBRID_OWNER', 'HOTEL_TENANT_NULL',
    'HOTEL_MANAGER_TENANT_CONTRADICTION', 'PROPERTY_OTHER_TENANT_CONFLICT', 'LEGACY_FOUNDER',
    'EX_OPERATOR_PROVENANCE_ONLY', 'MULTIPLE_OWNER_ORGANIZATIONS', 'OWNERSHIP_AMBIGUOUS',
    'ACTIVE_RESERVATION_BLOCKER', 'HISTORICAL_ONLY',
  ].map((key) => [key, []]));

  for (const [ownerId, properties] of propertiesByOwner) {
    const ownerTenants = ownedTenants.get(ownerId) || [];
    const ownerTenantIds = new Set(ownerTenants.map((tenant) => sid(tenant._id)));
    const active = properties.filter((property) => !TERMINAL_PROPERTY_CYCLES.has(property.assetCycle) && !TERMINAL_PROPERTY_AVAILABILITY.has(property.availability));
    const nullActive = active.filter((property) => !property.tenant);
    const historical = properties.filter((property) => !active.includes(property));
    const conflicts = active.filter((property) => property.tenant && !ownerTenantIds.has(sid(property.tenant)));
    if (ownerTenants.length > 1) categories.MULTIPLE_OWNER_ORGANIZATIONS.push({ ownerId, tenantIds: [...ownerTenantIds] });
    if (!ownerTenants.length && nullActive.length) categories.INDEPENDENT_CLEAN.push({ ownerId, propertyIds: nullActive.map((item) => sid(item._id)) });
    if (ownerTenants.length === 1 && nullActive.length) categories.HYBRID_OWNER.push({ ownerId, propertyIds: nullActive.map((item) => sid(item._id)), tenantId: [...ownerTenantIds][0] });
    if (ownerTenants.length === 1 && !nullActive.length && !conflicts.length) categories.ORGANIZATION_CLEAN.push({ ownerId, tenantId: [...ownerTenantIds][0] });
    if (conflicts.length) categories.PROPERTY_OTHER_TENANT_CONFLICT.push({ ownerId, propertyIds: conflicts.map((item) => sid(item._id)) });
    if (historical.length === properties.length) categories.HISTORICAL_ONLY.push({ ownerId, propertyIds: historical.map((item) => sid(item._id)) });
  }
  for (const hotel of hotels) {
    const hotelId = sid(hotel._id); const tenantId = sid(hotel.tenant); const managerId = sid(hotel.manager);
    if (!tenantId) categories.HOTEL_TENANT_NULL.push({ hotelId });
    const managerTenantIds = new Set((membershipsByUser.get(managerId) || []).map((membership) => tenants.get(sid(membership.orgUnit))).filter(Boolean).map((tenant) => sid(tenant._id)));
    if (tenantId && managerTenantIds.size && !managerTenantIds.has(tenantId)) categories.HOTEL_MANAGER_TENANT_CONTRADICTION.push({ hotelId, tenantId, managerTenantIds: [...managerTenantIds] });
    if (activeReservationHotels.has(hotelId)) categories.ACTIVE_RESERVATION_BLOCKER.push({ hotelId, tenantId });
  }
  for (const tenant of tenants.values()) {
    const creatorId = sid(tenant.createdBy);
    const isOwner = (ownedTenants.get(creatorId) || []).some((owned) => sid(owned._id) === sid(tenant._id));
    if (!isOwner) categories.LEGACY_FOUNDER.push({ tenantId: sid(tenant._id), creatorId });
    if (!isOwner && operatorStatus.get(creatorId) && operatorStatus.get(creatorId) !== 'active') categories.EX_OPERATOR_PROVENANCE_ONLY.push({ tenantId: sid(tenant._id), creatorId });
  }
  categories.OWNERSHIP_AMBIGUOUS.push(...categories.HOTEL_TENANT_NULL.map((item) => ({ resourceType: 'Hotel', resourceId: item.hotelId })));
  return { readOnly: true, categories, counts: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, value.length])), metrics: { ...metrics, durationMs: Date.now() - startedAt } };
}

module.exports = { discoverOrganizationAssetInvariants, ACTIVE_HOTEL_RESERVATIONS };
