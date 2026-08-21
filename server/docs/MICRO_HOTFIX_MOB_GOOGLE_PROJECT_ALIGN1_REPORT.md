# MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1 — Rapport final

## Verdict

**GO SOUS RÉSERVE — non certifié sur Samsung.**

La configuration locale et EAS est alignée sur le projet Google Cloud Altitude Vision. Le bundle Android généré embarque le nouveau préfixe et plus l'ancien. La validation réelle Login + Signup n'a pas pu être exécutée : le Samsung SM-S918B n'était plus visible dans ADB ; seul `emulator-5554` était connecté.

## Correction réalisée

- `altimmo-app/.env` : client WEB remplacé par celui du projet Altitude Vision.
- `altimmo-app/eas.json` : profils development, staging, preview et production alignés.
- `server/.env` : `GOOGLE_CLIENT_ID` aligné ; ancienne valeur `GOOGLE_CLIENT_ID_ANDROID` retirée localement au lieu de fabriquer un identifiant.
- Aucun client ID ajouté à `googleSignIn.js`.
- Aucun changement de logique d'authentification, aucun secret exposé, aucun changement Google Cloud.
- Tests de non-régression ajoutés pour la variable absente, tous les profils EAS, l'absence d'ID codé en dur et le helper partagé Login/Signup.

## Preuves masquées

- Mobile local et backend local : présent oui, longueur 72, préfixe `872164120879-`, suffixe `…googleusercontent.com`, empreinte courte `39a0dddc1323`.
- Les quatre profils EAS présentent les mêmes métadonnées.
- Metro redémarré avec `--clear` : `.env` chargé et variable publique exportée ; cache vide reconstruit.
- Export Android : 1 occurrence de `872164120879-`, 0 de `3869205293-`.

## Gates

| Gate | Résultat |
|---|---|
| Tests Google ciblés | 13/13 verts |
| Tests mobile complets | 392/392 verts |
| Lint mobile | Vert, 0 erreur (102 avertissements préexistants) |
| TypeScript mobile | Vert |
| Tests backend unitaires | 1425/1425 verts |
| Lint backend | Vert, 0 erreur (106 avertissements préexistants) |
| Expo Doctor | 20/21 ; échec limité à 12 versions patch Expo déjà décalées |
| Export Android `--clear` | Vert |
| Gradle `assembleDebug`, JDK 17 | Vert |
| Samsung Login + Signup | Bloqué : appareil absent d'ADB |
| `git diff --check` | Vert |

Le premier build lancé par le JDK système 26 a échoué sur `jlink`; la relance explicite avec Temurin 17 a produit `BUILD SUCCESSFUL`. Ce point est un problème d'outillage local, pas un défaut du correctif OAuth.

## Validation restante pour CERTIFIÉ VERT

1. Reconnecter le Samsung SM-S918B et confirmer sa présence dans `adb devices -l`.
2. Garder Metro actuel ou le relancer avec `npx expo start --android --clear`.
3. Ouvrir Login puis Signup, déclencher Google, sélectionner un compte et vérifier la session/navigation finale.
4. Capturer Logcat sans token ni donnée personnelle.
5. Si le code 10 réapparaît, reprendre séparément le diagnostic OAuth Android/SHA-1. Si une erreur backend apparaît après sélection, vérifier l'environnement effectif du backend déployé avant toute autre modification.

Aucun commit, push ou déploiement n'a été effectué.

## VALIDATION SAMSUNG FINALE — 2026-08-20

### Device et build

- Device : Samsung Galaxy S23 Ultra, modèle ADB `SM_S918B`.
- Serial : `R5C••••Y2JZ` (masqué dans le rapport), état ADB `device`.
- Package : `com.altitudevision.altimmo`.
- Build installé : version `1.0.1`, versionCode `2`, `DEBUGGABLE`, dernière installation le 2026-08-18.
- SHA-1 vérifié directement sur l'APK installé : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
- Runtime : dev-client via Metro, `.env` rechargé avec `--clear` et `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` exporté. L'export contrôlé précédemment prouve le préfixe `872164120879-` sans exposer l'ID complet.

### Résultats réels

| Étape | Login Google | Signup Google |
|---|---|---|
| Activités natives Google ouvertes | Oui (`SignInHubActivity`, puis `SignInActivity`) | Oui (`SignInHubActivity`, puis `SignInActivity`) |
| Sélection/identité exploitable retournée | Non confirmée | Non confirmée |
| Code 10 observé | Non dans les traces disponibles | Non dans les traces disponibles |
| `DEVELOPER_ERROR` observé | Non | Non |
| Retour dans l'application | Oui | Oui |
| Résultat UI | Alerte « Connexion Google échouée » / « Impossible de se connecter avec Google. Utilisez votre email et mot de passe. » | Retour silencieux sur l'écran Signup |
| Backend `/api/auth/google` appelé | Non observé | Non observé |
| HTTP status backend | Sans objet | Sans objet |
| Session Altimmo créée | Non | Non |
| Navigation finale réussie | Non | Non |

### Résumé Logcat expurgé

- Les deux essais montrent le lancement puis la fermeture des activités Google Play Services.
- Aucune occurrence explicite de `DEVELOPER_ERROR`, `ApiException`, code 10 ou appel `/api/auth/google` n'est présente dans les traces accessibles.
- Aucun token, JWT, email complet ou autre donnée personnelle n'est consigné dans ce rapport.
- L'absence d'un code technique explicite ne permet pas de certifier que le problème OAuth est résolu : les deux parcours restent fonctionnellement incomplets avant le backend.

### Verdict final device

**MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1 : GO SOUS RÉSERVE — NON CERTIFIÉ VERT.**

La configuration de projet est bien injectée et le flux natif Google est lancé, mais les critères de certification ne sont pas atteints : aucune identité exploitable, aucun appel backend, aucune session et aucune navigation finale sur Login comme sur Signup. Conformément au protocole device, aucune correction supplémentaire n'a été tentée ; ce résultat nécessite un diagnostic séparé.
