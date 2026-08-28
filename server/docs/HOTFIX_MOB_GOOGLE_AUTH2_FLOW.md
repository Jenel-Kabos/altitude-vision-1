# HOTFIX-MOB-GOOGLE-AUTH-2 — FLUX RÉEL

## Bibliothèque réellement utilisée

`package.json` déclare `@react-native-google-signin/google-signin`, `expo-auth-session`, `expo-web-browser` — mais seul le premier est réellement importé/utilisé pour Google Sign-In (`grep` exhaustif de `src/`, un seul fichier : `src/services/googleSignIn.js`). `expo-auth-session`/`expo-web-browser` ne sont pas utilisés pour ce flux (probablement pour un autre usage ailleurs dans l'app, hors périmètre). **Aucune supposition — confirmé par lecture directe.**

## Diagramme réel

```
Bouton "Continuer avec Google" (LoginScreen.jsx / RegisterScreen.jsx)
  → configureGoogleSignIn()                         [googleSignIn.js:12]
      GoogleSignin.configure({ webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID })
  → signInWithGoogle(loginWithGoogle, 'Login'|'Signup')  [googleSignIn.js:67]
      → getGoogleIdToken()                          [googleSignIn.js:23]
          → GoogleSignin.hasPlayServices()
          → GoogleSignin.signIn()                    ← ÉCHEC OBSERVÉ ICI (natif, avant tout réseau)
          → extraction idToken
      → authenticate({ idToken, intent, role: 'Client' })   (= AuthContext.loginWithGoogle)
          → POST /auth/google (backend, google-auth-library, vérifie idToken)
          → JWT Altitude Vision retourné
      → session stockée (SecureStore, AuthContext)
      → navigation post-login (getPostAuthDestination-équivalent mobile, RBAC-4)
```

## Origine exacte du message générique

`getGoogleSignInErrorMessage(error)` (`googleSignIn.js:81-94`) :
```js
if (DEVELOPER_ERROR_CODES.has(code)) {
  return 'Connexion Google indisponible. Veuillez réessayer.';
}
```
où `DEVELOPER_ERROR_CODES = new Set(['10', 'DEVELOPER_ERROR'])` (ligne 6) — le code d'erreur natif standard de `@react-native-google-signin/google-signin` pour Android, levé par Google Play Services quand la vérification cryptographique du client OAuth Android échoue (SHA-1/package non enregistrés, ou mauvais projet). **Le message affiché n'est pas une erreur réseau générique — c'est un code précis, déjà classifié dans le code, qui pointe directement vers une cause de configuration OAuth, pas un bug applicatif.**

L'infrastructure de diagnostic existait déjà avant ce hotfix : `getGoogleSignInDiagnostic(error)` (ligne 96-106) est appelée dans le `catch` de `LoginScreen.jsx`/`RegisterScreen.jsx` (`console.warn('Google Sign-In failed', ...)`, DEV uniquement) et capture `name`/`code`/`message`/`propertyNames` (jamais un champ sensible, filtré par regex `/token|credential|cookie|authorization|jwt|codeVerifier/i`). **Aucune nouvelle instrumentation n'a été nécessaire pour ce diagnostic** — le code produisait déjà l'information requise.

## Preuve apportée par l'utilisateur (comparaison de builds)

- **APK de debug** (buildé/installé localement, `android/app/debug.keystore` du projet) → connexion Google **réussie**.
- **APK EAS** (`build-1787511872437.apk`, profil `development` de `eas.json`, `gradleCommand: :app:assembleDebug`, credentials EAS distantes — aucun `credentialsSource: local` défini) → connexion Google **échoue**.

Cette comparaison, fournie par l'utilisateur, **confirme directement** l'hypothèse de mismatch SHA-1 sans ambiguïté : deux builds différents, deux certificats de signature différents, un seul enregistré côté Google Cloud.

## Preuve technique (extraite directement, en lecture seule, aucune mutation)

| Source | SHA-1 |
|---|---|
| `~/.android/debug.keystore` (machine locale, non utilisé pour ce build) | `07:91:F9:FB:7C:09:F5:80:5E:2F:FA:AD:D9:9A:9B:A4:D3:E9:4F:66` |
| `android/app/debug.keystore` (projet, utilisé par un build gradle local — **fonctionne**) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| `build-1787511872437.apk` (certificat réel extrait via `apksigner verify --print-certs`, build EAS `development` — **échoue**) | `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` |

Package Android confirmé identique dans les deux cas : `com.altitudevision.altimmo` (`aapt2 dump badging` sur l'APK EAS = `app.config.js` `android.package`). **Le package n'est pas en cause — uniquement le SHA-1.**

`eas.json` ne définit `credentialsSource` pour aucun profil → EAS utilise son mode par défaut (`remote`, credentials gérées et stockées côté cloud Expo) pour le profil `development` — un keystore de debug généré/géré par EAS, distinct à la fois du `~/.android/debug.keystore` de la machine et du `android/app/debug.keystore` versionné dans le projet. C'est ce troisième keystore, `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`, qui signe le build distribué via EAS et testé par l'utilisateur sur le Samsung.

## Cause racine

**Le certificat de signature géré par EAS Cloud Build pour le profil `development` de ce projet n'est pas enregistré comme empreinte SHA-1 sur le client OAuth Android "Altimmo Android" dans Google Cloud Console.** Google Play Services refuse donc la demande de connexion avant même qu'un jeton ne soit émis (`DEVELOPER_ERROR`, code 10) — aucun appel réseau vers le backend Altitude Vision n'est jamais atteint pour ce build.

Ceci n'est **pas** un bug de code : la configuration `GoogleSignin.configure({ webClientId })` est correcte (le `webClientId` déclaré est bien le client Web `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...`, cohérent avec l'usage prévu de la librairie — le SDK Android utilise `webClientId` pour émettre un ID token dont l'audience correspond au client Web, tandis que la vérification SHA-1/package côté Google Play Services répond à un client OAuth Android **distinct**, dont l'existence/l'enregistrement correct n'est jamais référencé dans le code JS).
