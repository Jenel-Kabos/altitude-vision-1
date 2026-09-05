const PLATFORM_SCOPED_DASHBOARD_ROUTES = new Set([
  '/dashboard/activations-professionnelles',
  '/dashboard/moderation/hotellerie',
]);

export const isPlatformScopedDashboardRoute = (pathname = '') => (
  [...PLATFORM_SCOPED_DASHBOARD_ROUTES].some((route) => pathname === route || pathname.startsWith(`${route}/`))
);
