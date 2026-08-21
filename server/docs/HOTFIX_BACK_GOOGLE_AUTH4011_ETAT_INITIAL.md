# HOTFIX-BACK-GOOGLE-AUTH-401-1 — État initial

## Baseline

- Branche : `main`
- HEAD : `31eb4a4a25e46ae048937d6eb51dc4b516458640`
- `git diff --check` : vert avant intervention.
- Le worktree contenait déjà les changements mobiles et rapports des hotfix Google précédents ; ils sont conservés.
- Aucun commit, push ou déploiement n'est autorisé.

## Faits déjà prouvés

- Sur Samsung, Google Sign-In retourne un résultat `success`, un utilisateur et un `idToken` de longueur 1086.
- Le mobile appelle `https://altitude-vision.onrender.com/api/auth/google` et reçoit HTTP 401.
- Aucun token, email complet, sujet Google ou credential n'a été conservé dans les rapports.

## Chaîne backend auditée

`POST /api/auth/google` → `googleLimiter` → `authController.googleToken` → extraction de `idToken` → `OAuth2Client.verifyIdToken` → `ticket.getPayload()` → contrôle strict `email_verified === true` → nettoyage d'une inscription en attente → recherche/liaison/création utilisateur → JWT Altimmo.

Le contrôleur produit un 401 dans exactement deux cas avant la logique utilisateur : rejet de `verifyIdToken()` (`Token Google invalide.`), ou `email_verified` différent de `true` (`Email Google non vérifié.`). La trace mobile disponible ne contient pas le corps de réponse : elle ne permet pas de choisir entre ces branches.

## Configuration initiale

- `server/.env` local : `GOOGLE_CLIENT_ID` présent, longueur 72, préfixe `872164120879-`, empreinte courte `39a0dddc1323`.
- Mobile local : Web Client ID présentant les mêmes métadonnées.
- `GOOGLE_CLIENT_ID_ANDROID` local : absent.
- Aucun `render.yaml`/`render.yml`, CLI Render ou credential Render disponible.
- La valeur effective de `GOOGLE_CLIENT_ID` sur Render est donc **NON CONFIRMÉE**.
- Les claims réels `aud`, `azp`, `iss`, `exp`, `iat` et `email_verified` du token de l'essai sont **NON CONFIRMÉS** : le token n'a volontairement été ni journalisé ni persisté.

## Hypothèse principale, non assimilée à une preuve

Une audience Render restée sur l'ancien projet `3869205293-…` expliquerait exactement le 401 alors que le mobile émet désormais pour `872164120879-…`. Sans accès aux variables ou logs Render et sans claims capturés en mémoire pendant l'essai, cette cause reste probable mais non prouvée.
