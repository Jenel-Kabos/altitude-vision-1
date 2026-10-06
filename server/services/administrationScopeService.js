const {
  PLATFORM_WIDE_CONTEXT_SOURCE,
} = require('../constants/platformOperatorConstants');

const ADMINISTRATION_SCOPE_MODE = Object.freeze({
  PLATFORM: 'platform',
  TENANT: 'tenant',
  UNRESOLVED: 'unresolved',
});

function tenantIdOf(value) {
  if (!value) return null;
  const candidate = value._id ?? value;
  return candidate == null ? null : String(candidate);
}

function deriveAdministrationScope(req = {}) {
  const source = req.tenantContextSource ?? null;
  const tenantId = tenantIdOf(req.platformTenant);

  if (source === PLATFORM_WIDE_CONTEXT_SOURCE && !tenantId) {
    return Object.freeze({
      mode: ADMINISTRATION_SCOPE_MODE.PLATFORM,
      tenantId: null,
      source,
    });
  }

  if (tenantId) {
    return Object.freeze({
      mode: ADMINISTRATION_SCOPE_MODE.TENANT,
      tenantId,
      source,
    });
  }

  return Object.freeze({
    mode: ADMINISTRATION_SCOPE_MODE.UNRESOLVED,
    tenantId: null,
    source,
  });
}

function administrationScopeError() {
  const error = new Error("Accès refusé : aucun contexte d'administration résolu.");
  error.name = 'AdministrationScopeError';
  error.code = 'ADMINISTRATION_SCOPE_REQUIRED';
  error.statusCode = 403;
  return error;
}

function requireResolvedAdministrationScope(req, res, next) {
  const scope = req.adminScope || deriveAdministrationScope(req);
  req.adminScope = scope;
  if (scope.mode === ADMINISTRATION_SCOPE_MODE.UNRESOLVED) {
    res.status(403);
    return next(administrationScopeError());
  }
  return next();
}

function propertyScopeFilter(scope) {
  if (scope?.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) return {};
  if (scope?.mode === ADMINISTRATION_SCOPE_MODE.TENANT && scope.tenantId) {
    return { tenant: String(scope.tenantId) };
  }
  throw administrationScopeError();
}

const accommodationScopeFilter = propertyScopeFilter;
const hotelScopeFilter = propertyScopeFilter;

function propertyScopeForbiddenError() {
  const error = new Error("Accès refusé : le bien n'appartient pas au tenant administré.");
  error.name = 'AdministrationScopeError';
  error.code = 'PROPERTY_SCOPE_FORBIDDEN';
  error.statusCode = 403;
  return error;
}

function assertPropertyInAdministrationScope(scope, property) {
  if (!property) throw propertyScopeForbiddenError();
  if (scope?.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) return true;
  if (scope?.mode !== ADMINISTRATION_SCOPE_MODE.TENANT || !scope.tenantId) {
    throw administrationScopeError();
  }
  if (tenantIdOf(property.tenant) !== String(scope.tenantId)) {
    throw propertyScopeForbiddenError();
  }
  return true;
}

function resourceScopeForbiddenError(domain) {
  const error = new Error(`Accès refusé : la ressource ${domain} n'appartient pas au tenant administré.`);
  error.name = 'AdministrationScopeError';
  error.code = `${domain.toUpperCase()}_SCOPE_FORBIDDEN`;
  error.statusCode = domain === 'hotel' ? 404 : 403;
  return error;
}

function assertDirectTenantResourceInAdministrationScope(scope, resource, domain) {
  if (!resource) throw resourceScopeForbiddenError(domain);
  if (scope?.mode === ADMINISTRATION_SCOPE_MODE.PLATFORM) return true;
  if (scope?.mode !== ADMINISTRATION_SCOPE_MODE.TENANT || !scope.tenantId) {
    throw administrationScopeError();
  }
  if (tenantIdOf(resource.tenant) !== String(scope.tenantId)) {
    throw resourceScopeForbiddenError(domain);
  }
  return true;
}

const assertAccommodationInAdministrationScope = (scope, resource) => (
  assertDirectTenantResourceInAdministrationScope(scope, resource, 'accommodation')
);
const assertHotelInAdministrationScope = (scope, resource) => (
  assertDirectTenantResourceInAdministrationScope(scope, resource, 'hotel')
);

module.exports = {
  ADMINISTRATION_SCOPE_MODE,
  deriveAdministrationScope,
  requireResolvedAdministrationScope,
  propertyScopeFilter,
  assertPropertyInAdministrationScope,
  accommodationScopeFilter,
  hotelScopeFilter,
  assertAccommodationInAdministrationScope,
  assertHotelInAdministrationScope,
};
