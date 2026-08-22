# HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — MATRICE DE SÉCURITÉ

## Principe : ce hotfix ne change aucune autorisation

`getPostAuthDestination(user)` ne fait que choisir une URL de destination après une authentification déjà réussie. Aucune route protégée n'a été modifiée : `ProtectedRoute.jsx`, `RoleProtectedRoute.jsx`, tous les guards `restrictTo`/`requireCapability` backend restent strictement inchangés (fichiers non touchés — voir `git status`). Un utilisateur qui atterrit sur une mauvaise page suite à l'ancien bug n'obtenait jamais un accès non autorisé : la page elle-même (`/mes-biens`, `/altimmo/annonces`) applique ses propres règles d'accès indépendamment de la manière dont on y arrive.

## Open redirect

- `LoginPage.jsx:21-22` : `requestedRedirect` (paramètre `?redirect=`) n'est accepté que s'il commence par `/` et pas par `//` (`safeRedirect`) — protection déjà existante, non touchée, revérifiée présente et fonctionnelle.
- `signIn('google', { callbackUrl: safeRedirect || '/auth/google-redirect' })` (`LoginPage.jsx:209`) : ne peut recevoir qu'une valeur déjà filtrée par `safeRedirect`, jamais une URL externe brute.
- `RegisterPage.jsx:214` : `callbackUrl` toujours la valeur littérale fixe `/auth/google-redirect`, jamais de paramètre utilisateur.
- NextAuth applique en plus sa propre validation d'origine sur `callbackUrl` (comportement par défaut d'Auth.js, non configuré différemment ici — `trustHost: true` gère la confiance de l'hôte entrant, pas l'acceptation de callbackUrl arbitraires).
- **Verdict : aucun open redirect possible, ni avant ni après ce hotfix** — le correctif ne touche à aucun de ces points de validation, il corrige uniquement la logique de résolution *après* que la destination sûre `/auth/google-redirect` a été atteinte.

## `trustHost: true` et configuration OAuth

`client/app/api/auth/[...nextauth]/route.js` — fichier **non modifié** par ce hotfix. `trustHost: true` (HOTFIX-WEB-GOOGLE-AUTH-1) intact. Aucun callback NextAuth (`signIn`, `jwt`, `session`) modifié. Le contrat d'intent Google (signup+absent→création, signup+existant→409/pas de session) est géré côté backend (`authController.googleAuth`/`sendGoogleAuthResponse`) et côté `AuthContext`/`LoginPage`/`RegisterPage`, aucun fichier de cette chaîne modifié.

## Cas adversariaux

- **Login échoué** : `LoginPage.jsx` `handleLogin` catch-block ne navigue jamais en cas d'erreur (`setError`, pas de `router.replace`) — inchangé.
- **Annulation Google** : gérée dans `AuthContext.jsx` `loginWithGoogle` (codes `SIGN_IN_CANCELLED`/`ERR_CANCELED`) côté mobile ; côté Web, une annulation Google ne déclenche jamais `signIn` avec succès, donc jamais de session, donc `google-redirect/page.jsx` ne serait atteint qu'en cas de redirection manuelle sans session — traité par la branche `status === 'unauthenticated'` → `/login`. Vérifié par le test "session non authentifiée renvoie vers /login".
- **Erreur Google (échec réseau/backend)** : `signIn('google', ...)` échoue avant même d'atteindre `/auth/google-redirect` avec une session valide — même traitement que ci-dessus.
- **Rôle inconnu** : `getPostAuthDestination` retombe sur `/` (comportement préexistant, non modifié) — testé (`postAuthDestination.test.js`, non touché, toujours vert) et re-confirmé via Google (`googleRedirectPage.test.jsx`, cas `undefined`).
- **User switch (Admin logout → Proprietaire login)** : `google-redirect/page.jsx` ne conserve aucun état entre deux sessions — chaque montage relit `session.user.role` depuis NextAuth au moment présent ; `/login` reste accessible sans redirection forcée (voir `HOTFIX_AUTH_POSTLOGIN_ROUTING1_ROUTE_MATRIX.md`, note sur `PublicAuthRoute.jsx`), permettant un changement de compte volontaire sans destination résiduelle `/dashboard`.

## `businessProfiles` et `capabilities` — non utilisés pour le routing, comme exigé

`getPostAuthDestination(user)` ne lit que `user.role` — jamais `user.capabilities` ni `user.businessProfiles`. La résolution fine par profil métier (`/mes-biens` vs `/mes-hotels` vs chooser) reste entièrement déléguée à `OwnerContextLanding.jsx`/`resolveOwnerDestination`, un second niveau non modifié par ce hotfix. Aucune capacité RBAC staff n'a été utilisée pour déterminer une destination d'identité externe (mandat §14).

## Fichiers modifiés — récapitulatif de sécurité

Un seul fichier de production modifié : `client/app/auth/google-redirect/page.jsx` (suppression de `getTargetPath`/`COLLAB_ROLES` locaux, appel à `getPostAuthDestination` importé). Aucun fichier backend, aucun fichier `altimmo-app/`, aucun fichier de configuration NextAuth, aucun fichier de garde d'autorisation (`ProtectedRoute.jsx`, `RoleProtectedRoute.jsx`, middleware, `restrictTo`, `requireCapability`) touché.
