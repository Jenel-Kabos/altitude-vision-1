export const DASHBOARD_SCOPE = Object.freeze({
  GLOBAL_FIRST: 'GLOBAL_FIRST', TENANT_ONLY: 'TENANT_ONLY',
  PLATFORM_ONLY: 'PLATFORM_ONLY',
});

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
  [DASHBOARD_SCOPE.GLOBAL_FIRST, DASHBOARD_SCOPE.PLATFORM_ONLY].includes(dashboardScopeForRoute(pathname))
);
