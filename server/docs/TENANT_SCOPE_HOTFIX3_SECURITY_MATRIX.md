# TENANT-SCOPE-HOTFIX-3 — Matrice de sécurité

Tous les scénarios ci-dessous sont couverts par des tests Mongo réels (`tenantScopeAudit2bHotel.mongo.integration.test.js`, `tenantScopeAudit2bFinancial.mongo.integration.test.js`), sauf mention contraire.

## Hotel

| Scénario | Attendu | Résultat observé | Statut |
|---|---|---|---|
| Owner A (public-signup, sans OrgMembership) → `GET /mine` | 200, hôtel A inclus | 200, inclus | ✅ Prouvé |
| Owner A → `GET /mine` (hôtel de B jamais inclus) | Absent de la liste | Absent | ✅ Prouvé (cross-owner) |
| Owner A → `POST /:id/submit` sur hôtel B (ID deviné) | 403 | 403 | ✅ Prouvé |
| Staff A (Tenant A) → `GET /:id` (hôtel A) | 200 | 200 | ✅ Prouvé |
| Staff A non-Admin (Tenant A) → `GET /admin/list` (hôtel B jamais inclus) | Absent | Absent | ✅ Prouvé |
| Multi-tenant selected context (X-Platform-Tenant-Id) | Comportement inchangé (non modifié) | Non modifié — `requestedTenant(req)` toujours lu identiquement | ✅ Non-régression (code inchangé) |
| Owner + OrgMembership réel (Proprietaire affilié) | Fonctionne sans régression | 200 sur `/:id` | ✅ Prouvé (AUDIT-1/2A suites rejouées + test dédié) |
| Owner zéro OrgMembership (scénario historique) | Self-service fonctionne | 200 sur `/mine` | ✅ Prouvé (test explicite obligatoire du mandat §18) |
| Route staff-only (`POST /admin`) demandée par un Proprietaire | 403 (RBAC `auth.restrictTo`, jamais touché) | 403 | ✅ Prouvé |

## Financial

| Scénario | Attendu | Résultat observé | Statut |
|---|---|---|---|
| Owner A (sans OrgMembership) → `GET /hotel/:hotelId/documents` (hôtel A) | 200 | 200 | ✅ Prouvé |
| Owner A → `GET /hotel/:hotelId/documents` (hôtel B) | Refus | 403 (`assertFinancialScope`, `!user.platformTenant && manager≠actor`) | ✅ Prouvé (cross-owner) |
| Owner A → `POST /payments/manual` (staff-only) | Refus | 403 (`assertFinancialCapability`, RBAC non modifié) | ✅ Prouvé — owner ne devient pas staff finance |
| Owner A → `POST /payments/:id/confirm` | Jamais 200 | 404 (paiement inexistant vérifié avant capacité — comportement du contrôleur, non modifié) | ✅ Prouvé — jamais d'accès accordé |
| Owner A + query `ownerId` forgé | Refus (paramètre non lu par le contrôleur) | 403 | ✅ Prouvé (forgery) |
| Staff finance A (Tenant A) → hôtel A | Fonctionne sans régression | 200 | ✅ Prouvé |
| Staff finance A (Tenant A) → hôtel B | Refus | 404 (`assertFinancialScope`, `Etablissement inaccessible`) | ✅ Prouvé (cross-tenant) |
| Client (rôle absent de `FINANCIAL_CAPABILITIES`) → hôtel légitime du même tenant | Refus | 403 | ✅ Prouvé — Client ne gagne aucune capacité |
| Admin selon contrat existant | Non modifié | Suites F21-F25 rejouées vertes | ✅ Non-régression |
| PAY-3 (provider registry) | Non modifié | 70/70 rejoués verts | ✅ Non-régression |
| PAY-4 (MTN, callbacks, cross-user/cross-tenant) | Non modifié — routes MTN restent sous `auth.protect` uniquement, jamais dépendantes de `platformTenant` | 70/70 rejoués verts (mtnMoMoClient/Provider/Controller/HotelPaymentBridge) | ✅ Non-régression |
| Checkout policy (F2.3) | Non modifié | `hotelFinancialCheckoutF23`, `hotelCheckoutFinancialReadiness` rejoués verts | ✅ Non-régression |
| Manual payments | Restent staff-controlled | `PAYMENT_CREATE` absente de `ownerCapabilities`, non modifiée | ✅ Prouvé |

## Transversal

| Invariant | Vérification | Statut |
|---|---|---|
| `fromUser` non modifié | `git diff` — aucun changement dans `tenantResourceAttributionService.js` | ✅ |
| `resolveTenantScope` non modifié (sémantique) | `git diff` — fonction extraite mais logique byte-identique ; suites tenantCore/cert rejouées vertes AVANT toute modification de routeur, pour isoler la preuve | ✅ |
| `hotelAccessScopeService.js` non modifié | `git diff` — aucun changement | ✅ |
| `financialAuthorizationService.js` non modifié | `git diff` — aucun changement | ✅ |
| `expandScopeWithUnaffiliatedUsersIfSoleTenant` non utilisé ici | Aucune référence dans `middleware/tenantContext.js`/`hotelRoutes.js`/`financialRoutes.js` | ✅ |
| Public catalog Property/Hotel intact | `tenantCore.mongo.integration.test.js` (6 tests API Gateway) rejoué vert | ✅ |
| Invariant Conversation (ownership ≠ accès) | `conversationStaffInboxTenant.test.js`/`conversationRoutes.test.js` rejoués verts ; aucun fichier Conversation touché | ✅ |
| BusinessProfiles (AUDIT-2B) | `tenantScopeAudit2bBusinessProfiles.mongo.integration.test.js` (9 tests) rejoué vert, fichier non re-touché | ✅ |
| Webhooks/callbacks MTN non affectés par le nouveau routing | Routes `paymentProviderRoutes.js` (callback MTN) montées séparément, jamais sous `hotelRoutes.js`/`financialRoutes.js` — non touchées | ✅ |
