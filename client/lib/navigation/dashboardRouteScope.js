export const DASHBOARD_SCOPE = Object.freeze({
  GLOBAL_FIRST: 'GLOBAL_FIRST', TENANT_ONLY: 'TENANT_ONLY',
  PLATFORM_ONLY: 'PLATFORM_ONLY',
});

const CORE_ADMINISTRATION_REQUIREMENTS = Object.freeze([
  ['/dashboard/properties', 'platform.properties.read'],
  ['/dashboard/sales', 'platform.properties.read'],
  ['/dashboard/rentals', 'platform.properties.read'],
]);

const HOME_ADMINISTRATION_REQUIREMENT = Object.freeze({
  kind: 'administration',
  platform: Object.freeze({ capability: 'platform.reporting.read' }),
  tenant: Object.freeze({ allowed: true }),
});

export const dashboardRequirementForRoute = (pathname = '') => {
  if (pathname === '/dashboard') return HOME_ADMINISTRATION_REQUIREMENT;
  const core = CORE_ADMINISTRATION_REQUIREMENTS.find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (core) {
    return {
      kind: 'administration',
      platform: { capability: core[1] },
      tenant: { allowed: true },
    };
  }
  const legacyScope = dashboardScopeForRoute(pathname);
  if (legacyScope === DASHBOARD_SCOPE.PLATFORM_ONLY) return { kind: 'specialized-platform' };
  if (legacyScope === DASHBOARD_SCOPE.GLOBAL_FIRST) return { kind: 'legacy-global-first' };
  return { kind: 'tenant-only' };
};

const DASHBOARD_ROUTE_SCOPES = Object.freeze([
  ['/dashboard/properties', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/sales', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/rentals', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/hebergements', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/etablissements', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/hotel-reservations', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/visites', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/remboursements-hebergements', DASHBOARD_SCOPE.GLOBAL_FIRST],
  ['/dashboard/moderation', DASHBOARD_SCOPE.PLATFORM_ONLY],
  ['/dashboard/messages', DASHBOARD_SCOPE.PLATFORM_ONLY],
  ['/dashboard/contact-messages', DASHBOARD_SCOPE.PLATFORM_ONLY],
  ['/dashboard/conversations', DASHBOARD_SCOPE.PLATFORM_ONLY],
  ['/dashboard/users', DASHBOARD_SCOPE.PLATFORM_ONLY],
  ['/dashboard/activations-professionnelles', DASHBOARD_SCOPE.PLATFORM_ONLY],
]);

export const dashboardScopeForRoute = (pathname = '') => (
  DASHBOARD_ROUTE_SCOPES.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1]
  || DASHBOARD_SCOPE.TENANT_ONLY
);

export const isPlatformScopedDashboardRoute = (pathname = '') => (
  dashboardRequirementForRoute(pathname).kind === 'administration'
  || [DASHBOARD_SCOPE.GLOBAL_FIRST, DASHBOARD_SCOPE.PLATFORM_ONLY].includes(dashboardScopeForRoute(pathname))
);
