# HOTFIX-MOB-GOOGLE-AUTH-3 — MATRICE DES CLIENT IDS

Inventaire exhaustif, lecture seule. Les Client IDs OAuth ne sont pas des secrets (rappel du mandat) — préfixes/longueurs identifiés clairement ; aucun `client_secret` n'est jamais affiché.

| Variable | Valeur/préfixe | Fichier | Consommateur | Type attendu | Projet Google Cloud probable |
|---|---|---|---|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com` | `altimmo-app/.env` | `environment.ts` → `googleSignIn.js` `configureGoogleSignIn()` (`webClientId`) | Web | **Altitude Vision** (`872164120879-`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Identique, 4 occurrences | `altimmo-app/eas.json` (profils `development`, `staging`, `preview`, `production`) | Build EAS — injecté à la compilation | Web | Altitude Vision |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Vide (placeholder) | `altimmo-app/.env.example` | Documentation développeur | Web | N/A |
| `GOOGLE_CLIENT_ID` | `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com` | `server/.env` (local) | `authController.js` `OAuth2Client(...)`, audience `verifyIdToken` | Web | Altitude Vision |
| `GOOGLE_CLIENT_ID_ANDROID` | **Absente** | `server/.env` (local) | Référencée dans `authController.js:45` comme audience additionnelle optionnelle, jamais définie localement | Android | N/A — non configurée localement |
| `GOOGLE_CLIENT_ID_IOS` | Ligne commentée (`# GOOGLE_CLIENT_ID_IOS=`) | `server/.env` (local) | Idem, commentée | iOS | N/A |
| `GOOGLE_CLIENT_ID` | `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com` | `client/.env.local` | NextAuth Web (`route.js`, hors périmètre mobile) | Web | Altitude Vision |
| `GOOGLE_CLIENT_ID` | Vide (placeholder) | `client/.env.example` | Documentation développeur | Web | N/A |
| — | Absent | `altimmo-app/android/` (recherche exhaustive `googleusercontent`/`oauth_client`/`client_id`) | Aucun fichier natif Android ne référence de Client ID Google en dur | — | — |
| — | Absent | Recherche exhaustive du dépôt | **Aucun `google-services.json` présent** | — | Confirme l'absence d'intégration Firebase — le flux passe uniquement par `@react-native-google-signin/google-signin`, jamais Firebase Auth |
| Fichier local non suivi | `3869205293-5d0vk1p5vanhoocdk3d4hr442pg8li6q.apps.googleusercontent.com` | `altimmo-app/client_secret_3869205293-….json` | Aucun (jamais lu par le code, jamais importé) | Non déterminé (nom de fichier suggérant un téléchargement de credential OAuth "Desktop"/"Autre" ou un artefact EAS) | **My First Project** (`3869205293-`) |

## Backend production (Render) — NON CONFIRMÉ

Aucun accès à la configuration runtime effective du service Render `altitude-vision.onrender.com` depuis cette session (confirmé déjà par `HOTFIX-BACK-GOOGLE-AUTH-401-1`, non réévalué ici car strictement hors du périmètre mobile de ce mandat, mais **directement pertinent** — voir `HOTFIX_MOB_GOOGLE_AUTH3_PROJECT_OWNERSHIP.md`). La valeur `GOOGLE_CLIENT_ID` réellement chargée par le processus Render déployé est **NON CONFIRMÉE** ; un rapport antérieur soupçonne, sans preuve, qu'elle serait restée sur l'ancien préfixe `3869205293-`.

## `GoogleSignin.configure()` — contrat exact de la version installée

`@react-native-google-signin/google-signin@16.1.4` (version confirmée dans `node_modules/.../package.json`). Lecture directe de `lib/typescript/src/types.d.ts` :

```ts
export type ConfigureParams = {
  scopes?: string[];
  webClientId?: string;        // ← seul champ utilisé par ce projet (googleSignIn.js:18)
  offlineAccess?: boolean;     // ← configuré à `false` (googleSignIn.js:19)
  hostedDomain?: string;
  forceCodeForRefreshToken?: boolean;  // ANDROID ONLY
  accountName?: string;                // ANDROID ONLY
  openIdRealm?: string;                // iOS ONLY
  profileImageSize?: number;           // iOS ONLY
} & ClientIdOrPlistPath;               // { iosClientId? } | { googleServicePlistPath? } — non utilisés (Android uniquement dans ce hotfix)
```

**Il n'existe aucun paramètre `androidClientId` dans cette bibliothèque.** Le SDK Android ne reçoit et ne transmet jamais explicitement un identifiant de client Android depuis le code JavaScript — la résolution du client Android se fait entièrement côté natif, par Google Play Services, à partir du **package de l'application** et du **SHA-1 du certificat de signature de l'APK installé**, en cherchant un client OAuth Android correspondant **dans le même projet Google Cloud que le `webClientId` fourni**. C'est ce mécanisme implicite qui explique le comportement observé — voir `HOTFIX_MOB_GOOGLE_AUTH3_AUTH_FLOW.md`.

`serverAuthCode` n'est jamais utilisé (non demandé, `offlineAccess: false`) — confirmé par lecture de `googleSignIn.js`, aucune trace ailleurs dans `src/`.

## Vérification package/applicationId — convergence confirmée

| Source | Valeur |
|---|---|
| `altimmo-app/app.config.js` `android.package` | `com.altitudevision.altimmo` |
| `altimmo-app/android/app/build.gradle` `namespace` | `com.altitudevision.altimmo` |
| `altimmo-app/android/app/build.gradle` `applicationId` | `com.altitudevision.altimmo` |
| APK EAS réel (`aapt2 dump badging build-1787511872437.apk`) | `com.altitudevision.altimmo` |

**Aucune divergence de package** — confirmé par 4 sources indépendantes, dont une lecture directe du binaire réel. Le package n'est jamais en cause dans ce dossier.
