# HOTFIX-WEB-GOOGLE-AUTH-1 — Matrice de sécurité

| Vérification | Résultat |
|---|---|
| `GOOGLE_CLIENT_SECRET` jamais exposé côté client | OK — utilisé uniquement dans `route.js` (code serveur Next.js, jamais bundlé côté navigateur ; pas de préfixe `NEXT_PUBLIC_`) |
| `NEXTAUTH_SECRET` jamais exposé côté client | OK — même raison |
| `NEXTAUTH_API_SECRET` jamais exposé côté client | OK — utilisé uniquement dans le callback `jwt` (code serveur), transmis uniquement en en-tête `x-nextauth-secret` serveur-à-serveur (NextAuth → backend), jamais renvoyé au navigateur |
| idToken/JWT/cookies de session | Jamais imprimés ni journalisés en clair dans ce sprint — aucun `console.log` de secret ajouté |
| `trustHost: true` élargit-il la surface d'attaque ? | Non, dans ce contexte précis : `NEXTAUTH_URL` (déjà présent) continue de fixer l'origine canonique via `reqWithEnvURL` ; `trustHost` lève uniquement le garde-fou `UntrustedHost` qui bloquait *toutes* les requêtes, y compris légitimes, faute d'`AUTH_URL`/`AUTH_TRUST_HOST`. Aucun changement de la validation d'idToken, aucun élargissement de l'`audience` acceptée côté backend |
| `GOOGLE_CLIENT_ID_ANDROID` jamais réutilisé comme client Web | Confirmé — valeurs distinctes en base, `route.js` ne lit que `GOOGLE_CLIENT_ID` |
| Contrat `intent`/Web historique | Inchangé — aucune modification de `authController.googleToken`, aucune modification du comportement "login-or-create" sans `intent` |
| Vérification serveur de l'idToken | Inchangée — `google-auth-library`, `audience` multiple (Web/Android/iOS), `email_verified` vérifié avant toute création/connexion de compte |
| Callback forgé/invalide | Le backend rejette toujours (401 `Token Google invalide.`) tout idToken qui échoue `verifyIdToken` — comportement non touché par ce sprint |
| Session forcée en cas d'erreur backend | Non — `signIn` callback retourne `false` si `res.ok` est faux, empêchant toute création de session NextAuth |
