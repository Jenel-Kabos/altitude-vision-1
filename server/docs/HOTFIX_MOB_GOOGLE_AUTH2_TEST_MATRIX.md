# HOTFIX-MOB-GOOGLE-AUTH-2 — MATRICE DE TESTS

## Caractérisation déjà existante (préexistante, non modifiée, rejouée)

`altimmo-app/src/services/__tests__/googleSignIn.test.js` — 17/17 tests verts, couvrant déjà exactement les scénarios exigés par le mandat §21 avant même ce hotfix :

| Scénario exigé | Test existant | Statut |
|---|---|---|
| Succès Google | "calls backend authentication exactly once after a modern success" | Vert |
| Cancel utilisateur | "classifies the modern cancelled response...", "silently ignores SIGN_IN_CANCELLED", "does not call backend authentication after cancellation" | Vert |
| Erreur SDK/provider (dont `DEVELOPER_ERROR`, la cause de ce hotfix) | "hides technical developer error 10", "hides technical developer error DEVELOPER_ERROR" | Vert — **preuve que ce code d'erreur exact était déjà anticipé et testé avant que le bug ne soit signalé** |
| Token absent | "rejects a modern success response without an ID token" | Vert |
| Play Services indisponible | "distinguishes unavailable Play Services" | Vert |
| Erreur réseau/backend après succès natif | "does not call backend authentication after a native error" | Vert (le backend n'est jamais appelé si le natif échoue avant, cohérent avec la cause racine confirmée) |
| Diagnostic sûr (pas de token loggé) | "does not log token values", "exposes only safe diagnostic fields and property names" | Vert |
| Intent signup/login | "sends the signup intent from the Signup surface" | Vert |

**Aucun nouveau test n'a été nécessaire** : la cause racine confirmée (SHA-1 manquant côté Google Cloud) se situe entièrement en dehors du code testable par une suite Jest — elle se manifeste uniquement dans l'appel natif réel `GoogleSignin.signIn()` sur un device avec une configuration Google Cloud précise. Le comportement du code FACE à ce code d'erreur (`getGoogleSignInErrorMessage` classifie `DEVELOPER_ERROR`, le catch ne fait jamais un faux succès) est déjà prouvé vert par la suite existante.

## Tests backend

Non rejoués spécifiquement — aucun fichier backend modifié, la cause ne concerne ni l'audience, ni les client IDs autorisés, ni le payload mobile (le flux échoue avant tout appel réseau). Mandat §26 : "Ajouter un test si la cause concerne Android audience/client IDs autorisés/payload mobile" — non applicable ici, aucun test ajouté.

## Suite mobile complète

48/48 suites, 422/422 tests verts (rejouée intégralement par prudence, bien qu'aucun fichier de production n'ait été modifié).

## Lint / TypeScript

Lint : 0 erreur (116 warnings, baseline inchangée). `tsc --noEmit` : 0 erreur.

## Device réel

Voir `HOTFIX_MOB_GOOGLE_AUTH2_FLOW.md`/`HOTFIX_MOB_GOOGLE_AUTH2_CONFIG_MATRIX.md` — extraction de certificats réelle effectuée (lecture seule, `apksigner`/`aapt2`/`keytool`) sur le Samsung SM-S918B connecté, comparaison de comportement entre deux builds réels (gradle local vs EAS) fournie par l'utilisateur. **La correction elle-même (ajout du SHA-1 dans Google Cloud Console) n'a pas pu être appliquée ni revérifiée par un nouveau test de connexion réussie dans cette session** — accès Google Cloud Console non disponible depuis cet environnement. Voir verdict `GO SOUS RÉSERVES`.
