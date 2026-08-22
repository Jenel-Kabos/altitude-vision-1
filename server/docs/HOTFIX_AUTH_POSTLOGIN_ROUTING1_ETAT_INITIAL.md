# HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé depuis le début de la séquence RBAC — aucun commit créé, tout le travail reste en working tree).

`git diff --stat` : 24 fichiers modifiés (+601/-184), cumul RBAC-2→RBAC-5, aucun commit intermédiaire.

`git diff --check` : exit 0.

`git status --short` : 71 lignes (24 modifiés/supprimés + fichiers non suivis : tests et documents des sprints RBAC-1→5 et des hotfix précédents). Tout préservé, rien écrasé.

## Baseline héritée (ne pas refaire)

Séquence RBAC-1→RBAC-5 terminée et certifiée. Architecture d'autorisation à préserver strictement :
`User.role` → `server/utils/iamArchitecture.js` → `getEffectiveCapabilities()` → payload auth (login, `/auth/google`, `/auth/google-token`, `/me`) → `can(capability)` Web (`client/lib/context/AuthContext.jsx`) / Mobile (`altimmo-app/src/context/AuthContext.jsx`, non concerné par ce hotfix).

RBAC-3 (`RBAC3_SECURITY_MATRIX.md`) avait déjà identifié, sans les corriger : deux résolveurs distincts pour la destination post-login de `Proprietaire` — `client/lib/navigation/postAuthDestination.js`/`resolveOwnerDestination` (login email, inscription, vérification email) vs `client/app/auth/google-redirect/page.jsx` (login Google, hardcodé `/mes-biens`) — et avait recommandé ce hotfix séparé plutôt que de le traiter dans un sprint RBAC.

## Périmètre de ce hotfix

Uniquement la **destination** post-authentification (routing), jamais l'**autorisation** (qui peut accéder à quoi). Aucune modification de `User.role`, `businessProfiles`, `capabilities`, RBAC-1→5, Google OAuth (sauf lien direct avec le routing), backend de permissions, tenant, paiements, hôtels, Inbox Pro, menus, droits d'accès. Web uniquement — `altimmo-app/` non touché.

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement.
