# HOTFIX-WEB-GOOGLE-AUTH-1 — Matrice du flux OAuth et cause racine

## Pipeline attendu

```
Utilisateur → "Continuer avec Google" (LoginPage.jsx, signIn('google', {callbackUrl}))
  → GET /api/auth/signin/google (NextAuth, next-auth/react)
  → redirection vers accounts.google.com (Google)
  → sélection du compte
  → redirection vers /api/auth/callback/google (redirect_uri autorisé dans Google Cloud)
  → NextAuth callback signIn → POST backend /api/auth/google {idToken}
  → backend vérifie idToken (google-auth-library, audience=[GOOGLE_CLIENT_ID, ...])
  → résolution/création du compte (contrat Web historique, sans `intent`)
  → NextAuth callback jwt → session
  → cookie de session posé → redirection callbackUrl
```

## Étape exacte où le flux échoue en production (preuve par lecture de code source, `@auth/core` v5 installé)

**Avant même la redirection vers Google** — dès la première requête `GET /api/auth/signin/google`, et en réalité pour **toute** requête `/api/auth/*` (signin, callback, session, csrf), pour la raison suivante :

`node_modules/@auth/core/index.js` (fonction `Auth`, exécutée pour chaque requête) :
```js
const warningsOrError = assertConfig(internalRequest, config);
```

`node_modules/@auth/core/lib/utils/assert.js` :
```js
if (!options.trustHost) {
  return new UntrustedHost(`Host must be trusted. URL was: ${request.url}`);
}
```

`node_modules/@auth/core/lib/utils/env.js` (résolution de la valeur par défaut de `trustHost`, **avant correctif**) :
```js
config.trustHost ?? (config.trustHost = !!(envObject.AUTH_URL ??
    envObject.AUTH_TRUST_HOST ??
    envObject.VERCEL ??
    envObject.CF_PAGES ??
    envObject.NODE_ENV !== "production"));
```

**`NEXTAUTH_URL` n'apparaît jamais dans cette résolution — seul `AUTH_URL` (nom de variable différent) y est lu.** En production sur Netlify (`NODE_ENV=production`, ni `VERCEL` ni `CF_PAGES`), avec uniquement `NEXTAUTH_URL` défini (jamais `AUTH_URL`/`AUTH_TRUST_HOST` dans ce dépôt), `trustHost` résout à `false` → `assertConfig` retourne `UntrustedHost` → **échec immédiat de toute requête `/api/auth/*`**, avant même la redirection vers Google.

**En local**, `next dev` fixe `NODE_ENV=development` ≠ `'production'` → la dernière clause du `??` (`envObject.NODE_ENV !== "production"`) vaut `true` → `trustHost` résout à `true` par défaut → **aucun échec observable en local**, expliquant pourquoi le problème n'apparaît que sur `https://altitudevision.agency`.

## Pourquoi le mobile n'est jamais concerné

Le mobile (`altimmo-app`) utilise `expo-auth-session`/Google Sign-In natif et appelle directement `POST /api/auth/google` côté backend — **il ne passe jamais par NextAuth ni par `@auth/core`**. Le mécanisme `trustHost` est strictement spécifique à Auth.js/NextAuth (Web). Confirmé par grep : aucune référence à `next-auth` dans `altimmo-app/`.

## Erreurs NextAuth recherchées (mandat §7) — laquelle correspond réellement

| Code recherché | Correspond à la cause trouvée ? |
|---|---|
| `redirect_uri_mismatch` | Non — c'est une erreur renvoyée par **Google**, jamais atteinte ici puisque le flux échoue **avant** la redirection vers Google |
| `origin_mismatch` | Non, même raison |
| `invalid_client` | Non — le client ID/secret sont corrects et cohérents (voir `CONFIG_MATRIX.md`) |
| `invalid_grant` | Non — aucun échange de code n'est jamais atteint |
| `OAuthCallback` / `OAuthSignin` | Non directement — ce sont des erreurs de callback plus tardives |
| `Configuration` | **OUI — c'est le type d'erreur NextAuth générique sous lequel `UntrustedHost` (une sous-classe d'`AuthError`) se manifeste côté utilisateur**, redirigé vers `pages.error: '/login'` avec `?error=Configuration` |
| `AccessDenied` | Non |

## Correction appliquée

Un seul ajout, dans `client/app/api/auth/[...nextauth]/route.js` :
```js
const { handlers } = NextAuth({
  trustHost: true,
  providers: [ ... ],
  ...
});
```

C'est exactement le pattern documenté dans le JSDoc du module `@auth/core` lui-même (`node_modules/@auth/core/index.js`, exemple `Auth(request, { providers: [...], secret: "...", trustHost: true })`) — la solution officiellement recommandée pour tout déploiement hors Vercel/Cloudflare Pages sans `AUTH_URL`/`AUTH_TRUST_HOST`. Aucune modification de Google Cloud, aucune modification du contrat `intent`/Web historique, aucune modification du mobile.
