# HOTFIX-MOB-GOOGLE-RESULT-1 — État initial

## Baseline

- Branche : `main`.
- HEAD : `31eb4a4a25e46ae048937d6eb51dc4b516458640`.
- Le worktree contient les changements non commités du micro-hotfix d'alignement OAuth ; ils sont conservés.
- `git diff --check` : vert avant ce hotfix.

## Contrat installé

- Dépendance demandée : `^16.1.2`; version réellement installée : `16.1.4`.
- `signIn()` résout avec `{ type: 'success', data: User }` ou `{ type: 'cancelled', data: null }`; les autres erreurs sont rejetées.
- Les helpers officiels `isSuccessResponse` et `isCancelledResponse` sont exportés.

## Code avant diagnostic

- Login et Signup appellent le même `getGoogleIdToken()`.
- Le helper extrait `result.data?.idToken || result.idToken` sans classifier `result.type`.
- Une réponse moderne `cancelled` devient donc à tort l'erreur générique « did not return an ID token ».
- Une réponse moderne `success` reste compatible avec `result.data?.idToken`.
- `AuthContext.loginWithGoogle()` envoie `{ idToken, role, phone }` à `POST /auth/google`, crée la session sur succès et absorbe les erreurs backend après affichage d'une alerte.
- L'alerte Login observée correspond à cette branche `AuthContext`; l'hypothèse « backend jamais appelé » doit être revérifiée sur device.

## Hypothèses device

1. Succès natif avec ID token, puis échec backend absorbé par `AuthContext`.
2. Résultat `cancelled`, mal classé par le helper.
3. Rejet natif avec un code non capturé.

Aucune modification backend ou Google Cloud n'est autorisée.
