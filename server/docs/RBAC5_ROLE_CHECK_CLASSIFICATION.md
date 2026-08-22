# RBAC-5 — CLASSIFICATION DES CHECKS DE RÔLE RESTANTS

Cet inventaire est représentatif, pas exhaustif ligne par ligne (le mandat §26 interdit explicitement la conversion mécanique de la totalité des checks — RBAC-2 avait déjà dénombré ~79 checks backend directs, ce sprint les classe sans les convertir). Catégories : AUTHORIZATION, BUSINESS_IDENTITY, PRESENTATION, ROUTING, OWNERSHIP, TENANT, HOTEL_SCOPED, FINANCIAL_SCOPED, LEGACY, DEAD.

## Backend — `restrictTo(...)` et checks inline

Tally global : **~118 sites `restrictTo(...)`** dans `server/routes/*.js`/`server/controllers/*.js` (45 fichiers) + **~23 checks inline** `req.user.role === 'X'` dans les contrôleurs (concentrés dans `propertyController.js`, `dashboardAnalyticsController.js`, `commentController.js`). Un seul site migré vers `requireCapability` (`propertyAssetRoutes.js:25`, RBAC-2).

Répartition des constantes les plus utilisées : `'Admin'` (~51 occurrences, souvent en garde stricte type `adminOnly`), `ROLES_ALTIMMO` (14), `MANAGERS` (10, local à certains fichiers hôtel/analytics), `STAFF_CM` (8), `'Proprietaire'` (~12, ownership/business identity), `STAFF_IMMO` (~8), `STAFF_ALL`/`ALL_STAFF` (~9), `ROLES_UNIVERSAL` (3), `STAFF_DOC` (2), `ROLES_MODERATION` (2), `ROLES_ESTIMATION` (2), `DIRECTION` (1, local à `reportingRoutes.js`).

| Fichier:ligne | Check | Catégorie | Migrer ? | Pourquoi |
|---|---|---|---|---|
| `server/routes/propertyAssetRoutes.js:25` | `requireCapability('properties.update')` | AUTHORIZATION | — (déjà migré) | Référence de parité RBAC-2 |
| `server/routes/adminPropertyRoutes.js:12` | `restrictTo('Admin')` (routeur) | AUTHORIZATION | Non | Contrat déjà strict Admin-only, aucune capacité `properties.admin` équivalente ; conversion sans gain |
| `server/controllers/propertyController.js:620,782,1052` | `req.user.role === 'Admin'` combiné à `isOwner` | OWNERSHIP | Non | Mixte rôle+ownership — la capacité seule ne remplacerait pas la vérification de propriété, mandat §21 |
| `server/routes/hotelRoutes.js:67-69,75,123` | `restrictTo(...ROLES_ALTIMMO)` | AUTHORIZATION | Non | Fonctionnel, alias sémantique conservé (mandat §29) |
| `server/routes/hotelRoutes.js:70,120` | `restrictTo(...ROLES_MODERATION)` | AUTHORIZATION | Non | Groupe modération distinct, pas de capacité `moderation.*` déclarée — création hors périmètre (mandat §28) |
| `server/controllers/hotelController.js` (accès scope) | Pas de `restrictTo` direct — résolu via `HotelStaffAssignment` | HOTEL_SCOPED | Non | Système spécialisé, jamais à transformer en capacité globale (mandat §24, §37) |
| `server/routes/paiementRoutes.js:18` | `restrictTo('Admin')` | AUTHORIZATION | Non | Déjà strict, `payments.reverse` gère le cas capacité-gated séparément |
| `server/routes/financialRoutes.js:28` | `restrictTo(...STAFF_IMMO)` | AUTHORIZATION | Non | Fonctionnel |
| `server/controllers/financialController.js` (logique fine) | Délégué à `financialAuthorizationService` | FINANCIAL_SCOPED | Non | Système spécialisé, invariants financiers (mandat §25, §38) |
| `server/routes/litigeRoutes.js:16,17,20,22` | `restrictTo(...ROLES_LITIGES)` | AUTHORIZATION | Non | Alias sémantique conservé |
| `server/routes/platformOperatorRoutes.js:15` | `restrictTo('Admin')` (routeur) | AUTHORIZATION | Non | `PlatformOperator` a son propre modèle de contexte, ne pas simplifier vers Admin (mandat §23) |
| `server/routes/organizationRoutes.js:18,19,21-23` | `restrictTo('Admin')` | TENANT | Non | Portée organisation/tenant, pas une simple permission staff |
| `server/routes/platformTenantRoutes.js:35` | `restrictTo('Admin')` (routeur) | TENANT | Non | Idem |
| `server/routes/reportingRoutes.js:14` | `restrictTo(...DIRECTION)` où `DIRECTION = ['Admin','GestionnaireImmobilier']` (constante locale à ce seul fichier) | LEGACY | **Non — vérifié, pas mort** | `DIRECTION` a un seul point d'usage mais reste réellement exercé par la route reporting ; ce n'est pas une duplication de `CANONICAL_IMMO_STAFF_ROLES` (Collaborateur en est exclu ici, délibérément — contrat différent) ; renommer/fusionner sans preuve produit serait un changement de permission déguisé, donc conservé tel quel |
| `server/controllers/commentController.js:158` | `req.user.role === 'Admin'` | AUTHORIZATION | Non | Check isolé, faible valeur à migrer pour un seul site |
| `server/controllers/dashboardAnalyticsController.js:153,160,162` | `req.user.role === 'Proprietaire'` combiné à `sameTenant`/`isOwner` | TENANT + OWNERSHIP | Non | Mixte, aucune capacité ne remplacerait la double vérification |

**Verdict backend** : aucune conversion supplémentaire effectuée. Le seul élément initialement suspecté "LEGACY/DEAD" (`DIRECTION`, `reportingRoutes.js`) a été vérifié comme réellement fonctionnel et intentionnellement distinct de `CANONICAL_IMMO_STAFF_ROLES` — reclassé KEEP après vérification, conformément à la règle conservatrice du mandat §9 ("en cas de doute, ne pas supprimer").

## Web — pages dashboard restantes (hors `AdminDashboard.jsx`/`RoleDashboardOverview.jsx`, déjà migrées, et `GestionLocativePage.jsx`/`TransactionsPage.jsx`, déjà caractérisées RBAC-3)

| Fichier:ligne | Check | Catégorie | Migrer ? | Pourquoi |
|---|---|---|---|---|
| `RentalLeasesPage.jsx:86` | `isStaffImmo(user)` | AUTHORIZATION_STAFF | Non | Candidat futur (`can('properties.update')`, parité prouvée RBAC-1/2) mais hors du pilote RBAC-3 délibérément restreint ; non exécuté dans RBAC-5 (pas un sprint de migration Web supplémentaire) |
| `PropertyAssetCockpitPage.jsx:39`, `ManagePropertiesPage.jsx:562,633` | `isStaffDocs(user)` | AUTHORIZATION_STAFF | Non | Idem — candidat non exécuté |
| `ManageEventsPage.jsx:19`, `ManageAccommodationsPage.jsx:27`, `ManageAltcomPage.jsx:655` | `['Admin','CommunityManager','Collaborateur'].includes(user?.role)` | AUTHORIZATION_STAFF | Non | Correspondrait à `can('altcom.manage')`/`can('events.manage')` avec parité probable, mais non vérifiée avec la même rigueur que le pilote RBAC-3 — non migré sans caractérisation dédiée |
| `ManagePropertiesPage.jsx:35` | `['Admin','CommunityManager','Collaborateur','GestionnaireImmobilier'].includes(user?.role)` | AUTHORIZATION_STAFF | Non | Idem |
| `HistoriquePage.jsx:147,153` | `user?.role === 'Admin'` → `router.replace('/dashboard')` | ROUTING | Non | Décide une destination de navigation, pas une autorisation de contenu — hors RBAC (mandat §37/§18 catégorie D) |
| `ExportMarketingPage.jsx:150,155` | `user?.role === 'Admin'` (gate de fetch) | AUTHORIZATION_STAFF | Non | Candidat mineur, un seul fichier, non migré |
| `MarketingDashboardPage.jsx:309` | `user?.role === 'Admin' || user?.role === 'CommunityManager'` → `canManage` | AUTHORIZATION_STAFF | Non | Candidat mineur, non migré |
| `ManageHotelsPage.jsx:67` | `user?.role === 'Proprietaire' ? 'owner' : 'admin'` (libellé/scope de formulaire) | BUSINESS_IDENTITY | Non | Identité métier, pas une permission staff — conservé (mandat §19) |
| `DashboardHome.jsx:81,84,191,419` | Mélange `STAFF_DOC_ROLES.includes`, `COLLAB_ROLES.includes`, `user?.role === 'Admin'` | AUTHORIZATION_STAFF / PRESENTATION | Non | Mélange de gates d'accès et de choix de libellé — non démêlé dans ce sprint, aucune preuve de divergence de sécurité trouvée |

**Verdict Web** : aucune migration supplémentaire au-delà de RBAC-3. Tous les checks `AUTHORIZATION_STAFF` restants sont des candidats documentés pour une **future** migration (hors RBAC-5, qui n'est pas un sprint d'expansion de la migration Web), pas des bugs de sécurité — le backend reste l'autorité réelle sur chacune de ces actions, indépendamment de ce que montre l'UI.

## Client / Proprietaire — vérification de non-suppression

Recherche exhaustive de `role === 'Client'`/`role === 'Proprietaire'` sur Web et Mobile : tous les sites trouvés pilotent une identité métier externe (affichage de "Mes biens", choix de endpoint de données, branchement de formulaire d'inscription) — aucun n'a été supprimé ni modifié par RBAC-5, conformément au mandat §19.
