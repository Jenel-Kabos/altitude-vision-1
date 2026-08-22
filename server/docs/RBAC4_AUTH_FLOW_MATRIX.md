# RBAC-4 — MATRICE DES FLUX D'AUTHENTIFICATION MOBILE

| Flux | Rôle | Capacités reçues | Source | Auto-heal | Verdict |
|---|---|---|---|---|---|
| Login email (`AuthContext.jsx:106`, `POST /auth/login`) | `user.role` (DB) | Oui — `authController.createSendToken` (enrichi RBAC-3) renvoie `data.user.capabilities`, et `login()` passe l'objet `user` complet (non déstructuré) dans `setUser` | Backend, déjà réutilisé tel quel | Non nécessaire (capacités présentes dès la réponse) | **Conforme** |
| Signup email (`AuthContext.jsx:123`, `POST /auth/signup`) | — | `register()` retourne `res.data` brut à l'appelant, ne peuple pas `user`/`token` (le mobile ne connecte pas automatiquement après signup) | N/A — pas de session créée à cette étape | N/A | **Hors périmètre** — aucune capacité à threader, aucune session active créée ici |
| Login/Signup Google (`AuthContext.jsx:128`, `POST /auth/google`) | `user.role` (DB, vérifié backend via idToken Google) | Oui — même endpoint et même `sendGoogleAuthResponse` que le Web (RBAC-3), `user` complet assigné tel quel | Backend, déjà réutilisé tel quel | Non nécessaire | **Conforme** |
| Restauration de session au cold start (`AuthContext.jsx:15-48`, `GET /users/me`) | `req.user.role` (JWT vérifié par `protect`) | Oui — `userController.getUser` (enrichi RBAC-3) renvoie `payload.capabilities` quand `requesterId === user._id`, ce qui est toujours le cas ici (`/me`) | Backend, déjà réutilisé tel quel | **Non nécessaire structurellement** — voir note ci-dessous | **Conforme** |
| Logout (`AuthContext.jsx:196-207`) | — | `user`/`token` mis à `null` | — | — | **Conforme** — `can()` retourne `false` pour tout, aucune capacité résiduelle |

## Différence structurelle avec le Web — pas d'auto-heal nécessaire

Contrairement au Web (`localStorage.user`, persistant entre sessions, pouvant dater d'avant RBAC-3), le mobile **ne persiste jamais l'objet `user` en stockage** — seul le token JWT est conservé (`expo-secure-store`, clé `auth_token`). À chaque redémarrage à froid, `restoreStoredSession()` reconstruit `user` intégralement via un appel réel à `GET /users/me` (`AuthContext.jsx:30`).

Conséquence directe : dès que le backend expose `capabilities` sur `/me` (déjà fait, RBAC-3), **toute session mobile restaurée en reçoit automatiquement les capacités à jour**, sans mécanisme de réparation à construire. Il n'existe pas d'équivalent mobile au problème "session localStorage figée avant l'ajout du champ" qui a motivé l'auto-guérison Web. Un mécanisme d'auto-heal supplémentaire aurait été une complexité inutile (mandat §16 : "une seule tentative contrôlée" — ici, zéro tentative n'est nécessaire, l'appel `/me` existant suffit déjà).

Seul cas résiduel : une session **en mémoire** (pas encore relue depuis le backend) créée par un ancien build de l'app, avant que ce build ne soit mis à jour avec ce sprint — mais dans ce cas, `user.capabilities` serait simplement `undefined` côté client car le champ n'existait pas encore dans le code consommateur (pas dans le payload, qui lui date de RBAC-3 et est déjà déployé). `can()` fail-close correctement dans ce cas (`Boolean(undefined?.includes(...))` → `false`), sans jamais recalculer localement à partir du rôle — testé explicitement (`AuthContext.test.jsx`, "session ancienne restaurée sans capabilities").

## Comparaison de payload Web/Mobile

Le mobile et le Web appellent strictement les **mêmes** endpoints backend (`/auth/login`, `/auth/google`, `/users/me`) et consomment la **même** fonction `createSendToken`/`sendGoogleAuthResponse`/`getUser`. Pour un même utilisateur, le payload `capabilities` est donc **identique en valeur** entre Web et Mobile — aucune route mobile-spécifique n'existe, donc aucune divergence de calcul n'est possible par construction (mandat §59). Aucun test de parité séparé n'a été nécessaire au-delà de la preuve que les deux consomment le même contrat (confirmé par lecture de code, pas de route mobile dédiée trouvée par l'audit).
