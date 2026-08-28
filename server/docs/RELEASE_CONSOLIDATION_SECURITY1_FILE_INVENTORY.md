# RELEASE-CONSOLIDATION-SECURITY-1 — Inventaire complet du diff

Inventaire produit par lecture directe du worktree (90 fichiers modifiés + 629 non trackés), classifié par catégorie (A-K) et rattaché à sa provenance (mandat/sprint).

## Constat global : trois chantiers entremêlés, non liés entre eux

1. **SECURITY-CLOSURE-P0-WAVE-1 / P1-WAVE-1 / FCA1-01 / FCA1-02** — ~20 contrôleurs/routes, correctifs d'autorité tenant/ressource.
2. **« ARCH2 »** — un refactor architectural antérieur à la campagne sécurité, extrayant la logique métier des contrôleurs vers des services dédiés (~25 fichiers, changements mécaniques de type `require` swap + extraction).
3. **Hotfixs métier indépendants** — Cloudinary (garde-fou), UX toolbar Accommodation, refetch mobile "biens recommandés", checkpoint IMAP Zoho, visibilité auto-submit Accommodation, aperçu/sécurité des pièces jointes messagerie.

Aucun fichier n'est resté sans provenance identifiable (0 `K.UNKNOWN`).

## Partie 1 — 90 fichiers modifiés (trackés)

| Fichier | Catégorie | Provenance |
|---|---|---|
| .gitignore | G.CONFIGURATION | Ce mandat — fix APK (voir `_BASELINE.md`) |
| altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx | C.PRODUCTION-MOBILE | HOTFIX_MOB_RECOMMENDED_PROPERTIES1 |
| client/lib/__tests__/ManageAccommodationsPage.test.jsx | E.FUNCTIONAL-TEST | UX_ACCOMMODATION_SEARCH_BAR1 |
| client/lib/components/messaging/AttachmentStrip.jsx | B.PRODUCTION-FRONTEND | HOTFIX_CONVERSATION_ACTIVE_ATTACHMENT1 |
| client/lib/components/messaging/SafeHtmlEmailViewer.jsx | B.PRODUCTION-FRONTEND | INBOX2 (contraste visuel) |
| client/lib/pages/dashboard/ManageAccommodationsPage.jsx | B.PRODUCTION-FRONTEND | UX_ACCOMMODATION_SEARCH_BAR1 |
| client/lib/services/messageService.js | B.PRODUCTION-FRONTEND | Helpers pièces jointes internes |
| client/lib/services/publiciteService.js | B.PRODUCTION-FRONTEND | HOTFIX_WEB_PUBLICITES_CLOUDINARY1 |
| scripts/local-ci.js | H.SCRIPT/TOOLING | ARCH2 — ajoute `architecture:check` |
| server/__tests__/accommodationRoutes.test.js | D.SECURITY-TEST | Tenant-scope assertion |
| server/__tests__/crmAutomation.mongo.integration.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/hotelRoutes.test.js | D.SECURITY-TEST | Tenant-scope assertion |
| server/__tests__/hotelWebPublicationController.unit.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/notificationService.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/propertyApprovedVisibilityEndToEnd.mongo.integration.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/propertyMobileController.unit.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/propertyPortfolio.mongo.integration.test.js | E.FUNCTIONAL-TEST | ARCH2 |
| server/__tests__/rentalPropertyRoutes.test.js | D.SECURITY-TEST | SEC-P1 (P1-F) |
| server/__tests__/salePropertyRoutes.test.js | D.SECURITY-TEST | SEC-P1 (P1-F) |
| server/__tests__/transactionFinalizationGuard.test.js | D.SECURITY-TEST | SEC-P1 (P1-I) |
| server/__tests__/visiteRoutes.test.js | D.SECURITY-TEST | SEC-P1 (P1-B) |
| server/__tests__/zohoImapService.test.js | E.FUNCTIONAL-TEST | ZOHO_INBOX_HEALTHCHECK1 |
| server/controllers/accommodationController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-E, RA-10) |
| server/controllers/accommodationReservationController.js | A.PRODUCTION-BACKEND | HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1 |
| server/controllers/adminController.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-E, RA-09) |
| server/controllers/contratController.js | A.PRODUCTION-BACKEND | SEC-P1/FCA1-01 (RA-04) |
| server/controllers/conversationController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/dashboardAnalyticsController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/hotelController.js | A.PRODUCTION-BACKEND | HOTFIX_HOTEL_LISTS_TENANT_SCOPE1 + ARCH2 |
| server/controllers/hotelReservationController.js | A.PRODUCTION-BACKEND | HOTFIX_HOTEL_RESERVATION_ADMIN_LISTS_TENANT_SCOPE1 |
| server/controllers/hotelStaffAssignmentController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-H, RA-13) |
| server/controllers/internalMailController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/litigeController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-C, RA-07) |
| server/controllers/locataireController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-J, RA-15) |
| server/controllers/messageController.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-A) + HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1 |
| server/controllers/paiementController.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-B/C, RA-02/03) |
| server/controllers/paiementTransactionController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-I, RA-14) |
| server/controllers/propertyAssetController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-G, RA-12) |
| server/controllers/propertyController.js | A.PRODUCTION-BACKEND | Tenant-scope `runPropertySearch` |
| server/controllers/propertyMobileController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/propertyPortfolioController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/proprietaireController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-J, RA-15) |
| server/controllers/realEstateApplicationController.js | A.PRODUCTION-BACKEND | SEC-P1/FCA1-02 (RA-08) |
| server/controllers/rentalContractRegularizationController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/rentalDocumentController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/rentalLeaseLifecycleController.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-D, RA-05) |
| server/controllers/rentalMaintenanceController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/rentalManagementController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/rentalPropertyController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-F, RA-11) |
| server/controllers/salePropertyController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-F, RA-11) |
| server/controllers/signalementController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-C, RA-07) |
| server/controllers/tenantPortalController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/transactionController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-I, RA-14) |
| server/controllers/userController.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/controllers/visiteController.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-B, RA-06) |
| server/middleware/tenantContext.js | A.PRODUCTION-BACKEND | Middleware tenant central (toutes vagues) |
| server/package.json | G.CONFIGURATION | ARCH2 — ajoute `architecture:check` |
| server/routes/accommodationReservationRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope wiring |
| server/routes/accommodationRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope wiring |
| server/routes/adminRoutes.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-E) |
| server/routes/contratRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-A) |
| server/routes/conversationRoutes.js | A.PRODUCTION-BACKEND | TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1 |
| server/routes/dashboardAnalyticsRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope analytics |
| server/routes/dashboardRoutes.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/routes/devisRoutes.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/routes/emailRoutes.js | A.PRODUCTION-BACKEND | HOTFIX_INBOX_SECURITY1 |
| server/routes/hotelReservationRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope wiring |
| server/routes/hotelRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope wiring |
| server/routes/litigeRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-C) |
| server/routes/locataireRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-J) |
| server/routes/messageRoutes.js | A.PRODUCTION-BACKEND | TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1 |
| server/routes/paiementRoutes.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-B/C) |
| server/routes/propertyRoutes.js | A.PRODUCTION-BACKEND | Tenant-scope wiring |
| server/routes/proprietaireRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-J) |
| server/routes/realEstateApplicationRoutes.js | A.PRODUCTION-BACKEND | SEC-P1/FCA1-02 |
| server/routes/rentalLeaseLifecycleRoutes.js | A.PRODUCTION-BACKEND | SEC-P0 (P0-D) |
| server/routes/signalementRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-C) |
| server/routes/transactionRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-I) |
| server/routes/userRoutes.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/routes/visiteRoutes.js | A.PRODUCTION-BACKEND | SEC-P1 (P1-B) |
| server/server.js | A.PRODUCTION-BACKEND | Boot `initializeCrmAutomation()` |
| server/services/accommodation/mobileAccommodationPublicationService.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/accommodationReservationService.js | A.PRODUCTION-BACKEND | RBAC_ACCOMMODATION_AVAILABILITY_BLOCKS1 |
| server/services/accommodationService.js | A.PRODUCTION-BACKEND | HOTFIX_ACCOMMODATION_CREATED_NOT_VISIBLE1 |
| server/services/crmAutomationEngine.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/hotelService.js | A.PRODUCTION-BACKEND | HOTFIX_HOTEL_LISTS_TENANT_SCOPE1 |
| server/services/notificationService.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/rentalLeaseRenewalService.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/reporting/domains/immobilierReport.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/reporting/domains/locationReport.js | A.PRODUCTION-BACKEND | ARCH2 |
| server/services/zohoImapService.js | A.PRODUCTION-BACKEND | ZOHO_INBOX_HEALTHCHECK1 |

## Partie 2 — 629 fichiers non trackés

### server/docs/ (556 fichiers, tous F.DOCUMENTATION)

Regroupés par préfixe de mandat (table complète produite par audit dédié) :

| Groupe de préfixe | Nombre | Sujet |
|---|---|---|
| ARCH2* (sous-phases A, B, C1-C4, D1-D2, E-M) | 152 | Refactor architecture — extraction services |
| HOTFIX_ACCOMMODATION_RESERVATION_TENANT_SCOPE1 | 17 | Hotfix réservation Accommodation |
| SECURITY_CLOSURE_P0_WAVE1 | 16 | Vague P0 |
| HOTFIX_PROPERTY_MODERATION_TENANT_SCOPE1 | 12 | Modération Property |
| HOTFIX_MESSAGING_TENANT_AMBIGUOUS_STAFF1 | 12 | Staff tenant ambigu Messaging |
| HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1 | 12 | Lecture message |
| HOTFIX_HOTEL_LISTS_TENANT_SCOPE1 | 12 | Listes Hôtel |
| RBAC_ACCOMMODATION_AVAILABILITY_BLOCKS1 | 12 | RBAC blocs disponibilité |
| MESSAGING_MESSAGE_READ_AUTHORITY_ASSESSMENT1 | 12 | Évaluation pré-hotfix |
| HZ09_TRANSVERSAL_SECURITY_DEBT | 12 | Dette transversale (P3) |
| TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1 | 14 | Audit horizontal final |
| TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1 | 14 | Re-audit de clôture |
| HZ08_LEGACY_ATTRIBUTION_ASSESSMENT | 11 | Attribution legacy (P2) |
| HOTFIX_ACCOMMODATION_RESERVATION_LIST_TENANT_SCOPE1 | 11 | Liste réservations |
| HOTFIX_ACCOMMODATION_CALENDAR_TENANT_SCOPE1 | 11 | Calendrier |
| HOTFIX_ACCOMMODATION_ADMIN_LISTS_TENANT_SCOPE1 | 11 | Listes admin |
| SECURITY_CLOSURE_P1_WAVE1 | 11 | Vague P1 |
| UX_ACCOMMODATION_SEARCH_BAR1 | 10 | UX toolbar (non sécurité) |
| SECURITY_FINAL_CLOSURE_BLOCKERS_HOTFIX1 | 10 | FCA1-01/FCA1-02 |
| HOTFIX_ZOHO_IMAP_SEEN_CHECKPOINT1 | 10 | Checkpoint IMAP (non sécurité) |
| HOTFIX_HOTEL_RESERVATION_ADMIN_LISTS_TENANT_SCOPE1 | 10 | Réservations hôtel admin |
| HOTFIX_DASHBOARD_ANALYTICS_TENANT_SCOPE1 | 10 | Analytics dashboard |
| HOTFIX_ACCOMMODATION_CREATED_NOT_VISIBLE1 | 10 | Visibilité auto-submit (non sécurité) |
| HOTFIX_MONGO_ARCH2L_INDEX_ORDER_FLAKE1 | 9 | Flake index Mongo (ARCH2) |
| HOTFIX_MOB_RECOMMENDED_PROPERTIES1 | 9 | Mobile refetch (non sécurité) |
| HOTFIX_WEB_PUBLICITES_CLOUDINARY1 | 8 | Garde-fou Cloudinary (non sécurité) |
| HOTFIX_CONVERSATION_ACTIVE_ATTACHMENT1 | 8 | Pièces jointes messagerie |
| SECURITY_FINAL_CLOSURE_AUDIT1 | 7 | Audit final adversarial |
| SECURITY_CLOSURE_TARGETED_VALIDATION1 | 6 | Validation ciblée |
| HOTFIX_MOB_GOOGLE_AUTH2/3/4 | 17 | Google Auth mobile (non sécurité tenant) |
| HOTFIX_MOB_ADD_PROPERTY_BEDROOMS1 | 5 | Bug compteur mobile |
| HOTFIX_INBOX_SECURITY2 (incl. FINAL) | 12 | Sécurité inbox v2 |
| HOTFIX_INBOX_SECURITY1 | 6 | Sécurité inbox v1 |
| INBOX2_* | 15 | Refonte UI Inbox v2 |
| INBOX1_* | 10 | Évaluation architecture Inbox v1 |
| ZOHO_INBOX_HEALTHCHECK1_* | 10 | Diagnostic bug IMAP |
| (autres groupes mineurs) | ~30 | Divers hotfixs ponctuels (Auth, Dark mode, Users count, footer, etc.) |

Aucun fichier `.md` anormalement volumineux détecté (>500 Ko) — échantillonnage confirmé : contenu texte de rapport standard partout.

### server/__tests__/ (44 nouveaux fichiers) — D (sécurité) ou E (fonctionnel)

`D` : `accommodationAdminListsTenantScope`, `accommodationAvailabilityBlocksRbac`, `accommodationCalendarTenantScope`, `accommodationReservationListTenantScope`, `accommodationReservationTenantScope`, `contratCreateTenantAuthority`, `dashboardAnalyticsTenantScope`, `emailRoutesAuth`, `hotelAdminListsTenantScope`, `hotelReservationAdminListsTenantScope`, `messageAttachmentMimeFilter`, `messageReadAuthority`, `messagingTenantAmbiguousStaff`, `propertyModerationTenantScope`, `realEstateReservationTenantAuthority`, `securityClosureP0Wave*` (4), `securityClosureP1Wave*` (10).

`E` : `accommodationCreatedVisibility`, `architectureBoundaries`, `dashboardKpiQueryService` (×2), `dashboardKpiRouteBoundary`, `devisRouteApplicationBoundary` (×2), `documentStreamingService`, `messageSerializer`, `mobilePropertyPublicationInputBoundary`, `notificationObservationPort`, `propertyPublicationInputBoundary`, `rentalPaymentScheduleBoundary`, `rentalReportQueryBoundary`, `unaffiliatedUserScopeService`.

### server/services/, models/, scripts/, architecture/ (14 nouveaux fichiers)

| Fichier | Catégorie | Objet |
|---|---|---|
| services/dashboardKpiQueryService.js | A | ARCH2 |
| services/devisApplicationService.js | A | ARCH2 |
| services/messageSerializer.js | A | ARCH2 |
| services/messagingAuthorizationService.js | A | ARCH2 (pertinent sécurité) |
| services/notificationObservationPort.js | A | ARCH2 |
| services/propertyPublicationInputService.js | A | ARCH2 |
| services/rentalPaymentScheduleService.js | A | ARCH2 |
| services/reporting/immobilierReportQueryService.js | A | ARCH2 |
| services/reporting/rentalReportQueryService.js | A | ARCH2 |
| services/storage/documentStreamingService.js | A | ARCH2 |
| services/unaffiliatedUserScopeService.js | A | ARCH2 |
| models/ImapSyncCheckpoint.js | A | Nouveau modèle, checkpoint IMAP Zoho |
| scripts/check-architecture.js | H | Gate CI ARCH2 |
| architecture/baseline.json + checker.js | H | Backing du gate ARCH2 |

### client/ (12 fichiers) et altimmo-app/ (3 items, hors APK exclu)

Client : `e2e/accommodationSearchBar1/` (H+I, incl. captures d'écran), `e2e/inbox2/` (H+I), `e2e/security2/` (H), `AttachmentStripSecurity.test.jsx` (D), `PublicitesPageUpload.test.jsx` (E), `attachmentPresentation.test.js` (E), `attachmentSecurity.test.js` (D), `publiciteService.test.js` (E), `SafeAttachmentPreview.jsx` (B), `attachmentPresentation.js` (B), `attachmentSecurity.js` (B), `sanitizeSandboxedHtml.js` (B).

Mobile : `ListeAnnoncesScreenRecommended.test.jsx` (E), `AddRentalPropertyBedroomsCounter.test.jsx` (E). L'APK (`J.TEMPORARY`, 149 Mo) est désormais exclu par `.gitignore` (voir `_BASELINE.md`).
