# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Matrice des frontières de sécurité

Colonnes : Domain / Route / Auth / RBAC / Tenant / Resource Authority (ownership/participant/staff-scope) / PO semantics / Verdict.

| Domain | Route(s) | Auth | RBAC | Tenant | Resource Authority | PO semantics | Verdict |
|---|---|---|---|---|---|---|---|
| Messaging (lecture) | `GET /api/messages/:conversationId`, `GET/PATCH/DELETE /api/conversations/*` | ✅ | ✅ (staff/participant) | ✅ (HF-FINAL-01) | ✅ `assertConversationAccess` | ✅ scopé par tenant résolu | **SAFE** |
| Messaging (écriture) | `POST /api/messages` | ✅ | ❌ (aucune vérification participant/staff) | ❌ (sans effet pour Client/Proprietaire) | ❌ | N/A | **VULNÉRABLE (RA-01)** |
| Finance (hôtel/documents) | `financialController.*` | ✅ | ✅ `assertCan*` | ✅ `assertFinancialScope`/`assertResourceTenant` | ✅ ownership guest/owner | ✅ capacité `platform.finance.*` dédiée | **SAFE** |
| Finance (GL — Paiement liste/stats/alertes) | `GET /api/paiements`, `/stats`, `/alertes` | ✅ | ✅ capacité `payments.read` | ❌ | ❌ | N/A | **VULNÉRABLE (RA-02)** |
| Finance (GL — encaissement multiple) | `POST /api/paiements/encaisser-multiple` | ✅ | ✅ capacité `payments.manage` | ❌ (bypass du garde `:id`) | ❌ | N/A | **VULNÉRABLE (RA-03)** |
| Finance (GL — Contrat détail) | `GET/PUT/DELETE /api/contrats/:id` | ✅ | ✅ | ✅ (`router.param` + `assertResourceTenantOrUnattributed`) | ✅ | N/A | **SAFE** |
| Finance (GL — Contrat liste) | `GET /api/contrats` | ✅ | ✅ | ❌ | ❌ | N/A | **VULNÉRABLE (RA-04)** |
| GL — cycle de vie du bail | `rentalLeaseLifecycleRoutes.js` (transition/renew/avenant/caution) | ✅ | ✅ `restrictTo(STAFF_IMMO)` | ❌ | ❌ | N/A | **VULNÉRABLE (RA-05)** |
| Visites | `visiteRoutes.js` (staff) | ✅ | ✅ capacité `visits.*` | ❌ (champ existe, non utilisé) | ❌ | N/A | **VULNÉRABLE (RA-06)** |
| Litiges/Signalements | `litigeRoutes.js`, `signalementRoutes.js` | ✅ | ✅ `restrictTo(ROLES_LITIGES)` | ❌ | ❌ (même en lecture unitaire) | N/A | **VULNÉRABLE (RA-07)** |
| Candidatures immobilières | `realEstateApplicationRoutes.js` | ✅ | ✅ (staff/owner) | ❌ | Partiel (owner-match, pas tenant) | N/A | **VULNÉRABLE (RA-08)** |
| Property (legacy admin) | `adminRoutes.js` `/properties*` | ✅ | ✅ `restrictTo(Admin)`/`STAFF_CM+STAFF_IMMO` | ❌ | ❌ | N/A | **VULNÉRABLE (RA-09)** |
| Property (canonique) | `propertyRoutes.js` `:id` (update/status/delete) | ✅ | ✅ | ✅ `assertPropertyTenantAccess` | ✅ | N/A | **SAFE** |
| Accommodation | `accommodationRoutes.js` (sauf `admin/:propertyId` PUT) | ✅ | ✅ | ✅ `assertAccommodationAccessible` | ✅ | ✅ | **SAFE (sauf RA-10)** |
| Accommodation (admin updateFull) | `PUT /api/accommodations/admin/:propertyId` | ✅ | ✅ `restrictTo` | ❌ | ❌ | N/A | **VULNÉRABLE (RA-10)** |
| Property Sprint A (sale/rental updateFull) | `PUT /api/admin/properties/{sales,rentals}/:id` | ✅ | ✅ (owner OK, staff KO) | ❌ pour le staff | Owner ✅ / Staff ❌ | N/A | **VULNÉRABLE (RA-11)** |
| Property lifecycle | `POST /api/properties/:id/transition` | ✅ | ✅ capacité `properties.update` | ❌ | ❌ | N/A | **VULNÉRABLE (RA-12)** |
| Hotel — staff assignment | `hotelRoutes.js` `/staff-assignments/:assignmentId/*` | ✅ | ✅ capacité sur `hotelId` URL | ✅ (indirect via hotelId) | ❌ (assignment non recroisé) | N/A | **VULNÉRABLE (RA-13)** |
| Hotel (reste) | `hotelController.*`, `hotelReservationController.*`, `roomCategoryController.*` | ✅ | ✅ | ✅ `assertOperationalHotelAccess`/`assertHotelAccess` | ✅ | ✅ | **SAFE** |
| Transactions | `transactionRoutes.js`, `paiementTransactionController.*` | ✅ | ✅ `staffOnly`/isOwner | ❌ | Partiel (owner OK, staff global) | N/A | **VULNÉRABLE (RA-14)** |
| Locataire/Proprietaire (détail) | `:id` routes | ✅ | ✅ | ✅ `assertLocataireInScope`/`assertProprietaireInScope` | ✅ | N/A | **SAFE** |
| Locataire/Proprietaire (liste) | `GET /` | ✅ | ✅ | ❌ | ❌ | N/A | **VULNÉRABLE (RA-15)** |
| Devis | `quoteRoutes.js` | ✅ | ✅ `STAFF_ALL` | ❌ (aucun concept tenant) | ❌ | N/A | **VULNÉRABLE (RA-16, à clarifier produit)** |
| Dashboard stats | `GET /api/dashboard/stats` | ✅ | ✅ `STAFF_ALL` | ❌ | N/A (agrégats) | N/A | **VULNÉRABLE mineur (RA-17)** |
| RentalManagement | `rentalManagementRoutes.js` | ✅ | ✅ | ✅ `router.param('id')` + `resolveScope` | ✅ | N/A | **SAFE** |
| Financial dashboard | `hotelFinancialDashboardController.*` | ✅ | ✅ | ✅ | ✅ | ✅ | **SAFE** |
| Notifications | `notificationController.*` | ✅ | N/A | N/A | ✅ `recipient === req.user.id` | N/A | **SAFE** |
| PlatformTenant admin | `platformTenantController.*` | ✅ | ✅ | ✅ `assertOwnTenantOrPlatformOperator` | ✅ | ✅ | **SAFE** |
| API Keys / dev portal | `apiPlatformAdminController.*` | ✅ | ✅ | ✅ (scopé `req.platformTenant._id`) | ✅ | N/A | **SAFE** |

## Note sur la règle métier Admin (§5 du mandat)

Confirmé : partout où le contrat est SAFE (Property canonique, Accommodation, Hotel, RentalManagement, PlatformTenant), un Admin conserve ses capacités CRUD légitimes **à l'intérieur de son tenant** — aucune restriction artificielle n'a été introduite ni proposée par ce re-audit. Le problème n'est jamais "Admin a trop de droits dans son tenant", mais "Admin/staff atteint une ressource **hors** de son tenant" via une route non alignée sur le contrat déjà prouvé ailleurs dans le même fichier.
