# RBAC-1 — Matrice de couverture de tests

Méthode : recensement des fichiers de test existants par domaine/mécanisme (comptage direct, pas d'exécution — RBAC-1 ne modifie aucun test).

| Domaine / mécanisme | Tests backend permissions ? | Tests frontend visibility ? | Tests mobile visibility ? | Cross-tenant ? | Ownership ? |
|---|---|---|---|---|---|
| Tenant scope / cross-tenant (transversal) | **Très forte — 25+ fichiers** dédiés (`tenantCert*`, `tenantHardening*`, `tenantScopeAudit1/2a/2b*`, `platformAdminCert1.*`), incluant plusieurs rounds "adversarial" explicites | Non applicable directement (concept backend) | Non applicable | **OUI — le mécanisme le mieux couvert de tout le codebase** | Partiellement (via les mêmes suites) |
| `restrictTo`/rôles globaux (403 attendu selon rôle) | Modérée — 67 fichiers de test référencent une assertion `403`, mais la majorité teste un domaine fonctionnel avec le rôle comme effet de bord, pas le RBAC lui-même de façon systématique | `PropertyModerationPage.test.jsx`, `ManagePropertiesPage.test.jsx` (2 fichiers seulement touchent explicitement rôle/visibilité) | 2 fichiers seulement (`ProfilScreenMyProperties.test.jsx` couvre le cas Proprietaire/Admin/Client ; un autre fichier non détaillé ici) | Voir ligne tenant | Property (`checkPropertyOwnership` a un test dédié mais le middleware lui-même est **mort**, non câblé) |
| `HotelStaffAssignment` / capacités hôtel | NON CONFIRMÉ précisément dans cet audit (existence de tests hôtel nombreux, mais couverture spécifique aux capacités non quantifiée ici) | Aucun test trouvé | Aucun test trouvé | NON CONFIRMÉ | NON CONFIRMÉ |
| `financialAuthorizationService` (capacités financières) | NON CONFIRMÉ précisément quantifié | Aucun test trouvé | Aucun test trouvé | NON CONFIRMÉ | NON CONFIRMÉ |
| `PlatformOperator` (capacités plateforme) | Présumé couvert par `platformAdminCert1.*`/`platformAdmin1.adversarial.*` (2 fichiers dédiés identifiés) | `PlatformTenantRuntimeContext` non testé explicitement dans cet audit | NON CONFIRMÉ | OUI (via les mêmes fichiers) | Non applicable |
| `server/utils/iamArchitecture.js` (`requireCapability`) | `iamArchitecture.test.js` existe (1 fichier dédié identifié) | Aucun test de la copie web (`staffCapabilities.js`) trouvé | Aucun test de la copie mobile trouvé (cohérent avec le fait qu'elle soit du code mort) | Non applicable | Non applicable |
| Business profiles (`UserBusinessProfile`) | Présumé couvert par `tenantScopeAudit2bBusinessProfiles.mongo.integration.test.js` | Aucun test de `isProprietaireImmobilier`/`isExploitantEtablissement` isolé trouvé (logique testée indirectement via `ProfilScreenMyProperties.test.jsx` côté mobile uniquement) | `ProfilScreenMyProperties.test.jsx` (couvre le cas businessProfiles vide vs peuplé) | Voir tenantScopeAudit2b | Dérivation testée indirectement |
| Duplications identifiées (`RBAC1_DUPLICATION_MATRIX.md`) | **Aucun test ne protège contre la dérive entre les copies** (backend/web/mobile de `iamArchitecture`, groupes `STAFF_*`) — confirmé : aucun test de type "snapshot des constantes" ou "égalité entre les 3 copies" trouvé | idem | idem | Non applicable | Non applicable |

## Zones sans couverture identifiées (à combler en RBAC-2, pas dans RBAC-1)

1. **Aucun test ne vérifie que les 3 copies de `DEFAULT_CAPABILITIES`/`CAPABILITIES_BY_ROLE` (backend/web/mobile) restent synchronisées** — un changement dans l'une peut diverger silencieusement des deux autres sans qu'aucun test ne le détecte.
2. **Aucun test ne vérifie que les groupes `roles.js` (`STAFF_IMMO`, `ROLES_ALTIMMO`, `ROLES_GL`, `ROLES_LITIGES` — valeur identique, noms différents) restent synchronisés entre eux** au sein même du backend.
3. **La visibilité de menu web (`AdminDashboard.jsx NAV_SECTIONS`) n'a aucun test dédié** — aucun test ne vérifie que chaque lien affiché correspond réellement à une route backend accessible par les mêmes rôles (le type de drift documenté en §Emails/§Estimations de `RBAC1_FRONTEND_MENU_MATRIX.md` n'aurait été détecté par aucun test existant).
4. **Le mobile n'a quasiment aucun test de visibilité par rôle** en dehors du travail réalisé lors du sprint `HOTFIX-MOB-PROFILE-MY-PROPERTIES-LINK-1` de cette même session (2 fichiers seulement au total).
5. **`checkPropertyOwnership` (middleware mort) a un test qui passe** alors que le middleware n'est câblé sur aucune route réelle — un faux sentiment de couverture (le test valide une fonction jamais appelée en production).
6. **Les résolveurs de destination post-authentification divergents (`RBAC1_DUPLICATION_MATRIX.md` §J) n'ont aucun test comparatif** qui aurait pu détecter que `Proprietaire` reçoit 2 URLs différentes selon le point d'entrée.

## Zones fortement couvertes (à ne pas dupliquer en RBAC-2)

Tenant/cross-tenant est, de très loin, le mécanisme le mieux testé du codebase (25+ fichiers, plusieurs rounds adversariaux successifs) — toute évolution RBAC-2 touchant au tenant scope doit s'appuyer sur cette base existante plutôt que la refaire.
