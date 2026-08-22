# RBAC-3 — MATRICE DES FLUX D'AUTHENTIFICATION

| Flux | Endpoint/source | Rôle | Profils métiers | Tenant | Capacités | Consommateur |
|---|---|---|---|---|---|---|
| Login email/mot de passe | `POST /users/login` → `authController.login` → `createSendToken` | `user.role` (DB) | Non inclus (fetch séparé) | Non inclus | `getEffectiveCapabilities(user.role)`, ajouté dans `data.user.capabilities` | `LoginPage.jsx` → `auth.login(user, token)` → `AuthContext` state + `localStorage.user` |
| Signup / autres flux `createSendToken` | `authController.signup` et consorts | idem | — | — | idem | idem |
| Login Google (signIn déjà résolu) | `POST /auth/google` → `sendGoogleAuthResponse` | `user.role` (DB, vérifié backend via idToken Google) | Non inclus | Non inclus | `getEffectiveCapabilities(user.role)` dans `data.user.capabilities` | NextAuth `jwt` callback (`account.backendUser.capabilities`) → `token.capabilities` → `session.user.capabilities` |
| Login Google (fallback, pas de backendToken) | `POST /auth/google-token` (garde `x-nextauth-secret`) → `authController.googleGetToken` | `user.role` (DB) | Non inclus | Non inclus | `getEffectiveCapabilities(user.role)` dans la réponse JSON | NextAuth `jwt` callback (branche fallback) → `token.capabilities` |
| Refresh périodique NextAuth (plafonné 5 min) | `POST /auth/google-token` (rejoué sans `account`) | `user.role` (DB, relu à chaque refresh) | Non inclus | Non inclus | idem — recalculé à chaque refresh, jamais mis en cache au-delà de 5 min | `jwt` callback, branche `!account && token.accessToken` |
| Session React (consommation) | `useSession()` (NextAuth) → callback `session` | `session.user.role` | — | — | `session.user.capabilities` (projection de `token.capabilities`) | `AuthContext.jsx` (effet de sync Google → `googleUser.capabilities`) |
| Restauration de session (reload) | `localStorage.getItem('user')` | `parsedUser.role` | — | — | `parsedUser.capabilities` (présent si login post-RBAC-3, absent sinon) | `AuthContext` `initializeAuth()` |
| Auto-guérison session ancienne | `GET /users/me` → `userController.getUser` | `req.user.role` (JWT vérifié par `protect`) | Non inclus (flux séparé) | Non inclus | `getEffectiveCapabilities(user.role)`, exposé **uniquement** quand `requesterId === user._id` (même garde que `platformOperator`) | `AuthContext` effet auto-guérison (déclenché uniquement si `user.capabilities` n'est pas un tableau) |
| Profils métiers effectifs | `getEffectiveProfiles(userId)` (`userBusinessProfileService`) | — | `businessProfiles` (proprietaire_immobilier / exploitant_etablissement / locataire / client) | — | Non concerné — flux **indépendant** des capacités (mandat §13) | `AuthContext` (effet séparé, déclenché sur changement de `user._id`) |

## Points clés

- **Un seul point d'exposition backend réutilisé pour les capacités** (mandat §9) : le champ `capabilities` a été ajouté aux payloads d'identité déjà existants (`createSendToken`, `sendGoogleAuthResponse`, `googleGetToken`, `/me`) — aucune route `/api/capabilities` créée.
- **`/me` reste le seul endpoit à exposer les capacités d'un utilisateur autre que celui du token de connexion initiale** — gardé par la même vérification d'identité que `platformOperator` (mandat §12 : jamais les permissions d'un autre utilisateur).
- **`businessProfiles` reste un concept séparé**, chargé par un effet React distinct, jamais fusionné avec `capabilities` (mandat §13).
- **Le rôle est toujours dérivé du token vérifié côté backend** (`req.user` posé par `protect`), jamais d'un champ envoyé dans le corps de la requête — voir `RBAC3_SECURITY_MATRIX.md`.
