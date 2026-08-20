# TENANT-SCOPE-HOTFIX-3 — Matrice des routes (avant/après)

## Hotel (`routes/hotelRoutes.js`)

Toutes les routes ci-dessous (hors public, lignes 19-27) sont actuellement derrière `router.use(auth.protect, requireTenantScope)` (ligne 29). Classification par lecture complète de chaque contrôleur.

| Route | Method | Classe | requireTenantScope avant | Authorization réelle (déjà existante, non modifiée) | Middleware après |
|---|---|---|---|---|---|
| `/public`, `/public/:id` | GET | E. PUBLIC | Non (avant `router.use`) | Aucune (public) | Inchangé |
| `/:hotelId/availability`, `/:hotelId/reservations` | GET/POST | E. PUBLIC | Non (avant `router.use`) | `auth.optionalAuth` | Inchangé |
| `/accessible` | GET | A. STAFF-ONLY | Oui | `hotelStaffAssignmentController.accessibleHotels` (liste ce à quoi CE staff a accès) | **Inchangé (requireTenantScope conservé)** |
| `/portfolio`, `/portfolio/:id` | GET | D. MIXED STAFF+OWNER | Oui | `listAccessibleHotels`/`assertHotelAccess` → `assertOperationalHotelAccess` (déjà ownership-safe pour non-Admin) | **Changé → middleware optionnel** |
| `/:hotelId/staff-assignments*` (7 routes) | GET/POST/PATCH | A. STAFF-ONLY | Oui | `requireHotelCapability` (gouvernance du personnel — jamais un propriétaire) | **Inchangé (requireTenantScope conservé)** |
| `/admin`, `/admin/:hotelId`, `/admin/list` | POST/PUT/GET | A. STAFF-ONLY | Oui | `auth.restrictTo(...ROLES_ALTIMMO)` (staff uniquement, route dédiée distincte de `/mine`) | **Inchangé** |
| `/status/pending` | GET | A. STAFF-ONLY | Oui | `auth.restrictTo(...ROLES_MODERATION)` | **Inchangé** |
| `/:id/resync` | POST | A. STAFF-ONLY | Oui | `auth.restrictTo(...ROLES_ALTIMMO)` + `assertHotelAccess` | **Inchangé** (déjà restreint au staff par le rôle ; conserver `requireTenantScope` par prudence, aucun besoin self-service ici) |
| `/mine` (GET) | GET | B. SELF-SERVICE OWNER | Oui | `Hotel.find({manager: req.user.id})` — ownership pur, aucun besoin de tenant | **Changé → middleware optionnel** |
| `/mine` (POST) | POST | B. SELF-SERVICE OWNER | Oui | `createFullHotel`/`createFullMobileAccommodation` avec `manager/owner: req.user.id`, `tenant: user.platformTenant || null` (dégrade proprement si absent) | **Changé → middleware optionnel** |
| `/mine/:hotelId` (PUT) | PUT | D. MIXED (route self-service, contrôleur partagé avec `/admin/:hotelId`) | Oui | `assertHotelAccess` → `assertOperationalHotelAccess` | **Changé → middleware optionnel** |
| `/:id/submit`, `/:id/duplicate`, `/:id/deactivate`, `/:id/reactivate`, `DELETE /:id` | POST/PATCH/DELETE | D. MIXED STAFF+OWNER | Oui | `assertHotelAccess` → `assertOperationalHotelAccess` | **Changé → middleware optionnel** |
| `/:hotelId/room-categories*` (10 routes) | GET/POST/PATCH/DELETE | D. MIXED STAFF+OWNER | Oui | `assertHotelAccess` (roomCategoryController) → `assertOperationalHotelAccess` | **Changé → middleware optionnel** |
| `/:hotelId/rooms*` (4 routes) | GET/POST/PATCH/DELETE | D. MIXED STAFF+OWNER | Oui | idem (roomController) | **Changé → middleware optionnel** |
| `/:hotelId/inventory/*` (3 routes) | GET/PATCH/POST | D. MIXED STAFF+OWNER | Oui | `requireHotelCapability` (dérive de `hotelAccessScopeService` en interne) | **Changé → middleware optionnel** |
| `/room-assignments*` (4 routes) | POST/PATCH | D. MIXED STAFF+OWNER | Oui | `assertOperationalHotelAccess` (roomAssignmentController) | **Changé → middleware optionnel** |
| `/:id/:action` (validate/reject/suspend/unsuspend) | PATCH | A. STAFF-ONLY | Oui | `auth.restrictTo(...ROLES_MODERATION)` | **Inchangé** |
| `/` (liste sélecteur) | GET | A. STAFF-ONLY (restreint par rôle) | Oui | `auth.restrictTo(...ROLES_ALTIMMO)` | **Inchangé** |
| `/:id` (GET, catch-all) | GET | D. MIXED STAFF+OWNER | Oui | `assertHotelAccess` → `assertOperationalHotelAccess` | **Changé → middleware optionnel** |

**Principe de la correction** : plutôt que de disséquer routeur par routeur, `requireTenantScope` (ligne 29) est remplacé par le nouveau middleware `attachTenantScopeIfResolvable` (voir §3 du rapport) — qui a EXACTEMENT le même effet que `requireTenantScope` pour tout acteur dont un tenant se résout (aucun changement pour Admin/staff), et ne bloque simplement plus quand aucun tenant ne se résout. Les routes A (STAFF-ONLY) restent protégées par leur propre `auth.restrictTo(...)` (rôle), qui bloque déjà tout `Proprietaire`/`Client` — le retrait du blocage tenant ne leur ouvre donc RIEN de nouveau. Les routes D (MIXED) restent protégées par `assertOperationalHotelAccess`, qui n'a pas changé.

## Financial (`routes/financialRoutes.js`)

| Route | Method | Classe | requireTenantScope avant | Authorization réelle (déjà existante, non modifiée) | Middleware après |
|---|---|---|---|---|---|
| `/accommodations/documents` | GET | A. STAFF-ONLY | Oui | `auth.restrictTo(...STAFF_IMMO)` | **Inchangé** |
| `/hotel/dashboard/*` (5 routes) | GET | A. STAFF-ONLY (en pratique) | Oui | `assertFinancialDashboardScope` → `assertFinancialCapability` (DASHBOARD_VIEW/ALERTS/OVERRIDE_AUDIT — Owner a `DASHBOARD_VIEW`/`DASHBOARD_ALERTS_VIEW`, donc en réalité **D. MIXED**) | **Changé → middleware optionnel** (Owner légitime doit pouvoir consulter son propre dashboard) |
| `/hotel/reservations/:reservationId/invoice-draft` | POST | A. STAFF-ONLY | Oui | `createHotelDraft` (émission, réservé implicitement au staff via capacité `DOCUMENT_CREATE_DRAFT`, absente de `ownerCapabilities`) | **Inchangé en pratique** (le passage au middleware optionnel n'ouvre rien : `assertFinancialCapability` refuse toujours Owner sur cette capacité) — laissé sous le nouveau middleware par cohérence de routeur, aucune capacité gagnée |
| `/hotel/reservations/:reservationId/document` | GET | D. MIXED STAFF+OWNER | Oui | `assertCanViewFinancialDocument` (`DOCUMENT_VIEW`, dans `ownerCapabilities`) | **Changé → middleware optionnel** |
| `/hotel/:hotelId/documents` | GET | D. MIXED STAFF+OWNER | Oui | `assertCanViewFinancialDocument` | **Changé → middleware optionnel** |
| `/documents/:documentId` | GET | D. MIXED STAFF+OWNER | Oui | `assertCanViewFinancialDocument` | **Changé → middleware optionnel** |
| `/documents/:documentId/draft` | PATCH | A. STAFF-ONLY (capacité) | Oui | `DOCUMENT_EDIT_DRAFT` (absente de `ownerCapabilities`) | Inchangé en pratique, sous nouveau middleware (aucune capacité gagnée) |
| `/documents/:documentId/finalize-lines`, `/refresh-from-reservation`, `/issue` | POST | A. STAFF-ONLY (capacité) | Oui | `DOCUMENT_ISSUE`/gestion (absente de `ownerCapabilities`) | Inchangé en pratique |
| `/documents/:documentId/pdf` (POST/GET), `/pdf/download` | POST/GET | D. MIXED (génération=staff, téléchargement=owner) | Oui | `DOCUMENT_PDF_GENERATE` (staff) / `DOCUMENT_PDF_DOWNLOAD` (owner, dans `ownerCapabilities`) | **Changé → middleware optionnel** |
| `/documents/:documentId/email` | POST | A. STAFF-ONLY (capacité) | Oui | `DOCUMENT_EMAIL_SEND` (absente de `ownerCapabilities`) | Inchangé en pratique |
| `/documents/:documentId/deliveries` | GET | D. MIXED | Oui | `DOCUMENT_DELIVERY_VIEW` (dans `ownerCapabilities`) | **Changé → middleware optionnel** |
| `/payments/manual`, `/hotel/payments` | POST | A. STAFF-ONLY (capacité) | Oui | `PAYMENT_CREATE`/`PAYMENT_CONFIRM` (absentes de `ownerCapabilities`) | Inchangé en pratique |
| `/hotel/payments/mtn/initiate`, `/:paymentId/mtn/check-status` | POST | C. SELF-SERVICE CLIENT (ou staff au comptoir) | Oui | PAY-4 : authentifié, ownership de réservation vérifiée en interne — **non concerné par `Proprietaire`/Hotel.manager**, un Client réserve pour lui-même | **Inchangé** (hors périmètre — pas le même acteur/bug ; non touché, non testé pour extension, seulement pour non-régression) |
| `/hotel/:hotelId/payments` | GET | D. MIXED | Oui | `PAYMENT_VIEW` (dans `ownerCapabilities`) | **Changé → middleware optionnel** |
| `/hotel/reservations/:reservationId/payments` | GET | D. MIXED | Oui | `PAYMENT_VIEW` | **Changé → middleware optionnel** |
| `/documents/:documentId/payments` | GET | D. MIXED | Oui | `PAYMENT_VIEW` | **Changé → middleware optionnel** |
| `/payments/:paymentId` | GET | D. MIXED | Oui | `PAYMENT_VIEW` | **Changé → middleware optionnel** |
| `/payments/:paymentId/confirm` | POST | A. STAFF-ONLY (capacité) | Oui | `PAYMENT_CONFIRM` (absente de `ownerCapabilities`) | Inchangé en pratique |
| `/payments/:paymentId/allocations`, `/allocations`, `/allocations/:allocationId/reverse`, `/hotel/allocations/:allocationId/reverse` | POST | A. STAFF-ONLY (capacité) | Oui | `PAYMENT_ALLOCATE`/`ALLOCATION_REVERSE` (absentes de `ownerCapabilities`) | Inchangé en pratique |
| `/documents/:documentId/ledger` | GET | D. MIXED | Oui | `LEDGER_VIEW` (dans `ownerCapabilities`) | **Changé → middleware optionnel** |

**Principe identique à Hotel** : `requireTenantScope` (ligne 9) → `attachTenantScopeIfResolvable`. Les routes A (capacité staff-only, ex. `PAYMENT_CONFIRM`) restent bloquées pour `Proprietaire` par `assertFinancialCapability` (RBAC, non modifié) — le retrait du blocage tenant en amont ne leur ouvre RIEN de nouveau, `assertFinancialCapability` refuse toujours avant `assertFinancialScope`. Les routes D (capacité déjà dans `ownerCapabilities`) deviennent enfin atteignables pour un exploitant légitime non affilié.
