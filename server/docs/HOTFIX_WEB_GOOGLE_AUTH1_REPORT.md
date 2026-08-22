# HOTFIX-WEB-GOOGLE-AUTH-1

**Verdict : GO SOUS RÉSERVES.**

(La cause racine est prouvée par lecture directe du code source de la librairie `@auth/core` installée, corrigée par un ajout minimal et testée. La réserve unique porte sur l'impossibilité de vérifier depuis cet environnement que la configuration Netlify réellement déployée reflète cette correction — voir §10.)

## 1. Étape exacte où OAuth échouait

**Avant même la redirection vers Google** — dès la toute première requête `GET /api/auth/signin/google`, et en réalité pour toute requête `/api/auth/*` en production. Le flux n'atteignait jamais l'étape "sélection du compte Google" ni le callback.

## 2. Cause racine

`@auth/core` (Auth.js v5, dépendance de `next-auth@5.0.0-beta.31`) exige `trustHost: true` pour faire confiance à l'en-tête `Host` de la requête entrante. Sans lui, sa valeur par défaut ne devient `true` que si `AUTH_URL`, `AUTH_TRUST_HOST`, `VERCEL` ou `CF_PAGES` est présent, **ou** si `NODE_ENV !== 'production'`. Ce dépôt ne définissait que `NEXTAUTH_URL` (jamais lu par cette résolution — seul `AUTH_URL` l'est), pas `AUTH_TRUST_HOST`. En production sur Netlify (`NODE_ENV=production`, ni Vercel ni Cloudflare Pages), `trustHost` résolvait donc à `false`, et `@auth/core` retournait systématiquement l'erreur `UntrustedHost` (visible côté utilisateur comme `?error=Configuration`) pour toute requête d'authentification — **avant** toute tentative de contacter Google. En local, `NODE_ENV=development` masquait entièrement le problème (`trustHost` y défaut à `true`), ce qui explique pourquoi rien ne semblait cassé en développement.

## 3. Client OAuth réellement utilisé

Le client **Web** (préfixe projet `872164120879-`), confirmé strictement identique entre `client/.env.local` (`GOOGLE_CLIENT_ID`) et `server/.env` (`GOOGLE_CLIENT_ID`, utilisé comme `audience` principale par `google-auth-library`), et strictement distinct de `GOOGLE_CLIENT_ID_ANDROID`. Aucune confusion Web/Android trouvée.

## 4. Redirect URI réellement utilisé

`NEXTAUTH_URL=https://altitudevision.agency` (exact, sans slash final) — correspond caractère pour caractère à l'origine JavaScript autorisée dans Google Cloud. Le redirect URI construit par NextAuth (`{NEXTAUTH_URL}/api/auth/callback/google`) correspond donc exactement à `https://altitudevision.agency/api/auth/callback/google`, déjà présent dans les URI de redirection autorisés. **Ce n'était pas la cause** — le flux échouait avant même de tenter cette redirection.

## 5. Environnement fautif

Aucune divergence de VALEUR entre local et backend n'a été trouvée (client ID, secrets partagés — tous cohérents). La cause est un **comportement par défaut de la librairie dépendant de `NODE_ENV`**, qui ne se manifeste QUE dans un environnement où `NODE_ENV=production` sans `AUTH_URL`/`AUTH_TRUST_HOST` — exactement le cas de Netlify, jamais reproductible avec `next dev` en local.

## 6. Correction réalisée

Un seul ajout dans `client/app/api/auth/[...nextauth]/route.js` :
```js
const { handlers } = NextAuth({
  trustHost: true,
  providers: [ ... ],
  callbacks: { ... },
  pages: { ... },
  secret: process.env.NEXTAUTH_SECRET,
});
```
C'est le pattern officiellement documenté par `@auth/core` lui-même pour tout hébergeur hors Vercel/Cloudflare Pages. Aucune autre ligne modifiée.

## 7. Contrat Login Google Web

**Inchangé.** Le callback `signIn` continue de POSTer `{idToken}` sans `intent` vers `/api/auth/google`, préservant le contrat "login-or-create" historique du Web, explicitement distinct du contrat `intent`-based du mobile (déjà documenté par un hotfix précédent comme une dette architecturale volontairement non résolue ici). Aucune tentative d'aligner le Web sur le contrat mobile dans ce sprint.

## 8. Sécurité

Aucun secret exposé côté client, aucun élargissement de l'`audience` d'idToken acceptée côté backend, aucun changement de la vérification `email_verified`, aucune session créée en cas d'échec backend. Voir `SECURITY_MATRIX.md` pour le détail complet.

## 9. Tests

| Suite | Résultat |
|---|---|
| `nextauthConfig.test.js` (nouveau — trustHost, client ID Web, absence de secret codé en dur, pages signIn/error) | 5/5 ✅ |
| `nextauthJwtCallback.test.js` (existant, rejoué) | 7/7 ✅ |
| Suite client complète | 94/94 fichiers, 646/646 tests ✅ |
| Lint client | 0 erreur (267 warnings, baseline inchangée) ✅ |
| Build Next production | ✅ |
| Backend Google (`googleAuthTokenVerification.test.js`, `googleGetToken.test.js`, rejoués — backend non modifié) | 2 suites, 19/19 ✅ |
| `git diff --check` | exit 0 ✅ |

## 10. Validation production restante — NON CONFIRMÉ

**Un succès local ne suffit pas à certifier le correctif en production**, conformément au mandat. Cette session ne dispose d'aucun accès à la console Netlify ni à `https://altitudevision.agency` en conditions réelles — il n'est donc **pas prouvé** que :
- le code déployé sur Netlify correspond à `HEAD` de ce dépôt (avec ou sans ce correctif) ;
- une variable d'environnement Netlify `AUTH_TRUST_HOST` ou équivalente n'a pas déjà été ajoutée manuellement entre-temps ;
- le comportement observé en production correspond exactement à `UntrustedHost`/`Configuration` (aucune capture d'écran ni log de production disponible dans cet environnement).

**Recommandation pour valider en production**, sans qu'aucune action ne soit entreprise ici :
1. Déployer ce correctif (`trustHost: true`) sur Netlify — hors périmètre et hors autorisation de ce sprint.
2. Alternative sans redéploiement de code : définir la variable d'environnement Netlify **`AUTH_TRUST_HOST`** (site Netlify du frontend, environnement de production), **type attendu : chaîne littérale `"true"`**, puis redéclencher un build/déploiement pour que Next.js la charge. Procédure de validation : après déploiement, cliquer "Continuer avec Google" sur `https://altitudevision.agency/login` et confirmer l'arrivée effective sur l'écran de sélection de compte Google (pas d'erreur `?error=Configuration`).
3. Ne jamais imprimer la valeur d'`AUTH_TRUST_HOST` dans un rapport si elle contenait autre chose qu'un simple `"true"` littéral (ce n'est pas un secret, mais la discipline de ce mandat s'applique par prudence).

## STOP

Conformément au mandat : aucun commit, push ni déploiement. Google Cloud, le client OAuth Android, le mobile, PAY-*, Property, Hôtellerie et Inbox Pro n'ont pas été touchés. En attente de validation utilisateur, notamment sur l'autorisation de déployer ce correctif ou de configurer `AUTH_TRUST_HOST` sur Netlify.
