const SORTS = Object.freeze({
  newest: '-createdAt -_id',
  oldest: 'createdAt _id',
  title: 'title _id',
  priceAsc: 'price _id',
  priceDesc: '-price _id',
  status: 'statusAdmin title _id',
});

const FILTER_KEYS = Object.freeze([
  'search',
  'offerType',
  'propertyType',
  'city',
  'arrondissement',
]);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class PropertyRegistryQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PropertyRegistryQueryError';
    this.code = 'PROPERTY_REGISTRY_QUERY_INVALID';
    this.statusCode = 400;
  }
}

function positiveInteger(value, fallback, { max = Number.MAX_SAFE_INTEGER, label }) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) {
    throw new PropertyRegistryQueryError(`${label} doit être un entier positif.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new PropertyRegistryQueryError(`${label} doit être compris entre 1 et ${max}.`);
  }
  return parsed;
}

function normalizePropertyRegistryQuery(rawQuery = {}) {
  const page = positiveInteger(rawQuery.page, DEFAULT_PAGE, { label: 'page' });
  const limit = positiveInteger(rawQuery.limit, DEFAULT_LIMIT, { max: MAX_LIMIT, label: 'limit' });
  const sortKey = rawQuery.sort || 'newest';
  if (!Object.prototype.hasOwnProperty.call(SORTS, sortKey)) {
    throw new PropertyRegistryQueryError('Tri du registre immobilier invalide.');
  }

  const query = { page, limit, sort: SORTS[sortKey] };
  FILTER_KEYS.forEach((key) => {
    if (typeof rawQuery[key] === 'string' && rawQuery[key].trim()) query[key] = rawQuery[key].trim();
  });

  return { query, page, limit, sortKey };
}

const referenceId = (value) => value?._id || value || null;

async function projectPropertyRegistryRows(properties = []) {
  const ownerIds = [...new Set(properties.map((property) => String(referenceId(property.owner) || '')).filter(Boolean))];
  const tenantIds = [...new Set(properties.map((property) => String(referenceId(property.tenant) || '')).filter(Boolean))];

  const [owners, tenants] = await Promise.all([
    ownerIds.length ? User.find({ _id: { $in: ownerIds } }).select('_id name').lean() : [],
    tenantIds.length ? PlatformTenant.find({ _id: { $in: tenantIds } }).select('_id name status').lean() : [],
  ]);
  const ownersById = new Map(owners.map((owner) => [String(owner._id), owner]));
  const tenantsById = new Map(tenants.map((tenant) => [String(tenant._id), tenant]));

  return properties.map((property) => {
    const plain = property.toObject ? property.toObject() : { ...property };
    const owner = ownersById.get(String(referenceId(property.owner))) || null;
    const tenant = tenantsById.get(String(referenceId(property.tenant))) || null;
    return {
      ...plain,
      owner: owner ? { _id: owner._id, name: owner.name } : null,
      tenant: tenant ? { _id: tenant._id, name: tenant.name, status: tenant.status } : null,
    };
  });
}

module.exports = {
  normalizePropertyRegistryQuery,
  projectPropertyRegistryRows,
  PropertyRegistryQueryError,
  PROPERTY_REGISTRY_SORTS: SORTS,
  PROPERTY_REGISTRY_MAX_LIMIT: MAX_LIMIT,
};
const User = require('../models/User');
const PlatformTenant = require('../models/PlatformTenant');
