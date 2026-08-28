# ARCH-2M — Analyse des deux edges

## Edge A — Accommodation

- **Source / target / symbole :** `services/reporting/domains/accommodationReport.js` → `controllers/dashboardAnalyticsController.js`, import destructuré `accommodations`.
- **Purpose :** produire les KPI consolidés des hébergements indépendants ; le DomainReport ajoute séparément la durée moyenne de séjour.
- **Runtime : LIVE.** Appelée par `getAccommodationReport`, par `getModuleAnalytics`, par les routes Reporting montées et `/api/dashboard-analytics/accommodations`; consommateurs Web confirmés.
- **Nature :** agrégation/query async avec I/O Mongo. Aucun objet Express, aucun `req`, `res`, `next`, status, header ou sérialisation HTTP.
- **Queries/models :** `Accommodation.find().distinct`, `Accommodation.aggregate` avec `$lookup` Property, `AccommodationReservation.aggregate`, deux `AccommodationNightLock.countDocuments`, puis `FinancialDocument`, `PaymentAllocation` et `FinancialRefund.aggregate`.
- **Read/write :** lecture seule. Aucun `save`, `create`, update, delete, bulk write ou transaction.
- **Scope :** `accommodationId` optionnel et `tenantId` optionnel. La fonction applique les paramètres reçus ; ownership et same-tenant sont contrôlés par le handler Dashboard avant l'appel. Reporting transmet `tenantId` et marque le domaine `orgScopeSupported:false`.
- **Cross-domain :** 3+ (Accommodation, Property, Finance, Reporting).
- **Side effects :** aucun hors lectures Mongo.
- **Finance :** HIGH, car documents, allocations, remboursements et soldes sont agrégés, sans écriture.
- **Duplication/source de vérité :** LOW ; le même symbole est partagé, le DomainReport ajoute seulement `averageStayLength`. Pas de seconde implémentation exacte.
- **Owner existant :** aucun owner canonique complet. Les services accommodation actuels traitent publication/payload mobile, pas les KPI. Les services finance possèdent les primitives financières, pas cette agrégation multi-domaines.
- **Option théorique :** `accommodationReportQueryService`, responsabilité étroite descriptible en une phrase. Nouvelle abstraction requise ; cohésion MEDIUM-HIGH, risque de God Service MEDIUM, blast radius HIGH.

## Edge B — Hotel

- **Source / target / symbole :** `services/reporting/domains/hotelReport.js` → `controllers/dashboardAnalyticsController.js`, import destructuré `hotels`.
- **Purpose :** produire occupation/chambres/réservations/opérations et soldes consolidés ; le DomainReport combine ensuite ce résultat avec le dashboard financier période-aware.
- **Runtime : LIVE.** Appelée par `getHotelReport`, par `getModuleAnalytics`, par Reporting, le Web et le cockpit mobile.
- **Nature :** `SECURITY_SCOPE` puis agrégation/query async. Aucun objet Express, mais l'acteur métier influence directement le scope et peut provoquer une erreur 403.
- **Queries/models directs :** Hotel (find/populate Property), Room, HotelReservation, HousekeepingTask, MaintenanceTicket, PaymentAllocation, FinancialRefund et FinancialDocument.
- **Services transitifs :** `hotelAccessScopeService.listAccessibleHotels`, qui lit Hotel et HotelStaffAssignment et applique tenant/manager/createdBy/assignments. Le DomainReport appelle en parallèle `hotelFinancialDashboardService` et son autorisation financière.
- **Read/write :** lecture seule.
- **Scope :** tenant de l'acteur, rôle Admin, rattachements hôtel/manager legacy, `requestedHotelId`, publication, Property validée/disponible, hôtel actif. Le DomainReport appelle actuellement `hotels(user)` sans transmettre son `hotelId` : l'occupation reste globale tandis que la finance peut être scopée ; RevPAR/ADR sont alors explicitement `null`.
- **Cross-domain :** 3+ (Hotel, Property, Finance, Reporting, IAM).
- **Side effects :** aucun hors lectures Mongo.
- **Finance :** CRITICAL au niveau du flux complet (query KPI HIGH seule), car occupation et montants sont combinés à un dashboard financier riche.
- **Duplication/source de vérité :** LOW ; aucune seconde query exacte. Il existe toutefois deux scopes voisins (occupation et finance) dont une extraction mal conçue pourrait accroître le drift.
- **Owner existant :** owners partiels cohérents (`hotelAccessScopeService`, `hotelFinancialDashboardService`), aucun owner canonique de l'agrégat d'occupation.
- **Option théorique :** un `hotelOccupancyReportQueryService` étroit, sans absorber IAM ni finance. Nouvelle abstraction requise ; cohésion MEDIUM, risque de God Service HIGH, blast radius CRITICAL.

## Finding de sécurité distinct

FACT : `dashboardAnalyticsRoutes.js` monte `protect` seulement. `protect` charge `req.user` mais ne résout aucun tenant. Le handler lit pourtant `req.user.platformTenant`; pour un Admin sans enrichissement, `hotels` n'établit pas `scopedIds` et `accommodations` reçoit `tenantId=null`. La route est montée et consommée.

INFERENCE : un Admin tenant ordinaire peut recevoir des agrégats inter-tenant, y compris financiers. Cette dérive n'est pas causée par l'import service→controller et ne doit pas être corrigée par une extraction.

NON CONFIRMÉ : exploitation adversariale HTTP sur une base à deux tenants et payload exact observé. Aucun nouveau test métier n'est autorisé dans ARCH-2M.
