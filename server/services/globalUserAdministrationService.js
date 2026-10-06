const mongoose = require('mongoose');
const User = require('../models/User');
const OrgMembership = require('../models/OrgMembership');

// C2.9 (Users) — appartenance organisationnelle canonique = OrgMembership ACTIVE
// (même règle que tenantContextService.resolveAvailableTenantsForUser). Une
// membership suspendue ou révoquée ne rattache plus le User à une organisation.
async function activeMemberUserIds() {
  return OrgMembership.distinct('user', { status: 'active' });
}
const OrgUnit = require('../models/OrgUnit');
const PlatformTenant = require('../models/PlatformTenant');
const PlatformOperator = require('../models/PlatformOperator');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const USER_FIELDS = '_id name email phone photo avatar role status isActive isEmailVerified isVerified createdAt updatedAt lastLoginAt lastActivityAt';
const userEnumValues = (field) => new Set(User.schema?.path?.(field)?.enumValues || []);
const SORTS = Object.freeze({
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name: { name: 1, _id: 1 },
  status: { status: 1, name: 1, _id: 1 },
});

class GlobalUserAdministrationError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'GlobalUserAdministrationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode = 400) => {
  throw new GlobalUserAdministrationError(code, message, statusCode);
};

const parsePositiveInt = (value, fallback, { max = Number.MAX_SAFE_INTEGER, field }) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    fail('GLOBAL_USERS_QUERY_INVALID', `${field} invalide.`);
  }
  return parsed;
};

const parseBoolean = (value, field) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  fail('GLOBAL_USERS_QUERY_INVALID', `${field} doit valoir true ou false.`);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const addIdIntersection = (filter, ids) => {
  const normalized = [...new Set(ids.map(String))].map((id) => new mongoose.Types.ObjectId(id));
  if (!filter.$and) filter.$and = [];
  filter.$and.push({ _id: { $in: normalized } });
};

async function buildUserFilter(query = {}) {
  const filter = { isTechnical: { $ne: true } };
  const search = String(query.search || '').trim().slice(0, 200);
  if (search) {
    const literal = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: literal }, { email: literal }, { phone: literal }];
  }
  if (query.status !== undefined) {
    if (!userEnumValues('status').has(query.status)) fail('GLOBAL_USERS_STATUS_INVALID', 'Statut utilisateur invalide.');
    filter.status = query.status;
  }
  const active = parseBoolean(query.active, 'active');
  if (active !== undefined) filter.isActive = active;
  if (query.role !== undefined) {
    if (!userEnumValues('role').has(query.role)) fail('GLOBAL_USERS_ROLE_INVALID', 'Rôle utilisateur invalide.');
    filter.role = query.role;
  }

  if (query.organization !== undefined) {
    if (!['with', 'without'].includes(query.organization)) fail('GLOBAL_USERS_ORGANIZATION_FILTER_INVALID', 'Filtre organisation invalide.');
    const memberIds = await activeMemberUserIds();
    if (query.organization === 'with') addIdIntersection(filter, memberIds);
    else filter._id = { $nin: memberIds };
  }

  if (query.tenantId !== undefined) {
    if (!mongoose.isValidObjectId(query.tenantId)) fail('GLOBAL_USERS_TENANT_ID_INVALID', 'Identifiant tenant invalide.');
    const tenant = await PlatformTenant.findById(query.tenantId).select('rootOrgUnit').lean();
    if (!tenant) fail('GLOBAL_USERS_TENANT_NOT_FOUND', 'Tenant introuvable.', 404);
    const orgUnitIds = await OrgUnit.find({
      $or: [{ _id: tenant.rootOrgUnit }, { ancestors: tenant.rootOrgUnit }],
    }).distinct('_id');
    const memberIds = await OrgMembership.distinct('user', { orgUnit: { $in: orgUnitIds } });
    addIdIntersection(filter, memberIds);
  }

  const operator = parseBoolean(query.operator, 'operator');
  if (operator !== undefined) {
    const operatorIds = await PlatformOperator.distinct('user');
    if (operator) addIdIntersection(filter, operatorIds);
    else {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ _id: { $nin: operatorIds } });
    }
  }
  return filter;
}

async function loadAdministrativeContext(userIds) {
  if (!userIds.length) return { membershipsByUser: new Map(), operatorsByUser: new Map() };
  const [memberships, operators] = await Promise.all([
    OrgMembership.find({ user: { $in: userIds } })
      .select('_id user orgUnit roleInUnit businessRole status grantedAt suspendedAt revokedAt')
      .lean(),
    PlatformOperator.find({ user: { $in: userIds } }).select('user status').lean(),
  ]);
  const orgUnitIds = [...new Set(memberships.map((item) => String(item.orgUnit)))];
  const orgUnits = orgUnitIds.length
    ? await OrgUnit.find({ _id: { $in: orgUnitIds } }).select('_id name type ancestors status').lean()
    : [];
  const orgUnitsById = new Map(orgUnits.map((unit) => [String(unit._id), unit]));
  const rootIds = [...new Set(orgUnits.map((unit) => String(unit.type === 'organization' ? unit._id : unit.ancestors?.[0])).filter(Boolean))];
  const tenants = rootIds.length
    ? await PlatformTenant.find({ rootOrgUnit: { $in: rootIds } }).select('_id name status rootOrgUnit').lean()
    : [];
  const tenantsByRoot = new Map(tenants.map((tenant) => [String(tenant.rootOrgUnit), tenant]));
  const membershipsByUser = new Map();

  memberships.forEach((membership) => {
    const unit = orgUnitsById.get(String(membership.orgUnit)) || null;
    const rootId = unit ? String(unit.type === 'organization' ? unit._id : unit.ancestors?.[0] || '') : '';
    const tenant = rootId ? tenantsByRoot.get(rootId) || null : null;
    const projected = {
      _id: membership._id,
      roleInUnit: membership.roleInUnit,
      businessRole: membership.businessRole,
      status: membership.status,
      grantedAt: membership.grantedAt || null,
      suspendedAt: membership.suspendedAt || null,
      revokedAt: membership.revokedAt || null,
      organization: unit ? { _id: unit._id, name: unit.name, type: unit.type, status: unit.status } : null,
      tenant: tenant ? { _id: tenant._id, name: tenant.name, status: tenant.status } : null,
    };
    const key = String(membership.user);
    if (!membershipsByUser.has(key)) membershipsByUser.set(key, []);
    membershipsByUser.get(key).push(projected);
  });
  const operatorsByUser = new Map(operators.map((operatorDoc) => [String(operatorDoc.user), {
    status: operatorDoc.status,
  }]));
  return { membershipsByUser, operatorsByUser };
}

const projectUser = (user, context) => {
  const key = String(user._id);
  const memberships = context.membershipsByUser.get(key) || [];
  const tenantCount = new Set(memberships.map((membership) => String(membership.tenant?._id || '')).filter(Boolean)).size;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    photo: user.photo || null,
    avatar: user.avatar || null,
    role: user.role,
    status: user.status,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
    lastActivityAt: user.lastActivityAt || null,
    memberships,
    tenantCount,
    platformOperator: context.operatorsByUser.get(key) || null,
  };
};

async function countWithoutOrganization(filter) {
  const memberIds = await activeMemberUserIds();
  return User.countDocuments({ $and: [filter, { _id: { $nin: memberIds } }] });
}

async function listGlobalUsers(query = {}) {
  const page = parsePositiveInt(query.page, 1, { field: 'page' });
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, { field: 'limit', max: MAX_LIMIT });
  const sortName = query.sort || 'newest';
  if (!SORTS[sortName]) fail('GLOBAL_USERS_SORT_INVALID', 'Tri utilisateur invalide.');
  const filter = await buildUserFilter(query);
  const [users, total, active, suspended, withoutOrganization] = await Promise.all([
    User.find(filter).select(USER_FIELDS).sort(SORTS[sortName]).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
    User.countDocuments({ $and: [filter, { isActive: true }] }),
    User.countDocuments({ $and: [filter, { status: 'Suspendu' }] }),
    countWithoutOrganization(filter),
  ]);
  const context = await loadAdministrativeContext(users.map((user) => user._id));
  return {
    items: users.map((user) => projectUser(user, context)),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    stats: { total, active, suspended, withoutOrganization },
  };
}

async function getGlobalUserDetail(userId) {
  if (!mongoose.isValidObjectId(userId)) fail('GLOBAL_USERS_USER_ID_INVALID', 'Identifiant utilisateur invalide.');
  const user = await User.findOne({ _id: userId, isTechnical: { $ne: true } }).select(USER_FIELDS).lean();
  if (!user) fail('GLOBAL_USERS_USER_NOT_FOUND', 'Utilisateur introuvable.', 404);
  const context = await loadAdministrativeContext([user._id]);
  return projectUser(user, context);
}

module.exports = {
  GlobalUserAdministrationError,
  listGlobalUsers,
  getGlobalUserDetail,
};
