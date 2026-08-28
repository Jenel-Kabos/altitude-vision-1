# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Inventaire des routes sensibles

Inventaire ciblé sur les familles de routes désignées prioritaires par le mandat (§12), avec pour chacune : endpoint, méthode, auth, RBAC, tenant resolver, resource authority, controller. Les lignes marquées **[GAP]** renvoient à l'ID correspondant dans `_FINDING_MATRIX.md`.

| Endpoint | Méthode | Auth | RBAC | Tenant resolver | Resource authority | Controller |
|---|---|---|---|---|---|---|
| `/api/accommodations/:id` | GET/PATCH/DELETE | protect | restrictTo | `assertAccommodationAccessible` | ownership/staff | accommodationController |
| `/api/accommodations/admin/:propertyId` | PUT | protect | restrictTo | **aucun [GAP RA-10]** | aucune | accommodationController.updateFull |
| `/api/accommodation-reservations/:id` | GET/PATCH | protect | restrictTo | `assertReservationTenantBoundary` | `assertReservationAccess` | accommodationReservationController |
| `/api/hotels/:id` | GET/PUT/DELETE | protect | restrictTo | `assertOperationalHotelAccess` | ownership/staff | hotelController |
| `/api/hotels/:hotelId/staff-assignments/:assignmentId` | GET/PATCH/POST | protect | requireHotelCapability(hotelId) | via hotelId (capacité) | **assignment non recroisé [GAP RA-13]** | hotelStaffAssignmentController |
| `/api/hotel-reservations/:id` | GET/PATCH | protect | restrictTo | `assertReservationAccess` | ownership/staff | hotelReservationController |
| `/api/properties/:id` | PATCH/DELETE | protect | restrictTo | `assertPropertyTenantAccess` | ownership/staff | propertyController |
| `/api/properties/:id/transition` | POST | protect | requireCapability | **aucun [GAP RA-12]** | aucune | propertyAssetController |
| `/api/admin/properties` (legacy) | GET | protect | restrictTo | **aucun [GAP RA-09]** | aucune | adminController |
| `/api/admin/properties/:id/approve\|reject` | PATCH | protect | adminOnly | **aucun [GAP RA-09]** | aucune | adminController |
| `/api/admin/properties/:id` (legacy) | DELETE | protect | adminOnly | **aucun [GAP RA-09]** | aucune (hard delete) | adminController |
| `/api/admin/properties/sales/:id`, `/rentals/:id` | PUT | protect | restrictTo (staff+owner) | owner ✅ / staff **aucun [GAP RA-11]** | partiel | salePropertyController / rentalPropertyController |
| `/api/rental-management/:id` | GET/PATCH/… | protect | restrictTo | `router.param` + `resolveScope` | ownership | rentalManagementController |
| `/api/rental-lease-lifecycle/:id/*` | POST | protect | restrictTo(STAFF_IMMO) | **aucun [GAP RA-05]** | aucune | rentalLeaseLifecycleController |
| `/api/contrats` | GET | protect | requireCapability | **aucun [GAP RA-04]** | aucune | contratController.getAll |
| `/api/contrats/:id` | GET/PUT/DELETE | protect | requireCapability | `router.param` + `assertResourceTenantOrUnattributed` | ✅ | contratController |
| `/api/paiements`, `/stats`, `/alertes` | GET | protect | requireCapability | **aucun [GAP RA-02]** | aucune | paiementController |
| `/api/paiements/encaisser-multiple` | POST | protect | requireCapability | **aucun [GAP RA-03]** | aucune | paiementController.encaisserMultiple |
| `/api/paiements/:id/*` | GET/PUT/POST/DELETE | protect | requireCapability | `router.param` + `assertResourceTenantOrUnattributed` | ✅ | paiementController |
| `/api/locataires`, `/dossiers` | GET | protect | restrictTo | **aucun [GAP RA-15]** | aucune | locataireController |
| `/api/locataires/:id` | GET/PUT/DELETE | protect | restrictTo | `assertLocataireInScope` | ✅ | locataireController |
| `/api/proprietaires` | GET | protect | restrictTo | **aucun [GAP RA-15]** | aucune | proprietaireController |
| `/api/proprietaires/:id` | GET/PUT/DELETE | protect | restrictTo | `assertProprietaireInScope` | ✅ | proprietaireController |
| `/api/visites`, `/all-payments`, `/unread-count` | GET | protect | requireCapability | **aucun [GAP RA-06]** | aucune | visiteController |
| `/api/visites/:id` | PATCH | protect | requireCapability | **aucun [GAP RA-06]** | aucune | visiteController.updateVisite |
| `/api/litiges` | GET | protect | restrictTo | **aucun [GAP RA-07]** | aucune | litigeController |
| `/api/litiges/:id`, `/proof` | GET | protect | restrictTo | **aucun [GAP RA-07]** | isStaff/isPart (pas tenant) | litigeController |
| `/api/signalements` | GET | protect | restrictTo | **aucun [GAP RA-07]** | aucune | signalementController |
| `/api/real-estate-applications` | GET | protect | isStaff/owner | **aucun [GAP RA-08]** | partiel (owner) | realEstateApplicationController |
| `/api/transactions` | GET | protect | staffOnly | **aucun [GAP RA-14]** | aucune | transactionController |
| `/api/transactions/:id/finalize\|cancel` | POST | protect | staffOnly | **aucun [GAP RA-14]** | aucune | transactionController |
| `/api/devis` (quotes) | GET | protect | restrictTo(STAFF_ALL) | **aucun [GAP RA-16]** | aucune | quoteController |
| `/api/dashboard/stats` | GET | protect | restrictTo(STAFF_ALL) | **aucun [GAP RA-17]** | N/A (agrégats) | dashboardKpiQueryService |
| `/api/dashboard-analytics/*` | GET | protect | restrictTo | `requireTenantScopeForAnalytics` (allowPlatformWide) | ✅ | dashboardAnalyticsController |
| `/api/messages` (send) | POST | protect | — | **aucun effet pour Client/Proprietaire [GAP RA-01]** | aucune | messageController.sendMessage |
| `/api/messages/:conversationId` | GET | protect | — | `assertConversationAccess` | ✅ | messageController.getMessages |
| `/api/conversations/:id`, `/messages`, `/read`, DELETE | * | protect | requireTenantScopeForStaffOrPlatformOperator | `assertConversationAccess` | ✅ | conversationController |
| `/api/rental-maintenance` (staff, sans propertyId) | GET | protect | requireCapability | **aucun [GAP RA-19]** | aucune | rentalMaintenanceController.list |
| `/api/financial/*` | * | protect | requireCapability | `assertFinancialScope`/`assertResourceTenant` | ✅ | financialController |
| `/api/rental-documents/:id/download` | GET | protect | — | `assertResourceTenantOrUnattributed` | ✅ (relation réelle) | rentalDocumentController |
| `/api/platform-tenants/*` | * | protect | — | `assertOwnTenantOrPlatformOperator` | ✅ | platformTenantController |
| `/api/developer/api-keys/*` | * | protect | — | scopé `req.platformTenant._id` | ✅ | apiPlatformAdminController |
| `/api/notifications/*` | * | protect | — | N/A | `recipient === req.user.id` | notificationController |

Note : cette table n'est pas exhaustive de toutes les routes du backend (plusieurs centaines) — elle couvre les familles désignées prioritaires par le mandat (§12) et toutes les routes citées dans `_FINDING_MATRIX.md`. Les routes non listées ici et non citées comme finding ont été passées en revue par les agents de recherche et classées SAFE ou hors-périmètre (catalogue public, ressources auto-scopées par construction) — voir le détail dans `_STAFF_SCOPE_AUDIT.md`.
