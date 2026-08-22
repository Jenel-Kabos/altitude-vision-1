# RBAC-3 — MATRICE DE MIGRATION WEB

## Helper canonique

Un seul helper créé : `can(capability)` dans `client/lib/context/AuthContext.jsx`, exposé par `useAuth()`. Implémentation :

```js
const can = useCallback(
  (capability) => Boolean(user?.capabilities?.includes(capability)),
  [user]
);
```

- Capacité absente ou `user.capabilities` non défini → `false` (fail closed, mandat §20).
- Aucune deuxième abstraction créée (`hasCapability`, `userCan`, `checkPermission` — mandat §18-19 respecté).

## Audit de `client/lib/utils/staffCapabilities.js` (mandat §23)

| Export | Consommateurs avant RBAC-3 | Statut après RBAC-3 |
|---|---|---|
| `hasStaffCapability` | `AdminDashboard.jsx:377`, `RoleDashboardOverview.jsx:13` | **MIGRÉ** — les deux remplacés par `can(capability)`. Plus aucun consommateur en code de production. |
| `CAPABILITIES_BY_ROLE` | Utilisé en interne par `hasStaffCapability` ; importé aussi par `client/lib/__tests__/dashboardProfiles.test.js` comme fixture de test (pas un consommateur de production) | **ENCORE RÉFÉRENCÉ EN TEST UNIQUEMENT** |

`staffCapabilities.js` lui-même **non supprimé** : son propre fichier de test (`client/lib/__tests__/staffCapabilities.test.js`) continue de le tester, et le mandat §23 interdit explicitement la suppression tant qu'un consommateur existe encore, même en test. Sa suppression complète (fichier + tests associés) est un candidat **RBAC-5** une fois prouvé qu'aucun test ne s'y réfère plus.

Preuve de parité ayant autorisé la migration : `server/utils/iamArchitecture.js` `DEFAULT_CAPABILITIES` et `client/lib/utils/staffCapabilities.js` `CAPABILITIES_BY_ROLE` sont **strictement identiques** (mêmes clés, mêmes valeurs, même ordre) pour `Secretaire`, `GestionnaireImmobilier`, `CommunityManager`, `Communicant` ; `Admin`/`Collaborateur` utilisent les mêmes jokers `*`/`legacy.full` des deux côtés. Vérifié par lecture directe des deux fichiers avant migration.

## Pilote migré

| Fichier | Avant | Après | Preuve de parité |
|---|---|---|---|
| `client/lib/pages/dashboard/AdminDashboard.jsx:377` | `link.capability ? hasStaffCapability(user, link.capability) : (...)` | `link.capability ? can(link.capability) : (...)` | Même donnée source (`CAPABILITIES_BY_ROLE` ≡ `DEFAULT_CAPABILITIES`), même sémantique (jokers `*`/`legacy.full` couvrant tout, sinon `.includes`) — tests `AdminDashboardDomains.test.jsx` (4/4) et `DashboardResponsiveNavigation.test.jsx` (5/5) rejoués verts après adaptation de leurs mocks `useAuth`. |
| `client/lib/pages/dashboard/RoleDashboardOverview.jsx:13` | `getVisibleProfileModules(user?.role, capability => hasStaffCapability(user, capability))` | `getVisibleProfileModules(user?.role, can)` | `dashboardProfiles.test.js` (3/3) inchangé et vert — il teste `dashboardProfiles.js` indépendamment, non affecté par ce changement. |

## Pourquoi ce périmètre et pas plus large

Ces deux fichiers étaient les **seuls consommateurs réels** du duplicata `staffCapabilities.js` — la cible la plus directe du mandat §3 (interdiction de dupliquer le mapping rôle→capacités). Les autres ~60 checks de rôle Web identifiés par RBAC-1 (`isStaffImmo`, `isStaffDocs`, listes de rôles locales dans `AdminDashboard.jsx` comme `ROLES_ALTIMMO`/`ROLES_CM`/`ROLES_DOCS`, checks inline dans `GestionLocativePage.jsx`/`TransactionsPage.jsx`) ne sont **pas** un mapping rôle→capacités dupliqué au sens du mandat — ce sont des listes de rôles directes, une pratique différente et plus large que RBAC-3 ne mandate pas de migrer intégralement (mandat §24-25 : périmètre pilote délibérément restreint).

`isStaffImmo`/`isStaffDocs` (`client/lib/utils/staffRoles.js`) n'ont **pas** été migrés dans ce sprint : leurs consommateurs (`AssetLifecycleCard.jsx`, `LeaseLifecycleDrawer.jsx`, `LeaseLifecycleCard.jsx`, `CautionPanel.jsx`, `RentalLeasesPage.jsx`, `ManagePropertiesPage.jsx`, `PropertyAssetCockpitPage.jsx`) restent inchangés. Une caractérisation complète des deux pages divergentes (`GestionLocativePage.jsx`, `TransactionsPage.jsx`) a été menée (voir `RBAC3_SECURITY_MATRIX.md` §Divergences caractérisées) mais aucune correction n'a été appliquée, faute de mandat explicite de les migrer dans ce sprint — recommandé pour un futur sprint RBAC dédié.

## Tests ajoutés

- `client/lib/__tests__/nextauthJwtCallback.test.js` : 9 tests (7 existants étendus avec assertions `capabilities`, 2 nouveaux sur le callback `session`).
- `client/lib/__tests__/AuthContextCan.test.jsx` (nouveau) : 7 tests — `can()` avec capacité présente/absente, session absente, projection Google, auto-guérison réussie, auto-guérison en échec réseau.
- `server/__tests__/propertyAssetRoutes.mongo.integration.test.js` : 3 tests adversariaux (role/capabilities forgés dans le body, ignorés par le backend).
