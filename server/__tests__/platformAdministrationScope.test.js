const {
  ADMINISTRATION_SCOPE_MODE,
  deriveAdministrationScope,
  propertyScopeFilter,
  assertPropertyInAdministrationScope,
  accommodationScopeFilter,
  hotelScopeFilter,
  assertAccommodationInAdministrationScope,
  assertHotelInAdministrationScope,
  requireResolvedAdministrationScope,
} = require('../services/administrationScopeService');

describe('PA-04B canonical administration scope', () => {
  test('derives platform scope only from the canonical eligible unscoped source', () => {
    expect(deriveAdministrationScope({
      tenantContextSource: 'platform_operator_unscoped',
      platformTenant: null,
    })).toEqual({
      mode: ADMINISTRATION_SCOPE_MODE.PLATFORM,
      tenantId: null,
      source: 'platform_operator_unscoped',
    });
  });

  test.each([
    ['forbidden partial operator', 'platform_operator_platform_view_forbidden'],
    ['invalid operator tenant selection', 'platform_operator_tenant_not_found'],
    ['missing context', null],
  ])('fails closed for %s', (_label, source) => {
    expect(deriveAdministrationScope({
      tenantContextSource: source,
      platformTenant: null,
      query: { platformScoped: 'true' },
      body: { platformScoped: true },
      isPlatformOperatorContext: true,
    })).toEqual({
      mode: ADMINISTRATION_SCOPE_MODE.UNRESOLVED,
      tenantId: null,
      source,
    });
  });

  test.each([
    'platform_operator_selection',
    'explicit_membership',
    'single_membership',
    'legacy_fallback',
  ])('derives tenant scope from a canonically resolved tenant (%s)', (source) => {
    expect(deriveAdministrationScope({
      tenantContextSource: source,
      platformTenant: { _id: 'tenant-a' },
    })).toEqual({
      mode: ADMINISTRATION_SCOPE_MODE.TENANT,
      tenantId: 'tenant-a',
      source,
    });
  });

  test('does not allow forged request flags to manufacture platform scope', () => {
    expect(deriveAdministrationScope({
      platformTenant: null,
      tenantContextSource: 'single_membership',
      isPlatformView: true,
      isPlatformOperatorContext: true,
      query: { platformScoped: 'true' },
      body: { scope: 'platform' },
    }).mode).toBe(ADMINISTRATION_SCOPE_MODE.UNRESOLVED);
  });

  test('returns immutable scope data', () => {
    const scope = deriveAdministrationScope({
      tenantContextSource: 'single_membership',
      platformTenant: { _id: 'tenant-a' },
    });
    expect(Object.isFrozen(scope)).toBe(true);
  });

  test('resolved-scope middleware refuses unresolved normal administration', () => {
    const req = { adminScope: Object.freeze({ mode: 'unresolved', tenantId: null, source: null }) };
    const res = { status: jest.fn().mockReturnThis() };
    const next = jest.fn();
    requireResolvedAdministrationScope(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ADMINISTRATION_SCOPE_REQUIRED',
      statusCode: 403,
    }));
  });

  test.each(['platform', 'tenant'])('resolved-scope middleware allows %s administration', (mode) => {
    const req = { adminScope: Object.freeze({ mode, tenantId: mode === 'tenant' ? 'tenant-a' : null, source: 'canonical' }) };
    const res = { status: jest.fn().mockReturnThis() };
    const next = jest.fn();
    requireResolvedAdministrationScope(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test('builds Property filters that preserve tenant:null only in platform scope', () => {
    expect(propertyScopeFilter({ mode: 'platform', tenantId: null })).toEqual({});
    expect(propertyScopeFilter({ mode: 'tenant', tenantId: 'tenant-a' })).toEqual({ tenant: 'tenant-a' });
    expect(() => propertyScopeFilter({ mode: 'unresolved', tenantId: null })).toThrow(
      expect.objectContaining({ code: 'ADMINISTRATION_SCOPE_REQUIRED', statusCode: 403 }),
    );
  });

  test('accepts every Property provenance in platform scope', () => {
    expect(assertPropertyInAdministrationScope(
      { mode: 'platform', tenantId: null },
      { _id: 'property-a', tenant: 'tenant-a' },
    )).toBe(true);
    expect(assertPropertyInAdministrationScope(
      { mode: 'platform', tenantId: null },
      { _id: 'property-null', tenant: null },
    )).toBe(true);
  });

  test.each([
    [{ _id: 'property-b', tenant: 'tenant-b' }, 'cross-tenant'],
    [{ _id: 'property-null', tenant: null }, 'tenant:null'],
  ])('rejects %s Property access from Tenant A', (property) => {
    expect(() => assertPropertyInAdministrationScope(
      { mode: 'tenant', tenantId: 'tenant-a' },
      property,
    )).toThrow(expect.objectContaining({ code: 'PROPERTY_SCOPE_FORBIDDEN', statusCode: 403 }));
  });

  test('accepts only the exact Property tenant in tenant scope', () => {
    expect(assertPropertyInAdministrationScope(
      { mode: 'tenant', tenantId: 'tenant-a' },
      { _id: 'property-a', tenant: { _id: 'tenant-a' } },
    )).toBe(true);
  });

  test.each([
    ['Accommodation', accommodationScopeFilter],
    ['Hotel', hotelScopeFilter],
  ])('%s filter is global only for explicit platform scope', (_domain, filter) => {
    expect(filter({ mode: 'platform', tenantId: null })).toEqual({});
    expect(filter({ mode: 'tenant', tenantId: 'tenant-a' })).toEqual({ tenant: 'tenant-a' });
    expect(() => filter({ mode: 'unresolved', tenantId: null })).toThrow(
      expect.objectContaining({ code: 'ADMINISTRATION_SCOPE_REQUIRED', statusCode: 403 }),
    );
  });

  test.each([
    ['Accommodation', assertAccommodationInAdministrationScope, 403],
    ['Hotel', assertHotelInAdministrationScope, 404],
  ])('%s administration uses only direct tenant provenance', (_domain, assertInScope, hiddenStatus) => {
    expect(assertInScope(
      { mode: 'platform', tenantId: null },
      { _id: 'resource-null', tenant: null, owner: 'owner-a', manager: 'manager-a', createdBy: 'creator-a' },
    )).toBe(true);
    expect(assertInScope(
      { mode: 'tenant', tenantId: 'tenant-a' },
      { _id: 'resource-a', tenant: { _id: 'tenant-a' } },
    )).toBe(true);
    expect(() => assertInScope(
      { mode: 'tenant', tenantId: 'tenant-a' },
      { _id: 'resource-null', tenant: null, owner: 'owner-a', manager: 'manager-a', createdBy: 'creator-a' },
    )).toThrow(expect.objectContaining({ statusCode: hiddenStatus }));
    expect(() => assertInScope(
      { mode: 'tenant', tenantId: 'tenant-a' },
      { _id: 'resource-b', tenant: 'tenant-b' },
    )).toThrow(expect.objectContaining({ statusCode: hiddenStatus }));
  });
});
