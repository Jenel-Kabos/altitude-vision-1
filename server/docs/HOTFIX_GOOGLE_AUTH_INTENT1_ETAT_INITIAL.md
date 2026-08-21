# HOTFIX-GOOGLE-AUTH-INTENT-1 — État initial

## Baseline

- Branche : `main`
- HEAD initial : `0e73c9598c3e6e6121d5adfaea6d6bf158110d97`
- Worktree déjà modifié par les hotfix Google précédents ; changements conservés.
- `git diff --check` initial : vert.
- Aucun commit, push, déploiement ou reset.

## Comportement prouvé par le code

Login et Signup mobiles appelaient tous deux `signInWithGoogle(loginWithGoogle, source)`. Le helper ne transmettait que `idToken` et `role`, puis `AuthContext.loginWithGoogle` appelait toujours `POST /api/auth/google`.

Le backend ne connaissait pas la surface d'origine. Après vérification Google et `email_verified`, il cherchait uniquement `User` par email : trouvé, il connectait ou liait Google ; absent, il créait un compte et une session. Signup avec un compte existant déclenchait donc mécaniquement la branche Login. **Ambiguïté confirmée.**

## Politique préexistante préservée

- Identité recherchée par email ; `googleId = payload.sub` est stocké/lié.
- Un compte email/password de même email est automatiquement lié lors d'une authentification Google réussie.
- `email_verified === true` reste obligatoire.
- Un nouveau compte Google ne peut recevoir que `Client` ou `Proprietaire`; toute autre valeur retombe sur `Client`.
- Aucune création automatique d'`OrgMembership`.

## Consommateurs

| Surface | Helper | Endpoint | Payload initial | User existant | User absent |
|---|---|---|---|---|---|
| Mobile Login | `signInWithGoogle` | `/auth/google` | `idToken`, `role` | Login/link | Création |
| Mobile Signup | même helper | `/auth/google` | identique | Login/link indésirable | Création |
| Web Login/Register NextAuth | callback NextAuth | `/auth/google` | `idToken` | Login/link | Création |

NextAuth web ne transmet actuellement pas la surface Login/Register au callback serveur. Son absence d'`intent` impose un fallback temporaire pour éviter une rupture brutale.
