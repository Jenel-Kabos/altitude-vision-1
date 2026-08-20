# HOTFIX-MOB-GOOGLE-SIGNIN-2 — Diagnostic

Date : 2026-08-20. Appareil : Samsung SM-S918B.

## Erreur native prouvée

Le Signup Google a été reproduit sur le vrai Samsung avec logcat remis à zéro. La trace React Native remonte :

- code : `10`
- message : `DEVELOPER_ERROR`
- classification : `DEVELOPER_ERROR / 10`

La trace Google Play Services donne la cause détaillée, avant émission de toute identité : les clients Android et Web (`server client ID`) doivent appartenir au même projet Google Cloud.

Chronologie observée :

1. appui sur « S'inscrire avec Google » ;
2. ouverture de `SignInHubActivity`, puis des activités Google Sign-In ;
3. résolution du client refusée par Google Play Services ;
4. fermeture immédiate du flow ;
5. retour à Altimmo avec code 10 ;
6. Alert UX générique, sans donnée sensible.

Le sélecteur de compte utilisable n'est pas atteint. Aucun `idToken`, aucune identité Google et aucune requête backend Altimmo ne sont produits.

## Build et configuration effectifs

- package installé : `com.altitudevision.altimmo`
- version : 1.0.1 (`versionCode` 2), `DEBUGGABLE`
- date de dernière installation : 2026-08-18 07:33:38
- SHA-1 recalculé depuis l'APK extrait du Samsung : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- correspondance package/SHA-1 annoncée dans Google Console : oui, selon le contexte utilisateur
- Google Play Services : présent, version active 26.30.32 (260400-956658866)
- `hasPlayServices()` est exécuté avant `signIn()` et ne lève pas d'erreur ; `PLAY_SERVICES_NOT_AVAILABLE` est exclu

Configuration effective :

```js
GoogleSignin.configure({
  webClientId: environment.googleWebClientId,
  offlineAccess: false,
});
```

Aucun `forceCodeForRefreshToken`, aucun `scope` additionnel et aucun client ID en dur dans le helper.

La variable runtime est présente, longue de 70 caractères, préfixée `3869205293-…` et suffixée `….googleusercontent.com`. Elle correspond au Client ID WEB indiqué dans le contexte utilisateur. Les Client IDs WEB et Android déclarés dans les fichiers locaux partagent le préfixe de projet `3869205293`, mais le Client Android local n'établit pas quel client package/SHA-1 Google Play Services résout réellement dans la Console.

## Cause racine

**Cause prouvée par Google Play Services : le client OAuth Android résolu pour le package/certificat installé n'est pas dans le même projet Google Cloud que le Client ID WEB réellement envoyé comme `webClientId`.**

Cela signifie que la vérification Console doit être faite dans le projet portant le Client ID WEB runtime, et non seulement dans un projet contenant un client Android de même package/SHA-1.

## Éléments non confirmés

- nom/ID du projet Console contenant actuellement le client Android package/SHA-1 : **NON CONFIRMÉ**
- nom/ID du projet Console contenant le client WEB : préfixe numérique prouvé, nom lisible **NON CONFIRMÉ**
- audience Testing/In production : **NON CONFIRMÉE**
- nécessité d'un utilisateur test : sans effet avant chooser, mais statut Console **NON CONFIRMÉ**
- Config Doctor : non exécuté dans ce passage, car l'analyse externe d'un APK privé n'a pas été autorisée
