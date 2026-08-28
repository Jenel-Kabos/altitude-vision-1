# HOTFIX-MOB-GOOGLE-AUTH-2 — MATRICE DE SÉCURITÉ

## Aucune modification de code — donc aucun risque introduit

Ce hotfix n'a modifié **aucun fichier de production**, ni mobile ni backend. La cause racine est une configuration Google Cloud Console externe au dépôt (SHA-1 manquant sur le client OAuth Android "Altimmo Android" pour le certificat géré par EAS Cloud Build, profil `development`). Aucun changement de code n'était nécessaire ni approprié — la matrice de sécurité ci-dessous documente donc l'état déjà en place, vérifié intact.

## Vérification d'audience — jamais désactivée ni élargie

`server/controllers/authController.js:41-46` — `googleClient.verifyIdToken({ idToken, audience: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_IOS] })`, fichier non modifié. Aucune valeur d'audience n'a été ajoutée, supprimée, ou rendue permissive (pas de wildcard, pas de `aud` non vérifié). Le flux mobile utilise déjà l'audience du client Web (usage prévu par `@react-native-google-signin/google-signin` avec `webClientId`), acceptée par `GOOGLE_CLIENT_ID` — comportement préexistant, non modifié.

## Aucune confiance accordée à des données mobiles non vérifiées

`signInWithGoogle` (`googleSignIn.js:67`) n'envoie au backend que `{ idToken, intent, role: 'Client' }` — jamais un `email`/`name` construit côté client sans passer par la vérification `verifyIdToken` du backend (comportement préexistant, non modifié). Le rôle envoyé (`'Client'`) est toujours celui par défaut à l'inscription, jamais élevé côté mobile — RBAC-1→5 reste la seule source de vérité pour `role`/`capabilities`/`businessProfiles`, jamais fabriqués côté mobile.

## Secrets — aucun exposé

- Aucun `client secret` n'a été introduit dans le code mobile (le flux `@react-native-google-signin/google-signin` avec `webClientId` ne nécessite jamais de secret côté client, contrairement à un flux "authorization code" serveur).
- Les diagnostics (`getGoogleSignInDiagnostic`, préexistant) filtrent déjà les propriétés sensibles (`/token|credential|cookie|authorization|jwt|codeVerifier/i`) — vérifié non modifié, toujours actif.
- Le SHA-1 documenté dans ce hotfix (`62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`) est une empreinte de certificat public — **pas un secret** (c'est précisément la donnée que Google exige de récupérer publiquement via `apksigner`/`gradlew signingReport` pour l'enregistrer dans un client OAuth Android). Aucune clé privée, aucun mot de passe de keystore, aucun token n'a été affiché dans les documents produits.

## Web Google Auth (`HOTFIX-WEB-GOOGLE-AUTH-1`) — intact

Aucun fichier `client/app/api/auth/[...nextauth]/route.js` touché. `trustHost: true` non modifié. Aucune interférence — ce hotfix ne concerne que la vérification native Android côté Google Play Services, un mécanisme entièrement absent du flux Web (NextAuth).

## Email/mot de passe — intact

Aucun fichier d'authentification email/mot de passe (`authController.login`, `LoginScreen.jsx` hors bouton Google) modifié.

## RBAC-1→5 — intact

Aucun fichier `iamArchitecture.js`, `roles.js`, `capabilityMiddleware.js`, `AuthContext.jsx` (Web ou Mobile) modifié.

## Tenant — non concerné

Aucune donnée tenant n'intervient dans ce flux (authentification, pas une opération métier scopée).
