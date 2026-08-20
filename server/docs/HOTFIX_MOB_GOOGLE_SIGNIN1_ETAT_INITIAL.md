# HOTFIX-MOB-GOOGLE-SIGNIN-1 — État initial

Date du constat : 2026-08-20 (Africa/Brazzaville).

## Baseline Git

- Branche : `main`
- HEAD : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782`
- Le worktree contenait avant ce hotfix 14 fichiers serveur modifiés et plusieurs fichiers serveur non suivis, sans rapport avec Google Sign-In. Ils ont été préservés.
- `git diff --check` initial : vert.
- Diff initial : 14 fichiers suivis, 292 insertions, 64 suppressions.

## Appareil et binaire réellement installés

- Appareil ADB : Samsung SM-S918B, série `R5CW821Y2JZ`.
- Package installé : `com.altitudevision.altimmo`.
- Version installée : `1.0.1` (`versionCode` 2).
- Flags Android : `DEBUGGABLE`; le binaire installé est donc un build debug/dev-client, pas un binaire Play production.
- Dernière mise à jour observée : 2026-08-18 07:33:38.
- APK extrait du Samsung avec `adb pull`, puis contrôlé avec `apksigner verify --print-certs`.
- Sujet du certificat : `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`.
- SHA-1 réel : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
- SHA-256 réel : `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`.

## Configuration locale initiale

- `app.config.js`, Gradle et le manifeste généré convergent sur `com.altitudevision.altimmo`.
- `@react-native-google-signin/google-signin` résolu en version 16.1.4 (déclaré `^16.1.2`).
- API utilisée : Original API (`GoogleSignin.configure`, `hasPlayServices`, `signIn`), sans migration One Tap.
- `webClientId` était dupliqué en dur dans Login et Register. Il correspond au `GOOGLE_CLIENT_ID` serveur (empreinte interne identique, suffixe masqué `…aac4eumo`) et non au client déclaré Android (`…2pg8li6q`).
- `offlineAccess: false`.
- Aucun `google-services.json` présent dans le workspace.
- Un fichier local ignoré par Git décrit un client installé `…2pg8li6q`, mais ne contient ni package ni empreinte. Il ne prouve pas la configuration Console.
- Aucun `client_secret` OAuth n'est embarqué dans le code suivi ni dans ce fichier local.
- Le profil Gradle local `release` utilise aussi `signingConfigs.debug`. Ce n'est pas une configuration de signature production acceptable ; les signatures EAS et Google Play restent distinctes et non confirmées.

## Limite de preuve

Le Config Doctor officiel a été lancé sur l'APK extrait mais requiert une authentification interactive ; en exécution non interactive il s'arrête sur `Supabase authentication failed / Failed to read email`. La Console Google/Firebase n'est pas accessible dans cet environnement. L'existence d'un client Android pour le couple package + SHA-1 réel est donc **NON CONFIRMÉE**.
