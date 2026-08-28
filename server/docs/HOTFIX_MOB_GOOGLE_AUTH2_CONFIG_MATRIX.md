# HOTFIX-MOB-GOOGLE-AUTH-2 — MATRICE DE CONFIGURATION

## Web vs Android — séparation vérifiée

| Surface | Client OAuth | Token/code | Backend endpoint | Audience vérifiée |
|---|---|---|---|---|
| Web (NextAuth, `HOTFIX-WEB-GOOGLE-AUTH-1`) | Client Web `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...` | `id_token` (flux OAuth serveur NextAuth) | `POST /auth/google` (même contrôleur) | `process.env.GOOGLE_CLIENT_ID` (+ `GOOGLE_CLIENT_ID_ANDROID`/`_IOS` si définies) |
| Android (`@react-native-google-signin/google-signin`) | **`webClientId` = le même client Web** `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...` (usage prévu par la librairie — pas une confusion Web/Android) | `idToken` natif (`GoogleSignin.signIn()`) | `POST /auth/google` (même contrôleur, même route que Web) | Identique — le `idToken` émis a pour audience le client Web, accepté par `GOOGLE_CLIENT_ID` |

**Vérifié : Web et Android partagent intentionnellement le même endpoint backend et la même vérification d'audience** — ce n'est pas une confusion, c'est le fonctionnement prévu de `@react-native-google-signin/google-signin` avec `webClientId` (voir sa documentation officielle : `webClientId` doit être le Client Web du même projet Google Cloud, utilisé pour obtenir un ID token vérifiable côté serveur). Le "client OAuth Android" distinct (nommé "Altimmo Android" dans Google Cloud Console) n'est **jamais référencé dans le code** — son seul rôle est de permettre à Google Play Services de reconnaître, via le couple `package + SHA-1`, que l'application appelante est légitime, **avant** même de retourner un ID token au SDK. C'est cette vérification qui échoue avec `DEVELOPER_ERROR`.

## SHA-1 par source de build

| Build | Origine du keystore | SHA-1 | Google Sign-In observé |
|---|---|---|---|
| Build gradle local (`android/app/debug.keystore`, versionné dans le dépôt) | Local, fichier du projet | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | **Fonctionne** (confirmé par l'utilisateur) |
| `build-1787511872437.apk` (EAS, profil `development`, `credentialsSource` non défini → `remote`) | Géré par EAS Cloud (distant, aucun fichier local correspondant) | `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` | **Échoue** (confirmé par l'utilisateur) |
| `~/.android/debug.keystore` (machine locale) | Local, machine développeur | `07:91:F9:FB:7C:09:F5:80:5E:2F:FA:AD:D9:9A:9B:A4:D3:E9:4F:66` | Non testé isolément — probablement inutilisé pour ce projet (ni le build local ni le build EAS ne l'utilisent) |

**Package Android confirmé identique** dans les deux builds testés : `com.altitudevision.altimmo` (`app.config.js` et vérification `aapt2 dump badging` sur l'APK EAS concordent).

## Variables d'environnement (noms et sources uniquement, jamais de valeur secrète)

| Variable | Présente | Source |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Oui | `eas.json` (4 profils, valeur identique), `.env.example` (vide, à renseigner localement) |
| `GOOGLE_CLIENT_ID` (backend) | Oui | `server/.env` |
| `GOOGLE_CLIENT_ID_ANDROID` (backend) | **Non présente localement** | Référencée dans `authController.js` comme audience additionnelle optionnelle — absence non bloquante puisque le flux mobile utilise déjà l'audience du client Web |
| `GOOGLE_CLIENT_ID_IOS` (backend) | **Non présente localement** | Idem, non concernée par ce hotfix (Android uniquement) |
| `credentialsSource` (EAS) | Absente de `eas.json` pour tous les profils | EAS utilise donc son comportement par défaut (`remote`) — un keystore géré et stocké côté cloud Expo, distinct de tout fichier local du dépôt |

## Cause racine confirmée (config uniquement, aucun code fautif)

Le client OAuth Android "Altimmo Android" (Google Cloud Console) n'a très vraisemblablement enregistré que le SHA-1 du build gradle local (`5E:8F:16:06:...`), jamais celui du keystore distant géré par EAS (`62:49:CC:78:...`). **Ceci ne peut être confirmé à 100 % que par un accès direct à Google Cloud Console, auquel cette session n'a pas accès** — la preuve technique apportée (deux SHA-1 distincts, deux comportements observés distincts et cohérents) constitue une preuve indirecte mais très forte, pas une lecture directe de la configuration Google Cloud elle-même.

## Action corrective requise (hors code, nécessite un accès humain à Google Cloud Console)

Dans Google Cloud Console → APIs & Services → Identifiants → client OAuth **"Altimmo Android"** :
1. Vérifier le SHA-1 actuellement enregistré.
2. **Ajouter** (ne pas remplacer) l'empreinte `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` comme SHA-1 supplémentaire — un client OAuth Android peut porter plusieurs empreintes (une par variante de build : debug local, EAS development, EAS preview/staging si elles utilisent aussi des credentials distinctes, release/production signée Play App Signing).
3. Conserver l'empreinte existante (`5E:8F:16:06:...`) pour ne pas casser le build gradle local qui fonctionne déjà.
4. Attendre quelques minutes (propagation Google) puis retester la connexion Google sur le build EAS installé, **sans reconstruire l'APK** — un changement Google Cloud n'exige aucun rebuild natif côté application (le SHA-1 est vérifié au moment de l'appel `GoogleSignin.signIn()`, pas au moment du build).

**Aucune modification de code n'est nécessaire pour ce correctif** — la configuration applicative (`webClientId`, package, plugin) est déjà correcte, confirmée par le fait que le même code fonctionne parfaitement avec le build gradle local.
