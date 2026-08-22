# RBAC-1 — Matrice des duplications

Toutes les lignes ci-dessous sont sourcées par lecture directe de fichier:ligne (audit read-only, 3 agents de recherche + vérifications manuelles). Aucune n'a été corrigée.

## A. Duplication manuelle triple — la plus concrète (capacités par rôle)

| Règle | Backend source | Web duplicate | Mobile duplicate | Drift ? |
|---|---|---|---|---|
| Capacités par rôle staff (`documents.*`, `properties.*`, `rental.*`, `visits.*`, `altcom.*`, `events.*`, `messages.*`...) | `server/utils/iamArchitecture.js` `DEFAULT_CAPABILITIES` (10 rôles, `Admin:['*']`) — **canonique et réellement appliqué** via `capabilityMiddleware.requireCapability(...)`, câblé dans 10 fichiers de routes (`rentalManagementRoutes.js`, `documentRoutes.js`, `eventRoutes.js`, `visiteRoutes.js`, `rentalMaintenanceRoutes.js`, `altcomRoutes.js`, `gestionDocumentRoutes.js`, `locataireRoutes.js`, `contratRoutes.js`, `paiementRoutes.js`) | `client/lib/utils/staffCapabilities.js` `CAPABILITIES_BY_ROLE` — copie manuelle **identique valeur pour valeur** pour les 6 rôles staff (omet Proprietaire/Client/User/Prestataire, absents du besoin UI) | `altimmo-app/src/utils/staffCapabilities.js` `CAPABILITIES_BY_ROLE` — troisième copie manuelle, structure identique (confirmé par l'agent mobile : "manual mirror of server/utils/iamArchitecture.js and the web client's copy") | **OUI — 3 copies manuelles de la même table.** Aucun mécanisme ne garantit leur synchronisation ; toute évolution backend (ajout d'une capacité, changement de rôle) doit être répliquée à la main 2 fois. Web l'utilise réellement (nav `AdminDashboard.jsx`, `RoleDashboardOverview.jsx`) ; **mobile ne l'utilise nulle part** (dead code, confirmé par l'agent mobile — un seul commentaire y fait référence pour expliquer pourquoi il n'est délibérément PAS utilisé sur un écran hôtel). |

## B. Duplication du groupe "staff complet" (`STAFF_ALL` / `ALL_STAFF`)

| Règle | Backend source | Web duplicate | Drift ? |
|---|---|---|---|
| `['Admin','Collaborateur','Secretaire','GestionnaireImmobilier','CommunityManager','Communicant']` | `server/utils/roles.js` `STAFF_ALL`/`ALL_STAFF` (canonique) | Redéfini indépendamment dans **8 fichiers** : `AuthContext.jsx:47` (`COLLAB_ROLES`+Admin séparé), `postAuthDestination.js:1` (`STAFF_ROLES` Set), `app/auth/google-redirect/page.jsx:8` (`COLLAB_ROLES`), `app/dashboard/layout.jsx:12-19` (`ALLOWED_ROLES`), `Header.jsx:52` (`STAFF_ROLES`), `NotificationBell.jsx:18` (`STAFF_ROLES`), `AdminDashboard.jsx:30` (`ALL_STAFF`), `UsersPanel.jsx:23`+`DashboardHome.jsx:31` (`COLLAB_ROLES`) | **OUI, drift avéré** : `lib/pages/MessagesPage.jsx:51` définit `STAFF_ROLES = ["Admin","Collaborateur"]` **seulement** — omet Secretaire/GestionnaireImmobilier/CommunityManager/Communicant, contrairement aux 8 autres copies. Conséquence fonctionnelle réelle (pas juste cosmétique) : ces 4 rôles ne sont PAS redirigés hors de la page publique `/messages`, alors que `Header.jsx`/`NotificationBell.jsx` les traitent bien comme staff. **Classé P2** (incohérence UX/navigation, aucune fuite de sécurité — le backend reste seul juge via `ALL_STAFF`/`restrictTo` sur les vraies routes de messagerie staff). |

## C. Duplication `STAFF_IMMO` (Property/Gestion Locative)

| Règle | Backend source | Web duplicate | Drift ? |
|---|---|---|---|
| `['Admin','GestionnaireImmobilier','Collaborateur']` | `server/utils/roles.js` `STAFF_IMMO` = `server/utils/roles.js` `ROLES_ALTIMMO` = `server/utils/roles.js` `ROLES_GL` = `server/utils/roles.js` `ROLES_LITIGES` — **4 constantes backend distinctes, valeurs strictement identiques** (drift interne au backend lui-même, voir section F) | `client/lib/utils/staffRoles.js` `STAFF_IMMO_ROLES`/`isStaffImmo()` — copie fidèle, **correctement réutilisée** dans 6 composants (`AssetLifecycleCard.jsx`, `LeaseLifecycleDrawer.jsx`, `LeaseLifecycleCard.jsx`, `CautionPanel.jsx`, `RentalLeasesPage.jsx`) — **mais PAS partout** : `AdminDashboard.jsx:32,76,94` redéfinit inline (2 ordres différents, sans utiliser `isStaffImmo`), `GestionLocativePage.jsx:1308,1737` réduit à 2 rôles (`Admin`+`GestionnaireImmobilier`, **exclut Collaborateur**), `TransactionsPage.jsx:331` réduit à `['Admin','Collaborateur']` (**exclut GestionnaireImmobilier**) | **OUI, drift avéré à 2 endroits distincts** — `GestionLocativePage.jsx` et `TransactionsPage.jsx` divergent chacun dans une direction différente de `isStaffImmo`. **Classé P1** : incohérence forte (deux pages du même domaine Gestion Locative n'accordent pas le même périmètre de rôles) — nécessite caractérisation précise en RBAC-2 pour déterminer laquelle est correcte au regard du backend réel. |

## D. Duplication `STAFF_DOC`/`ROLES_DOCS` (Documents/Paiements)

| Règle | Backend source | Web duplicate | Drift ? |
|---|---|---|---|
| `['Admin','Secretaire','Collaborateur']` | `server/utils/roles.js` `STAFF_DOC` **et** `ROLES_DOCS` **et** `ROLES_PAIEMENTS` — 3 constantes backend, même valeur, ordres différents (`STAFF_DOC`: Admin,Secretaire,Collaborateur ; `ROLES_DOCS`: Admin,Collaborateur,Secretaire) | `client/lib/utils/staffRoles.js` `STAFF_DOCS_ROLES`/`isStaffDocs()` — réutilisé correctement dans `ManagePropertiesPage.jsx`, `PropertyAssetCockpitPage.jsx` — mais `AdminDashboard.jsx:34` (`ROLES_DOCS` inline), `DashboardHome.jsx:82` (`STAFF_DOC_ROLES` inline, copie exacte non importée), `GestionLocativePage.jsx:1309,1738` (`canDoc` réduit à `['Secretaire','Collaborateur']`, Admin traité séparément par ailleurs) redéfinissent indépendamment | Cohérent en valeur finale malgré la redondance de définitions — **P3** (dette de maintenance, pas un drift de comportement observé). |

## E. Duplication `ROLES_CM` (Altcom/Mila Events)

| Règle | Backend source | Web duplicate | Drift ? |
|---|---|---|---|
| `['Admin','Collaborateur','CommunityManager']` | `server/utils/roles.js` `ROLES_CM` | `AdminDashboard.jsx:33` (`ROLES_CM` inline), `ManageEventsPage.jsx:19` (`canAddEvent`), `ManageAccommodationsPage.jsx:27` (`canCreate`), `ManageAltcomPage.jsx:655` (inline JSX) — 4 copies indépendantes, valeurs identiques | `MarketingDashboardPage.jsx:309` — `user.role==='Admin' || user.role==='CommunityManager'` **exclut Collaborateur**, contrairement aux 4 autres copies. **Classé P2** (incohérence UX au sein du même domaine Marketing/Altcom, pas de fuite de sécurité prouvée — page de gestion marketing, backend reste seul juge réel côté API). |

## F. Duplication interne au backend lui-même (avant même web/mobile)

`server/utils/roles.js` définit **4 constantes de valeur strictement identique** sous des noms différents : `STAFF_IMMO === ROLES_ALTIMMO === ROLES_GL === ROLES_LITIGES` (`['Admin','GestionnaireImmobilier','Collaborateur']`, ordre variable). De même, `STAFF_DOC` et `ROLES_DOCS` et `ROLES_PAIEMENTS` sont valeur-identiques. **C'est une duplication interne au fichier censé être la source canonique elle-même** — la première étape de nettoyage (RBAC-5) devrait fusionner ces alias avant même de toucher au web/mobile.

## G. Duplication du quartet `['Admin','Collaborateur','GestionnaireImmobilier','CommunityManager']` (backend)

Redéfini indépendamment, sans jamais importer de `roles.js` (aucune constante backend ne correspond exactement à cette combinaison), dans au moins 6 fichiers backend : `accommodationController.js:432,586`, `accommodationReservationController.js:19`, `hotelReservationController.js:306`, `financialController.js:31` (variante à 5 avec Secretaire), `services/accommodationReservationService.js:21,105`. Classé **P1** : c'est un groupe fonctionnel réel et récurrent (accès accommodation/hotel staff) qui n'a jamais reçu de constante canonique propre — candidat naturel pour une nouvelle constante `ROLES_HEBERGEMENT` en RBAC-2/5.

## H. Duplication du trio `['Admin','Collaborateur','Secretaire']` (backend, hors `STAFF_DOC`)

- `accommodationReservationController.js:98` (`accountingRoles`)
- `services/finance/financialAuthorizationService.js:56` (`ACCOUNTING_ROLES`)

Valeur strictement identique à `STAFF_DOC`/`ROLES_DOCS`/`ROLES_PAIEMENTS` mais redéfinie localement plutôt qu'importée. **P3.**

## I. Duplication du groupe `['Admin','GestionnaireImmobilier']` (backend, Gestion Locative avancée)

Redéfini indépendamment dans 4 fichiers : `paiementController.js:435` (`CANCEL_ROLES`), `services/rentalContractRegularizationService.js:148`, `services/rentalManagementReconciliationService.js:197`, `services/rentalAssetOnboardingService.js:164`. Aucune constante `roles.js` ne correspond exactement (le plus proche, `STAFF_IMMO`, inclut aussi Collaborateur). **P2** — à vérifier si l'exclusion volontaire de Collaborateur ici est un choix métier documenté ou un oubli.

## J. Résolveurs de destination post-authentification — 3 implémentations divergentes (Web)

| Résolveur | Proprietaire → | Autres divergences |
|---|---|---|
| `lib/navigation/postAuthDestination.js` | `/mon-espace-proprietaire` | Client → `/mon-espace` |
| `app/auth/google-redirect/page.jsx` | `/mes-biens` | Client/autres → `/altimmo/annonces` |
| `app/dashboard/layout.jsx` `REDIRECT_BY_ROLE` | `/mes-biens` | Client/Prestataire → `/` |

**Drift avéré, classé P1** : un même rôle `Proprietaire` est redirigé vers **deux URLs différentes** selon le point d'entrée (connexion classique vs connexion Google vs accès direct à `/dashboard` refusé). Comportement utilisateur incohérent, réel et observable — pas seulement une dette de code. À caractériser précisément en RBAC-2 (quel chemin un Proprietaire emprunte réellement selon son mode de connexion) avant toute unification.

## K. Convention de casse du rôle — Web/Backend vs Mobile

Le backend et le web comparent systématiquement la valeur exacte capitalisée (`'Proprietaire'`, `'Admin'`). Le mobile introduit une convention **différente et incompatible** : `AuthContext.jsx` et `ProfilScreen.jsx` comparent `user?.role?.toLowerCase()` à des littéraux minuscules (`'proprietaire'`, `'admin'`). Chaque site mobile est interne cohérent (aucun bug actif détecté), mais `shared/types/domain.ts` documente même un type TypeScript avec des littéraux minuscules — renforçant la coexistence de deux conventions incompatibles dans le même monorepo. **P2** (dette/risque latent — un futur copier-coller d'un littéral capitalisé dans une branche mobile lowercased, ou l'inverse, échouerait silencieusement).

## L. Libellés de casse erronés (accentués), jamais un vrai rôle

- `client/lib/pages/dashboard/ActiveSessionsPage.jsx:112-113` — compare `session.role === 'Propriétaire'` (avec accent) — ne correspond **jamais** à la valeur réelle de l'enum (`'Proprietaire'`, sans accent). Effet réel : purement cosmétique (couleur de badge dans un tableau de sessions actives), tombe silencieusement sur la couleur par défaut. **P3.**
- `client/lib/pages/DashboardPage.jsx:26` et `client/lib/components/layout/Navbar.jsx` — même faute de frappe, mais dans un fichier confirmé **legacy/mort** (React-Router, `userInfo` jamais exposé par `AuthContext` actuel) — **P3, code mort, sans impact réel**.

## M. `RoleProtectedRoute.jsx` — composant mort

`client/lib/components/RoleProtectedRoute.jsx` définit un garde générique `allowedRoles` mais **n'est consommé nulle part** dans le codebase (confirmé par l'agent web — seules les auto-références dans sa propre définition). Toute la protection par rôle réelle passe par `app/dashboard/layout.jsx` (garde ad hoc) ou par du contrôle inline par page. **P3** (dette — composant construit puis jamais adopté).

## N. `navigationSdk.canAccessDestination` (mobile) — fonction morte

`altimmo-app/src/navigation/navigationSdk.js:18-25` définit un gate générique rôle+profil basé sur `shared/navigation/registry.json`, mais **n'est appelé nulle part** dans `altimmo-app/src/` — le contrôle d'accès réel mobile se fait écran par écran, de façon ad hoc. **P3.**
