# HOTFIX-WEB-GOOGLE-AUTH-1 — État initial

Date : 2026-08-22. Branche `main`. `HEAD` = `63880f58ff41bd805b828d07603d878d55122d45`. `git diff --check` exit 0. `git status --short` : 7 lignes, toutes des ajouts non commités du sprint précédent (`HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1` : 1 test Mongo + 6 docs), aucune modification préexistante liée à l'auth Web/Google — aucun travail externe (PAY-*, Inbox Pro, HotelModeration, Google mobile) à préserver au-delà de ce qui est déjà commité, aucun de ces fichiers touché dans ce sprint.

## Pipeline Web réel identifié (audit avant toute modification)

- **Fichier de configuration NextAuth** : `client/app/api/auth/[...nextauth]/route.js` — point d'entrée unique, `NextAuth({...})` appelé inline, `export const {GET, POST} = handlers`.
- **Version NextAuth installée** : `next-auth@^5.0.0-beta.31` (Auth.js v5, App Router).
- **Provider Google** : `next-auth/providers/google`, `clientId`/`clientSecret` lus depuis `process.env.GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — jamais codés en dur.
- **Callback `signIn`** : pour `account.provider === 'google'`, POST `${API_URL}/auth/google` avec `{idToken: account.id_token}` (jamais de champs reconstruits côté client) — backend vérifie l'idToken via `google-auth-library`.
- **Callback `jwt`** : réutilise `account.backendToken`/`account.backendUser` si déjà résolus par `signIn` (pas de second appel réseau à la connexion initiale) ; sinon (refresh, `account` absent) POST `${API_URL}/auth/google-token` avec un secret partagé `x-nextauth-secret`.
- **Callback `session`** : projette `accessToken`/`user.id`/`user.role`/`user.isNewUser` sur la session NextAuth.
- **Appel backend côté connexion initiale** : `POST /api/auth/google` → `authController.googleToken` (vérifie l'idToken via `OAuth2Client.verifyIdToken`, `audience: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_IOS]`).
- **Logique de création utilisateur** : nouveau compte si `payload.email` inconnu (rôle `Client` par défaut, `authProvider:'google'`, mot de passe aléatoire).
- **Logique de connexion utilisateur existant** : lie `googleId` si absent, sinon connexion directe ; `lastLoginAt` mis à jour.
- **Contrat d'intention (`intent`)** : le hotfix mobile a introduit `intent='login'|'signup'` avec des codes `ACCOUNT_NOT_FOUND`/`ACCOUNT_ALREADY_EXISTS`. Le callback `signIn` de NextAuth **n'envoie jamais `intent`** dans son POST à `/auth/google` — confirmé par lecture directe de `route.js` (`body: JSON.stringify({idToken: account.id_token})`, aucun champ `intent`). Le backend traite ce cas explicitement : *"`intent` absent conserve temporairement le contrat Web NextAuth historique (login-or-create)"* (commentaire du code lui-même, `authController.js`). **Ce contrat n'a pas été modifié dans ce sprint**, conformément au mandat.

## Plan d'audit

1. Vérifier la présence et la cohérence des variables d'environnement (client ID Web vs Android, secrets partagés) — localement, sans jamais imprimer de valeur secrète complète.
2. Vérifier le redirect URI effectivement utilisé par rapport à celui autorisé dans Google Cloud.
3. Auditer le code de la librairie `next-auth`/`@auth/core` installée pour identifier tout comportement dépendant de l'environnement de déploiement (local vs Netlify) qui pourrait diverger sans aucune modification de code ni de configuration Google.
4. Reproduire/caractériser la première étape en échec par lecture de code source (impossible de cliquer réellement sur `https://altitudevision.agency` depuis cet environnement).
5. Corriger uniquement la cause prouvée, avec tests.
