# ARCH-2J — Analyse de la candidate

Le symbole `sales` était un helper pur historiquement placé dans `dashboardAnalyticsController`, pas un handler Express. Il recevait uniquement `{ scopeUserIds = null }`, lisait Property, Visite et Transaction, puis retournait `{ kpis, recent }`.

Responsabilité : construire les données read-only du rapport immobilier de vente. Le scope organisationnel est calculé en amont par `reportingService.resolveOrgScope`; le helper ne décide ni tenant, ni rôle, ni PlatformOperator. Il applique seulement les owner IDs reçus. L'endpoint dashboard continue de contrôler `ROLES_ALTIMMO` dans le controller et appelle la query sans scope, comme avant.

Extraction jugée sûre : owner canonique `reporting/immobilierReportQueryService.js`, API explicite `getImmobilierReportData({ scopeUserIds })`. Le controller et le DomainReport utilisent la même source. `dashboardKpiQueryService` et `propertyAssetPortfolioService` ont été refusés : leurs responsabilités diffèrent.
