# Matrice des endpoints Dashboard Analytics

Montage prouvé dans `server/server.js` : `app.use('/api/dashboard-analytics', dashboardAnalyticsRoutes)`. Aucun middleware tenant parent n'est monté sur ce préfixe.

| Endpoint | Method | Mounted | Auth | Roles effectifs | Tenant resolver après fix | Handler |
|---|---|---|---|---|---|---|
| `/api/dashboard-analytics/sales` | GET | Oui | `auth.protect` | `ROLES_ALTIMMO` | `requireTenantScopeForAnalytics` | `getModuleAnalytics` → `getImmobilierReportData` |
| `/api/dashboard-analytics/rentals` | GET | Oui | `auth.protect` | `ROLES_GL` | `requireTenantScopeForAnalytics` | `getModuleAnalytics` → `getRentalReportData` |
| `/api/dashboard-analytics/accommodations` | GET | Oui | `auth.protect` | `ROLES_ALTIMMO` + `Proprietaire` | `requireTenantScopeForAnalytics` | `getModuleAnalytics` → `accommodations` |
| `/api/dashboard-analytics/hotels` | GET | Oui | `auth.protect` | `ROLES_ALTIMMO` + `Proprietaire` | `requireTenantScopeForAnalytics` | `getModuleAnalytics` → `hotels` |

Le routeur ne possède qu'une route regex `/:module(sales|rentals|accommodations|hotels)` : quatre endpoints vivants, aucun endpoint-level middleware supplémentaire. Le contrôle de rôle existant demeure dans le contrôleur ; aucun rôle ni contrat de payload n'a été changé.
