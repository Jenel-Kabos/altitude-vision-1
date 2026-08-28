# ARCH-2K — Analyse des trois edges

## 1. Accommodation

**Trace factuelle :** `getAccommodationReport({tenantId})` appelle `accommodations(null,{tenantId})`, en parallèle de son propre calcul `averageStayLength`. `accommodations(accommodationId,{tenantId})` est asynchrone, ne reçoit aucun objet Express et renvoie `{kpis, occupancyFormula, revenueBasis}`. Les erreurs Mongo sont propagées.

**Classification principale : AGGREGATION.** Secondaire : QUERY et lecture financière.

**Requêtes directes :**

- `Accommodation.find().distinct()` puis agrégation avec `$lookup` vers `properties` ;
- agrégation `AccommodationReservation` ;
- comptes `AccommodationNightLock` réservation/blocage ;
- agrégations `FinancialDocument`, `PaymentAllocation`, `FinancialRefund`.

**Contrat :** hébergement indépendant seulement ; `accommodationId` optionnel ; `tenantId` optionnel sur l'hébergement ; publié/brouillon, disponibilité Property, réservations `confirmed|checked_in|checked_out`, fenêtres jour/semaine/mois/année, occupation mensuelle, factures non annulées, allocations actives, remboursements terminés/en attente/échoués. Aucun tri, pagination ou populate dans la fonction. Valeurs et montants sont agrégés, jamais écrits.

**Sécurité :** le handler Dashboard garde les rôles, la validation ObjectId, le 422 propriétaire, la vérification ownership et le same-tenant. Le Reporting garde `protect`, Direction et `requireTenantScopeAllowPlatformWide`. La fonction ne décide aucune autorisation ; elle applique les IDs reçus. En mode PlatformOperator non scopé, `tenantId=null` produit la vue globale historique.

**Models directs :** Accommodation, AccommodationReservation, AccommodationNightLock, FinancialDocument, PaymentAllocation, FinancialRefund ; collection Property via `$lookup`. **Services appelés :** aucun. **Side effects :** lectures Mongo seulement.

**Owner/duplication :** aucun query owner canonique équivalent. Le DomainReport ajoute seulement la durée moyenne ; pas de duplication exacte. Une future abstraction étroite `accommodationReportQueryService` serait cohésive, mais la surface finance/tenant et la matrice propriétaire rendent le blast radius **HIGH**. Testabilité **MEDIUM**.

## 2. Hotel

**Trace factuelle :** `getHotelReport({user,dateFrom,dateTo,hotelId})` appelle `hotels(user)` et `getHotelFinancialDashboardSummary` en parallèle. L'import controller ne reçoit actuellement pas `hotelId` dans ce DomainReport : l'occupation reste globale, tandis que la finance peut être scopée ; RevPAR/ADR sont volontairement `null` avec `hotelId`. `hotels(actor,requestedHotelId)` est asynchrone, sans Express, et renvoie `{kpis,revenueBasis}` ; il peut lever une erreur 403 `Établissement inaccessible.`.

**Classification principale : SECURITY_SCOPE.** Secondaires : AGGREGATION, QUERY, FINANCIAL_LOGIC read-only.

**Requêtes directes :** Hotel, Room, HotelReservation, HousekeepingTask, MaintenanceTicket, PaymentAllocation, FinancialRefund et FinancialDocument. Le filtre hôtel combine tenant de l'acteur, `listAccessibleHotels`, hôtel demandé, publication, Property validée/disponible, statut actif. Les agrégations couvrent chambres, occupation, réservations, housekeeping, maintenance, allocations, remboursements et soldes.

**Services transitifs du symbole :** `hotelAccessScopeService.listAccessibleHotels`, qui lit Hotel/HotelStaffAssignment et utilise l'attribution tenant pour Admin. Le DomainReport, hors symbole importé, appelle le service financier canonique avec ses propres contrôles de capability et de nombreuses collections financières.

**Sécurité :** tenant **YES**, ownership indirect via manager/createdBy/property et assignments, PlatformOperator **YES**, IAM/capabilities **YES** via les owners de scope environnants. L'authentification/rôle HTTP reste extérieure. Le mode plateforme non scopé aboutit à la vue globale historique pour un acteur Admin sans `platformTenant`.

**Owner/duplication :** les owners de scope hôtel et finance existent, mais aucun owner canonique de la query d'occupation consolidée. Il n'y a pas de duplication exacte. Extraire seulement la query serait possible en théorie, mais le contrat entre occupation globale, scope financier et ratios documentés doit être verrouillé. Blast radius **CRITICAL**, finance **HIGH**, testabilité **LOW à MEDIUM**. Ce n'est pas un quick win.

## 3. Location

**Trace factuelle :** `getLocationReport({scopeUserIds})` appelle `rentals({scopeUserIds})` puis ajoute `{domain:'location',periodSupported:false}`. `rentals` est asynchrone, sans Express, et renvoie `{kpis}`. Les erreurs Mongo sont propagées.

**Classification principale : AGGREGATION.** Secondaires : QUERY, OWNERSHIP_SCOPE, lecture financière.

**Requêtes :**

- normalisation Set/IDs vers ObjectId ;
- `Property.find({owner:{$in:scopeUserIds}}).distinct('_id')` si scope fourni ;
- `Contrat.find({bien:{$in:properties}}).distinct('_id')` ;
- agrégation RentalManagement active (disponible/occupé/préavis) ;
- agrégation Contrat location (actifs/expiration à 30 jours) ;
- agrégation Paiement (encaissé, impayé/en retard/partiel, pénalités) ;
- compte RentalMaintenanceTicket ouvert.

Aucune pagination, aucun tri, populate ou projection documentaire. Models directs : Property, RentalManagement, Contrat, Paiement, RentalMaintenanceTicket. Services : aucun. Side effects : lectures Mongo seulement.

**Sécurité :** l'API Reporting résout tenant→OrgUnit→`scopeUserIds`; la fonction applique un scope ownership par `Property.owner`. Le Dashboard Analytics appelle sans scope après restriction `ROLES_GL`, conservant la vue globale historique. Un PlatformOperator non scopé reçoit également `scopeUserIds=null`. Fait notable à caractériser : Reporting applique éventuellement le scope tout en ajoutant la métadonnée `orgScopeSupported:false` via `withNoOrgScope`; ARCH-2K ne change ni l'un ni l'autre.

**Owner/duplication :** aucun owner canonique de cette agrégation ; aucune duplication exacte. Une future abstraction étroite `rentalReportQueryService`, décrite comme « construire les KPI read-only de gestion locative sous un scope d'owners fourni », aurait une cohésion **HIGH** et supprimerait réellement une edge. Blast radius **MEDIUM**, finance **MEDIUM**, testabilité **MEDIUM-HIGH** après caractérisation dédiée.

## Couplage HTTP commun

Aucune des trois fonctions ne dépend de `req`, `res`, `next`, `status`, `json`, headers, cookies ou mapping HTTP. Elles sont mal hébergées dans un controller, même si leurs risques métier diffèrent.

## Abstractions recherchées

Ont été inspectés : `reportingService`, DomainReports, `immobilierReportQueryService`, `dashboardKpiQueryService`, services Property/portfolio, services rental, `hotelAccessScopeService`, `hotelFinancialDashboardService` et services finance. Aucun ne constitue l'owner exact des trois agrégations restantes. Réutiliser un `ReportingService`, `FinanceService`, `PropertyService` ou `HotelService` générique créerait un God Service et n'est pas recommandé.
