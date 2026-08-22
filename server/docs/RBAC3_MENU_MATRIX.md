# RBAC-3 — MATRICE DE MENU (NAVIGATION STAFF)

Portée : `AdminDashboard.jsx` (`NAV_SECTIONS`) et `RoleDashboardOverview.jsx` (`PROFILE_DASHBOARDS`), les deux seuls points migrés vers `can()`.

## AdminDashboard — liens gated par `link.capability`

Chaque lien de `NAV_SECTIONS` porte soit un `capability`, soit un `roles`. Seule la branche `capability` a changé de mécanisme (voir `RBAC3_WEB_MIGRATION_MATRIX.md`) ; la branche `roles` (checks de rôles directs) reste inchangée et hors périmètre RBAC-3.

| Rôle | Avant (hasStaffCapability) | Après (can) | Différence |
|---|---|---|---|
| Admin | Tous les liens `capability` visibles (`*`) | Identique — `getEffectiveCapabilities('Admin')` retourne `ALL_CAPABILITIES` | Aucune |
| Collaborateur | Tous les liens `capability` visibles (`legacy.full`) | Identique — `getEffectiveCapabilities('Collaborateur')` retourne `ALL_CAPABILITIES` | Aucune |
| Secretaire | Liens `documents.*`, `payments.*`, `clients.read`, `owners.read`, `tenants.read`, `leases.read`, `properties.read` | Identique (parité `CAPABILITIES_BY_ROLE` ≡ `DEFAULT_CAPABILITIES` prouvée) | Aucune |
| GestionnaireImmobilier | Liens `properties.*`, `rental.*`, `leases.*`, `tenants.*`, `visits.*`, `maintenance.*`, `notice.*`, `occupancy.*`, `owners.read`, `payment.status` | Identique | Aucune |
| CommunityManager | Liens `altcom.*`, `events.*`, `media.*` | Identique | Aucune |
| Communicant | Liens `messages.*`, `visits.read` | Identique | Aucune |
| Rôle sans entrée dans `DEFAULT_CAPABILITIES`/`CAPABILITIES_BY_ROLE` (ex. `Proprietaire`, `Client`) | Aucun lien `capability` visible | Identique (`can()` retourne `false` pour toute capacité, `user?.capabilities` ne contenant que `properties.own`/`accommodation.own`/`client.self` selon le rôle) | Aucune |

**Vérifié par tests** : `AdminDashboardDomains.test.jsx` (Admin, CommunityManager, GestionnaireImmobilier, Collaborateur — 4/4 verts) et `DashboardResponsiveNavigation.test.jsx` (Admin — 5/5 verts).

## RoleDashboardOverview — modules par profil (`getVisibleProfileModules`)

| Rôle | Modules visibles avant | Modules visibles après | Différence |
|---|---|---|---|
| Secretaire | Documents, Paiements, Contrats, Locataires | Identique | Aucune |
| GestionnaireImmobilier | Biens en gestion, Baux, Visites, Maintenance, Préavis, Locataires | Identique | Aucune |
| CommunityManager | Altcom, Mila Events, Marketing | Identique | Aucune |

**Vérifié par test** : `dashboardProfiles.test.js` (3/3 verts, inchangé — il teste `dashboardProfiles.js` directement avec un prédicat `can` construit sur `CAPABILITIES_BY_ROLE`, indépendant du changement dans `RoleDashboardOverview.jsx`).

## Hors périmètre (non modifié, documenté pour mémoire)

Les listes de rôles locales à `AdminDashboard.jsx` (`ALL_STAFF`, `ROLES_ESTIM`, `ROLES_ALTIMMO`, `ROLES_CM`, `ROLES_DOCS`, `ROLES_LITIGES`, `ROLES_MOD`) continuent de gater d'autres liens via `link.roles` — non migrées vers `can()` dans ce sprint (mandat §24-25, périmètre pilote restreint). Aucune régression de navigation introduite pour ces liens : le code correspondant n'a pas été touché.
