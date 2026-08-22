# HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — RAPPORT

**Verdict : CERTIFIÉ VERT.**

Le drift caractérisé par RBAC-3 pour `Proprietaire` (destinations différentes selon email vs Google) provenait d'un seul point : `client/app/auth/google-redirect/page.jsx` réimplémentait localement sa propre logique de résolution (`getTargetPath`) au lieu de réutiliser le résolveur canonique déjà en place et déjà consommé par 3 flows email (`getPostAuthDestination`, `client/lib/navigation/postAuthDestination.js`). Corrigé par suppression de la logique locale et appel direct au résolveur canonique. Aucune permission, capacité, ou règle d'accès modifiée — uniquement la destination post-authentification.

## Réponses aux 40 questions du mandat

1. **Combien de resolvers post-login existaient ?** 2 résolveurs de premier niveau (`getPostAuthDestination`, `getTargetPath` local à `google-redirect/page.jsx`), plus un second niveau non concurrent (`resolveOwnerDestination`, consommé par `getPostAuthDestination` via `OwnerContextLanding.jsx` pour affiner la destination Proprietaire) — pas 3 résolveurs de même niveau comme le supposait RBAC-1.
2. **Quels fichiers ?** `client/lib/navigation/postAuthDestination.js` (canonique) et `client/app/auth/google-redirect/page.jsx` (local, corrigé). Second niveau : `client/lib/navigation/ownerContext.js` + `client/lib/pages/dashboard/OwnerContextLanding.jsx` (non modifiés).
3. **Quelles destinations Proprietaire utilisaient-ils ?** Canonique : `/mon-espace-proprietaire` (puis résolution fine). Google (avant fix) : `/mes-biens` directement, sans jamais consulter `businessProfiles`.
4. **Quelle destination est canonique ?** `/mon-espace-proprietaire`, qui délègue ensuite à `resolveOwnerDestination(businessProfiles)`.
5. **Quelle preuve ?** `postAuthDestination.js` est déjà consommé par 3 flows de production (`LoginPage.jsx`, `RegisterPage.jsx`, `VerifyEmailPage.jsx`) avant ce hotfix, contre 1 seul pour l'ancien resolver Google — c'est le résolveur dominant et le seul qui respecte le mécanisme `businessProfiles`/chooser multi-profil déjà construit (`OwnerContextLanding.jsx`).
6. **Client destination canonique ?** `/mon-espace`, prouvée par le même raisonnement (3 flows email contre 1 Google divergent).
7. **Staff destination canonique ?** `/dashboard` — déjà cohérent entre les deux resolvers avant ce hotfix, non modifié.
8. **User legacy ?** `/` (fallback générique du résolveur canonique) — comportement préexistant conservé, converti côté Google pour converger (auparavant `/altimmo/annonces`, jamais utilisé côté email).
9. **Prestataire ?** Idem — `/`.
10. **Une fonction canonique existait-elle ?** Oui — `getPostAuthDestination`.
11. **A-t-elle été réutilisée ?** Oui — importée et appelée directement dans `google-redirect/page.jsx`.
12. **Sinon, quelle fonction a été créée ?** Aucune nouvelle fonction créée (mandat §15 : chercher d'abord si une fonction existe déjà — trouvée, réutilisée).
13. **Combien de switch/map rôle restent pour post-login ?** 1 — uniquement `getPostAuthDestination` lui-même (interne : une suite de conditions, pas un switch/map dupliqué). `getTargetPath`/`COLLAB_ROLES` supprimés.
14. **Login email utilise-t-il le resolver canonique ?** Oui (déjà, avant ce hotfix).
15. **Google login ?** Oui — corrigé par ce hotfix.
16. **Signup email ?** Oui (`RegisterPage.jsx`, déjà avant ce hotfix, garde de redirection si déjà authentifié).
17. **Google signup ?** Oui — même point d'entrée `google-redirect/page.jsx` que le login Google (le contrat `isNewUser` redirige d'abord vers `/completer-profil`, puis un signup Google réussi ultérieur retombe sur le même resolver, désormais corrigé).
18. **Restore session ?** N/A pour `google-redirect` (page transitoire, pas un point de restauration) ; `/login`/`/register` revisités par une session déjà active utilisent le résolveur canonique (`RegisterPage.jsx`) ou n'ont pas de redirection automatique (`/login`, documenté, non corrigé).
19. **Les businessProfiles modifient-ils le routing ?** Oui, mais uniquement au second niveau (`resolveOwnerDestination`), jamais au premier niveau (`getPostAuthDestination` ne lit que `role`).
20. **Pourquoi ?** Mandat §12-13 : la destination post-login doit rester une règle simple basée sur le rôle ; l'affinage multi-profil reste une étape en aval déjà construite, pas à dupliquer dans le résolveur de premier niveau.
21. **Capabilities utilisées pour routing externe ?** Non.
22. **Pourquoi ou pourquoi pas ?** Mandat §14 : les capacités RBAC staff ne remplacent jamais l'identité métier externe ; `getPostAuthDestination` ne lit que `user.role`.
23. **`trustHost:true` intact ?** Oui — fichier `route.js` non modifié.
24. **Google intent intact ?** Oui — aucun fichier du contrat d'intent (`authController.js`, `AuthContext.jsx`, `LoginPage.jsx`/`RegisterPage.jsx` côté logique d'intent) modifié ; seule la résolution de destination *après* succès a changé.
25. **Open redirect protégé ?** Oui — `safeRedirect` (validation `startsWith('/')`/`!startsWith('//')`) déjà en place et non touchée, revérifiée présente ; `callbackUrl` de `RegisterPage.jsx` toujours une valeur littérale fixe.
26. **Unknown role safe ?** Oui — fallback `/`, testé explicitement pour Google (`undefined` → `/`).
27. **Login failed safe ?** Oui — `LoginPage.jsx` ne navigue jamais en cas d'erreur, comportement non modifié.
28. **Google cancel safe ?** Oui — pas de session, `google-redirect/page.jsx` ne serait atteint qu'en `unauthenticated` → `/login`, testé explicitement.
29. **Tests ciblés ?** Oui — `googleRedirectPage.test.jsx` (nouveau, 14 tests, caractérisation rouge puis parité verte), `postAuthDestination.test.js`/`ownerContext.test.js`/`OwnerContextLanding.test.jsx`/`nextauthJwtCallback.test.js`/`nextauthConfig.test.js` rejoués (48/48 au total sur les 6 fichiers), `AuthContextCan.test.jsx` rejoué (7/7).
30. **Client complet ?** Oui — 95/95 fichiers, 665/665 tests.
31. **Lint ?** 0 erreur (267 warnings, baseline inchangée).
32. **Build ?** `npm run build:next` vert.
33. **Backend modifié ?** Non — précaution : 4 suites d'auth backend rejouées (`authRoutes`, `authValidation`, `googleAuthTokenVerification`, `googleGetToken`), 43/43 tests verts.
34. **Mobile modifié ?** Non — `altimmo-app/` non touché par ce hotfix (les modifications visibles dans `git status` sur ce dossier proviennent de RBAC-4/5, antérieures).
35. **`git diff --check` ?** exit 0.
36. **Fichiers modifiés ?** 1 — `client/app/auth/google-redirect/page.jsx`. Créé : `client/lib/__tests__/googleRedirectPage.test.jsx`, et 5 documents `server/docs/HOTFIX_AUTH_POSTLOGIN_ROUTING1_*.md`.
37. **Commit ?** Aucun.
38. **Push ?** Aucun.
39. **Deploy ?** Aucun.
40. **Verdict ?** **CERTIFIÉ VERT.** Tous les critères du mandat §60 sont remplis : résolveurs divergents identifiés (2, pas 3), destination canonique prouvée par usage dominant préexistant, Proprietaire/Client/Staff cohérents entre tous les flows, aucun droit ni capacité modifié, Google OAuth et `trustHost` intacts, open redirect impossible (protection préexistante revérifiée), tests complets verts, build vert.

## Ce qui n'a pas été touché (conformément aux non-objectifs)

`User.role`, `businessProfiles`, `capabilities`, RBAC-1→5, configuration OAuth Google (au-delà du lien direct avec le routing), backend de permissions, menus, droits d'accès, tenant, paiements, hôtels, Inbox Pro, `altimmo-app/`. Le comportement de `/login` sans redirection automatique pour une session déjà active (commentaire obsolète référençant `PublicAuthRoute.jsx`, composant disparu) a été documenté mais **non corrigé** — ce n'est pas la divergence Proprietaire visée par ce hotfix, et une correction non sollicitée aurait pu interférer avec le changement de compte volontaire.

## STOP

Conformément au mandat : aucune permission modifiée, aucune capacité modifiée, Google OAuth et `trustHost: true` intacts, open redirect impossible, tests/lint/build verts, `git diff --check` vert. Aucun commit/push/déploiement. `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1` et `HOTFIX-RBAC-TRANSACTIONS-ACCESS-1` non démarrés. En attente de validation utilisateur.
