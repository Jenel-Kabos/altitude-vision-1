# MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1 — État initial

Date : 2026-08-20. Branche `main`, HEAD initial `31eb4a4a25e46ae048937d6eb51dc4b516458640`.

Le worktree était propre et `git diff --check` était vert avant ce micro-hotfix.

## Cause déjà confirmée

Le Samsung SM-S918B renvoyait `DEVELOPER_ERROR` / code 10. Google Play Services a explicitement indiqué que le client Android et le client Web (`server client ID`) n'appartenaient pas au même projet.

- Android correct : projet Google Cloud « Altitude Vision », préfixe `872164120879-…`, package `com.altitudevision.altimmo`, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
- Mobile runtime initial : client WEB préfixé `3869205293-…`, projet « My First Project ».
- Client WEB correct récupéré localement dans `client/.env.local` : préfixe `872164120879-…`, longueur 72, empreinte locale SHA-256 abrégée `39a0dddc1323`.

Aucun secret OAuth n'est reproduit dans ce document.

## Backend prouvé

Le mobile envoie le vrai `idToken` à `POST /api/auth/google`. Le backend appelle `google-auth-library` / `verifyIdToken()` et accepte les audiences non vides suivantes : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID_ANDROID`, `GOOGLE_CLIENT_ID_IOS`.

Le Web NextAuth utilise son propre `GOOGLE_CLIENT_ID` dans `client/.env.local`, déjà préfixé `872164120879-…`, puis envoie aussi l'ID token à `/api/auth/google`. Le backend local utilisait encore le client WEB `3869205293-…`; sans alignement, les futurs tokens Web/Mobile du projet Altitude Vision seraient refusés par l'audience backend.
