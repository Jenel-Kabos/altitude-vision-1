# RBAC-3 — ÉTAT INITIAL

HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé — aucun commit créé pendant RBAC-1/RBAC-2/RBAC-3, tout le travail reste en working tree).

`git diff --check` : exit 0 à chaque étape de ce sprint (aucun conflit de fin de ligne / espace introduit).

Baseline héritée de RBAC-2 (CERTIFIÉ VERT) :
- Backend unit : 128/128 suites, 1473/1473 tests.
- Backend Mongo exhaustif : 97/97 suites, 974/974 tests.
- `server/utils/iamArchitecture.js` : source canonique des capacités staff (`DEFAULT_CAPABILITIES`, `getEffectiveCapabilities`, `assertKnownCapability`, `ALL_CAPABILITIES`, `ADMIN_ONLY_CAPABILITIES`).
- Une route pilote (`POST /property-asset/:id/transition`) déjà migrée vers `requireCapability('properties.update')`.
- `client/` et `altimmo-app/` non touchés par RBAC-2.

Périmètre RBAC-3 : faire consommer par le Web les capacités calculées côté backend (RBAC-2), sans jamais recréer un mapping rôle→capacités dans `client/`, sans déplacer la frontière de sécurité vers le frontend.

Fichiers modifiés par RBAC-3 (voir `RBAC3_WEB_MIGRATION_MATRIX.md` pour le détail) :
- `server/controllers/authController.js`, `server/controllers/userController.js` — exposition de `capabilities` sur les payloads d'identité déjà existants (login, `/auth/google`, `/auth/google-token`, `/me`).
- `client/app/api/auth/[...nextauth]/route.js` — threading `capabilities` dans les callbacks `jwt`/`session`.
- `client/lib/context/AuthContext.jsx` — helper canonique `can(capability)`, auto-guérison des sessions pré-RBAC-3.
- `client/lib/services/userService.js` — `getMe()`.
- `client/lib/pages/dashboard/AdminDashboard.jsx`, `client/lib/pages/dashboard/RoleDashboardOverview.jsx` — migration pilote (`hasStaffCapability` → `can`).
- Tests : `server/__tests__/propertyAssetRoutes.mongo.integration.test.js` (adversarial), `client/lib/__tests__/nextauthJwtCallback.test.js`, `client/lib/__tests__/AuthContextCan.test.jsx` (nouveau), deux fichiers de test existants adaptés (`AdminDashboardDomains.test.jsx`, `DashboardResponsiveNavigation.test.jsx`).

Aucun commit/push/déploiement effectué.
