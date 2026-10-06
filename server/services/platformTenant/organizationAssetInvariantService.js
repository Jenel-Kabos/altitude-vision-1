const ASSET_CLASSIFICATION = Object.freeze({
  ELIGIBLE_ACTIVE_ASSET: 'ELIGIBLE_ACTIVE_ASSET',
  HISTORICAL_KEEP: 'HISTORICAL_KEEP',
  OTHER_TENANT_CONFLICT: 'OTHER_TENANT_CONFLICT',
  OWNERSHIP_AMBIGUOUS: 'OWNERSHIP_AMBIGUOUS',
  ACTIVE_WORKFLOW_BLOCKER: 'ACTIVE_WORKFLOW_BLOCKER',
  PERSONAL_OR_UNCLASSIFIED: 'PERSONAL_OR_UNCLASSIFIED',
  ALREADY_IN_TARGET: 'ALREADY_IN_TARGET',
});

const OWNER_ORGANIZATIONAL_STATE = Object.freeze({
  INDEPENDENT: 'INDEPENDENT',
  ORGANIZATION_OWNER: 'ORGANIZATION_OWNER',
  AMBIGUOUS: 'AMBIGUOUS',
});

const OWNER_ASSET_CONSISTENCY = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  CONSISTENT: 'CONSISTENT',
  INCONSISTENT: 'OWNER_ORGANIZATIONAL_STATE_INCONSISTENT',
  CROSS_TENANT_CONFLICT: 'OWNER_ORGANIZATION_ASSET_CONFLICT',
  AMBIGUOUS: 'OWNER_ORGANIZATION_AMBIGUOUS',
});

const id = (value) => value?._id ? String(value._id) : value == null ? null : String(value);

function classifyOrganizationAsset({ property, ownerId, targetTenantId, activeWorkflow = false } = {}) {
  if (!property || !ownerId || id(property.owner) !== id(ownerId)) {
    return { classification: ASSET_CLASSIFICATION.OWNERSHIP_AMBIGUOUS, migratable: false };
  }
  const tenantId = id(property.tenant);
  if (tenantId && tenantId !== id(targetTenantId)) {
    return { classification: ASSET_CLASSIFICATION.OTHER_TENANT_CONFLICT, migratable: false };
  }
  if (tenantId === id(targetTenantId)) {
    return { classification: ASSET_CLASSIFICATION.ALREADY_IN_TARGET, migratable: false };
  }
  const historical = ['vendu', 'archive'].includes(property.assetCycle)
    || ['Vendu', 'Retiré'].includes(property.availability);
  if (historical) return { classification: ASSET_CLASSIFICATION.HISTORICAL_KEEP, migratable: false };
  if (activeWorkflow) return { classification: ASSET_CLASSIFICATION.ACTIVE_WORKFLOW_BLOCKER, migratable: false };
  if (property.pole !== 'Altimmo' || !['vente', 'location', 'hebergement'].includes(property.status)) {
    return { classification: ASSET_CLASSIFICATION.PERSONAL_OR_UNCLASSIFIED, migratable: false };
  }
  return { classification: ASSET_CLASSIFICATION.ELIGIBLE_ACTIVE_ASSET, migratable: true };
}

class OwnerOrganizationalStateError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'OwnerOrganizationalStateError';
    this.code = code;
    this.statusCode = 409;
    this.details = details;
  }
}

async function resolveOwnerOrganizationalState(ownerId, { session = null, models = {} } = {}) {
  const OrgMembership = models.OrgMembership || require('../../models/OrgMembership');
  const PlatformTenant = models.PlatformTenant || require('../../models/PlatformTenant');
  const memberships = await OrgMembership.find({ user: ownerId, roleInUnit: 'owner', status: 'active' })
    .select('_id orgUnit businessRole').session(session).lean();
  if (!memberships.length) return { state: OWNER_ORGANIZATIONAL_STATE.INDEPENDENT, tenantId: null, reason: 'NO_CANONICAL_OWNER_MEMBERSHIP' };
  if (memberships.length !== 1 || memberships[0].businessRole !== 'Admin') {
    return { state: OWNER_ORGANIZATIONAL_STATE.AMBIGUOUS, tenantId: null, reason: 'OWNER_MEMBERSHIP_AMBIGUOUS' };
  }
  const tenants = await PlatformTenant.find({
    rootOrgUnit: memberships[0].orgUnit,
    status: { $in: ['trial', 'active'] },
  }).select('_id').session(session).lean();
  if (tenants.length !== 1) return { state: OWNER_ORGANIZATIONAL_STATE.AMBIGUOUS, tenantId: null, reason: 'OWNER_TENANT_UNRESOLVED' };
  return {
    state: OWNER_ORGANIZATIONAL_STATE.ORGANIZATION_OWNER,
    tenantId: id(tenants[0]._id),
    membershipId: id(memberships[0]._id),
    reason: 'CANONICAL_OWNER_ORGANIZATION',
  };
}

async function inspectOwnerOrganizationalConsistency(ownerId, { session = null, models = {} } = {}) {
  const Property = models.Property || require('../../models/Property');
  const organizationalState = await resolveOwnerOrganizationalState(ownerId, { session, models });
  if (organizationalState.state === OWNER_ORGANIZATIONAL_STATE.INDEPENDENT) {
    return { ...organizationalState, consistency: OWNER_ASSET_CONSISTENCY.NOT_APPLICABLE, classifications: [] };
  }
  if (organizationalState.state === OWNER_ORGANIZATIONAL_STATE.AMBIGUOUS) {
    return { ...organizationalState, consistency: OWNER_ASSET_CONSISTENCY.AMBIGUOUS, classifications: [] };
  }
  const properties = await Property.find({ owner: ownerId })
    .select('_id owner tenant pole status availability assetCycle').session(session).lean();
  const classifications = properties.map((property) => ({
    propertyId: id(property._id),
    ...classifyOrganizationAsset({ property, ownerId, targetTenantId: organizationalState.tenantId }),
  }));
  const conflict = classifications.some(({ classification }) => classification === ASSET_CLASSIFICATION.OTHER_TENANT_CONFLICT);
  const inconsistent = classifications.some(({ classification }) => classification === ASSET_CLASSIFICATION.ELIGIBLE_ACTIVE_ASSET);
  return {
    ...organizationalState,
    consistency: conflict
      ? OWNER_ASSET_CONSISTENCY.CROSS_TENANT_CONFLICT
      : inconsistent ? OWNER_ASSET_CONSISTENCY.INCONSISTENT : OWNER_ASSET_CONSISTENCY.CONSISTENT,
    classifications,
  };
}

async function resolvePropertyCreationTenant({ ownerId, contextualTenantId = null, session = null, models = {} }) {
  const inspection = await inspectOwnerOrganizationalConsistency(ownerId, { session, models });
  if (inspection.state === OWNER_ORGANIZATIONAL_STATE.AMBIGUOUS) {
    throw new OwnerOrganizationalStateError('OWNER_ORGANIZATION_AMBIGUOUS', 'Plusieurs organisations propriétaires nécessitent une sélection explicite.');
  }
  if (inspection.state === OWNER_ORGANIZATIONAL_STATE.INDEPENDENT) return contextualTenantId || null;
  if (contextualTenantId && id(contextualTenantId) !== inspection.tenantId) {
    throw new OwnerOrganizationalStateError('OWNER_ORGANIZATION_TENANT_CONFLICT', 'Le contexte tenant ne correspond pas à l’organisation canonique du propriétaire.');
  }
  if (inspection.consistency === OWNER_ASSET_CONSISTENCY.CROSS_TENANT_CONFLICT) {
    throw new OwnerOrganizationalStateError('OWNER_ORGANIZATION_ASSET_CONFLICT', 'Un bien appartient déjà à un autre tenant.', inspection.classifications);
  }
  if (inspection.consistency === OWNER_ASSET_CONSISTENCY.INCONSISTENT) {
    throw new OwnerOrganizationalStateError('OWNER_ORGANIZATIONAL_STATE_INCONSISTENT', 'Le patrimoine actif contient encore des biens sans organisation.', inspection.classifications);
  }
  return inspection.tenantId;
}

module.exports = {
  ASSET_CLASSIFICATION,
  OWNER_ORGANIZATIONAL_STATE,
  OWNER_ASSET_CONSISTENCY,
  OwnerOrganizationalStateError,
  classifyOrganizationAsset,
  resolveOwnerOrganizationalState,
  inspectOwnerOrganizationalConsistency,
  resolvePropertyCreationTenant,
};
