# Google Play — Privacy & Data Safety audit (Altimmo)

Sprint : préparation soumission Google Play.
Date : 2026-09-29 (gate de clôture P0). Commit HEAD audité : `46644bee0cc238e82efdedabd29bec79512c7541`.
Branch : `main`.

**Statut** : après le sprint de remédiation, P0-1 (account deletion) est
CODE_CLOSED. P0-2 (Google Maps) était basé sur un constat incorrect — la
clé n'a jamais été suivie par Git (voir §8 corrigée). Une rotation
opérationnelle reste néanmoins recommandée
(`docs/compliance/google-maps-key-rotation.md`).

Ce document consolide l'audit code + configuration. Deux documents
compagnons :

- `docs/compliance/google-play-data-safety.md` — matrice Data Safety
- `docs/compliance/google-play-console-answers.md` — réponses Play Console

Aucun commit, aucun push, aucun déploiement effectué dans ce sprint.
Aucun fichier de politique publique créé — les pages existent déjà :

- Web : `client/app/politique-confidentialite/page.jsx` →
  `client/lib/pages/PolitiqueConfidentialite.jsx` (429 l.)
- Mobile : `altimmo-app/src/screens/Profil/PolitiqueConfidentialiteScreen.jsx` (417 l.)
- Mentions légales web : `client/lib/pages/MentionsLegales.jsx` (343 l.)

---

## 1. Architecture confirmée

| Composant | Chemin | Stack |
|---|---|---|
| Backend | `server/` | Node.js/Express, MongoDB Mongoose, Socket.IO, node-cron |
| Frontend web | `client/` | Next.js 15 App Router, React 18, Tailwind 3 |
| Mobile | `altimmo-app/` | Expo `~57.0.25`, RN `0.86.3`, package **`com.altitudevision.altimmo`** v1.0.1 (`versionCode: 2`) |
| Hébergement backend | Render.com | `https://altitude-vision.onrender.com` (référencé dans `client/next.config.mjs`) |
| Hébergement web | Netlify | `netlify.toml`, domaine `altitudevision.agency` |
| CDN médias | Cloudinary | `server/config/cloudinary.js` |
| Push mobile | Expo Push Service | `notificationsService.js`, `getExpoPushTokenAsync` |
| Crash reporting mobile | Sentry (`altimmo-mobile` / org `altitudevision`) | `App.js` `Sentry.init`, plugin dans `app.config.js:113` |
| Auth Google | `@react-native-google-signin/google-signin` mobile ; `passport-google-oauth20`/similaire côté server | `googleSignIn.js` |
| Analytics web | Google Analytics (GA4) | `client/lib/components/GoogleAnalytics.jsx` |
| Cartographie | Google Maps Android + `react-native-maps` | `app.config.js:70-72`, injection par variable d'environnement uniquement |
| Email transactionnel | Zoho SMTP + OAuth (org Altitude Vision) | `server/config/email.js` |

---

## 2. Inventaire des données

Résumé exécutif (détail complet dans `google-play-data-safety.md`) :

- **Identité** : nom, prénom, email (req), téléphone (req selon
  authProvider), photo profil (opt), rôle.
- **Auth** : password bcrypt (`server/models/User.js:164 bcrypt.hash(..., 12)`),
  JWT `Authorization: Bearer`, `tokenVersion` pour révocation, providers
  `local | google | phone`.
- **Localisation** : approximative (recentrage carte, `CarteScreen.jsx`)
  et précise (position GPS d'un **bien** capturée par l'annonceur dans
  `PublierBienScreen.jsx:244-249`). Pas de tracking continu, pas de
  background location.
- **Photos/fichiers** : biens immobiliers, avatars, pièces jointes
  messagerie, dossiers locataires, litiges. Route serveur → Cloudinary.
- **Messagerie** : Socket.IO + `internalMessageController.js`, persistée
  MongoDB.
- **Métier** : annonces (Property), transactions (`Transaction.js`),
  visites, offres, réservations hôtel, contrats/baux, factures.
- **Device/App** : Expo push token (Expo Push Service), device metadata
  Sentry, IP côté serveur (logs Express).
- **Analytics** : Google Analytics **côté web uniquement**. Aucun
  analytics tiers côté mobile.
- **Ads** : aucune.

---

## 3. Permissions Android

Fichier source : `altimmo-app/app.config.js:87-93` — 5 permissions
déclarées.
Manifeste fusionné réel : `altimmo-app/android/app/src/main/AndroidManifest.xml:2-14` —
13 permissions (auto-injectées par les modules natifs).

| Permission | Déclarée par | Justification | Statut |
|---|---|---|---|
| `ACCESS_COARSE_LOCATION` | `app.config.js` + `expo-location` | Carte : recentrage utilisateur | **Nécessaire** |
| `ACCESS_FINE_LOCATION` | `app.config.js` + `expo-location` | Publier bien : capture GPS | **Nécessaire** |
| `CAMERA` | `app.config.js` + `expo-camera` | Prise photo annonces, avatar | **Nécessaire** |
| `READ_MEDIA_IMAGES` | `app.config.js` + `expo-image-picker` | Sélection photo bien/avatar (Android 13+) | **Nécessaire** |
| `READ_EXTERNAL_STORAGE` | `app.config.js` (avec `maxSdkVersion=32` dans manifeste) | Sélection fichier < Android 13 | **Nécessaire (legacy)** |
| `WRITE_EXTERNAL_STORAGE` | Manifest merger (`maxSdkVersion=32`) | Cache Expo/Cloudinary sur legacy Android | **Recommandation : à confirmer, hérité** |
| `INTERNET` | Merger (RN core) | Requêtes API | **Nécessaire** |
| `FOREGROUND_SERVICE` | Merger (`expo-audio`) | Service `AudioControlsService` déclaré | **Justifié** par la lecture des pièces jointes audio dans `ChatScreen.jsx` |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Merger (`expo-audio`) | Service audio | **Justifié** par la lecture audio et les contrôles média |
| `MODIFY_AUDIO_SETTINGS` | Merger (`expo-audio` / `expo-video`) | Lecture vidéo/audio | **À justifier** |
| `RECORD_AUDIO` | Bloquée dans `app.config.js` | Aucun flow d'enregistrement audio dans `src/` | **Retrait configuré** |
| `SYSTEM_ALERT_WINDOW` | Bloquée dans `app.config.js` | Aucun usage overlay explicite | **Retrait configuré** |
| `VIBRATE` | Merger (`expo-haptics` / `expo-notifications`) | Feedback haptique / notifications | **Nécessaire** |

**Verdict permissions** : le prebuild temporaire contient les directives
`tools:node="remove"` pour `RECORD_AUDIO` et `SYSTEM_ALERT_WINDOW`. Le manifest
debug fusionné confirme `RECORD_AUDIO` absent ; `SYSTEM_ALERT_WINDOW` y est
réintroduite uniquement par le manifest debug d'Expo Dev Client. La preuve
fusionnée **release** reste à obtenir sur le prochain build signé. La permission
de service média reste justifiée par `expo-audio` et `ChatScreen.jsx`.

---

## 4. SDK / services tiers actifs

| SERVICE | ACTIVE | DATA_SENT | PURPOSE | SOURCE_CODE_EVIDENCE | PLAY CLASSIFICATION |
|---|---|---|---|---|---|
| Cloudinary | YES | Photos, PDF, documents | Stockage médias/documents | `server/config/cloudinary.js`, routes `rentalPropertyRoutes.js`, `estimationRoutes.js`, `tenantPortalRoutes.js`, `litigeRoutes.js` | Service provider |
| Expo Push Service | YES | Push token appareil, payload notification | Notifications push | `altimmo-app/src/services/notificationsService.js:24` | Service provider |
| Expo Updates (EAS Update) | YES | Version app, canal | OTA updates | `app.config.js:34-40` `updates.url` | Service provider |
| Sentry | YES | Crash stack, breadcrumbs, device metadata, éventuel userId | Crash reporting / diagnostics | `App.js` Sentry.init ; plugin `app.config.js:113-119` | Service provider |
| Google Sign-In | YES (mobile) | ID token Google | Auth OAuth | `altimmo-app/src/services/googleSignIn.js` | Service provider (Google) |
| Google Maps SDK | YES (mobile Android) | Requêtes tuiles, coords | Rendu carte | `app.config.js:70-72`, `AndroidManifest.xml:23` | Service provider (Google) |
| Google Analytics 4 | YES (**web seulement**) | Événements page, ID cookie GA | Analytics | `client/lib/components/GoogleAnalytics.jsx` | À déclarer dans la politique web si Data Safety concerne l'app mobile Play : **NON pertinent** pour la fiche Play |
| Zoho Mail (SMTP + Mail API) | YES (backend) | Email destinataire | Emails transactionnels | `server/config/email.js` | Service provider |
| MongoDB (Atlas/Render) | YES | Toutes données persistantes | Base de données | `server/config` | Service provider |
| Facebook Graph API | YES (backend, en pull) | ID de page Altitude Vision (pas d'utilisateur) | Import posts vitrine | `server/scripts/sync-facebook.js` | **Pas de donnée utilisateur envoyée**. Pas de partage Facebook côté user |
| WebView (react-native-webview) | YES (mobile) | Selon URL chargée | Paiement externe, contenu tiers | Import dans `altimmo-app` | Neutre |

Aucun SDK publicitaire (AdMob, Meta Audience Network, AppsFlyer, Segment,
Mixpanel, Amplitude, Firebase Analytics) détecté.

---

## 5. Stockage local mobile

| Mécanisme | Données | Sensible | Cleared logout | Cleared tenant switch |
|---|---|---|---|---|
| **SecureStore** (`expo-secure-store`) | `platformTenantRuntime` = `{ userId, tenantId }` | Modéré (contexte tenant) | À confirmer — voir `PlatformTenantRuntimeContext.jsx:44` (delete quand `tenantId` vide) | Oui (setItem sur switch) |
| **AsyncStorage** | `theme`, `onboarding_complete`, `notifications_enabled` (`ProfilScreen.jsx`) | Non sensible | Non nécessaire (préférences UX) | N/A |
| **Sentry storage** | Breadcrumbs offline | Sensible (peuvent contenir contexte utilisateur) | Contrôlé par Sentry SDK | N/A |
| **HTTP client tokens** | JWT en mémoire (`api.js`), potentiellement dans headers axios | Sensible | À confirmer — l'inspection rapide n'a pas révélé de persistance disque du JWT ; s'il est stocké : à préciser | – |

**À valider humainement** : où le JWT mobile est-il persisté (SecureStore
ou seulement en mémoire pendant la session) ? Cf. `AuthContext` mobile.
Non modifié dans ce sprint (architecture multi-tenant ne doit pas
bouger — CLAUDE.md invariants).

---

## 6. Suppression du compte (après remédiation P0-1)

- **ACCOUNT_CREATION** : YES (inscription email + Google Sign-In).
- **IN_APP_DELETION** : ✅ **IMPLÉMENTÉ** — écran
  `altimmo-app/src/screens/Profil/ProfilScreen.jsx`, danger zone,
  bouton "Supprimer mon compte" avec double confirmation.
- **WEB_DELETION** : ✅ **PAGE PUBLIQUE** — `client/app/supprimer-mon-compte/page.jsx`
  (route `/supprimer-mon-compte`) explique la procédure et offre le
  contact `support@altitudevision.agency`. La page ne déclenche
  volontairement pas de suppression via formulaire non authentifié
  (protection contre les demandes malveillantes).
- **BACKEND_SUPPORT** : ✅ **IMPLÉMENTÉ** —
  - Route : `DELETE /api/users/me` (`server/routes/userRoutes.js`, bloc
    "utilisateur connecté", protégé par `protect`).
  - Controller : `userController.deleteMyAccount`. L'autorité provient
    exclusivement de `req.user._id` ; aucun paramètre d'identité n'est
    accepté depuis le client.
  - Service : `server/services/accountSelfDeletionService.js`.
    Stratégie **soft-delete + anonymisation** :
    - `User.status = 'Supprimé'`, `isActive = false` (bloqué par
      `authMiddleware.protect`),
    - `tokenVersion++` (invalide toutes les sessions JWT existantes),
    - anonymisation : nom → "Utilisateur supprimé", email → alias
      unique `deleted-<id>@deleted.altitudevision.local`, téléphone /
      photo / bio / pushToken / googleId → nulls,
    - password réécrit avec un secret aléatoire,
    - `OrgMembership` actives révoquées en transaction avec l'anonymisation,
    - avatar Cloudinary détruit (best effort, hors transaction).
- **LAST_ADMIN_PROTECTION** : ✅ — erreur
  `LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED` (409) si l'utilisateur
  est seul Admin actif d'au moins un tenant. Le détail des tenants
  bloquants est renvoyé pour orienter l'UI.
- **BUSINESS_RECORDS_RETAINED** : ✅ — Property, Transaction, Contrat,
  Invoice, Payment, Message, Notification, etc. ne sont pas touchés.
  Ils continuent à référencer l'ObjectId User, désormais anonyme.
- **TESTS** :
  `server/__tests__/accountSelfDeletion.mongo.integration.test.js` —
  8 tests : 401 sans auth, anonymisation complète, idempotence,
  isolation inter-utilisateurs, révocation memberships, last-admin
  bloqué, admin non-dernier autorisé, invalidation JWT.
- **VERDICT** : ✅ **CODE_CLOSED**.

**Décisions humaines restantes (non bloquantes pour Play)** :
1. Durées de conservation applicables (facturation / litiges) en République du Congo / Congo-Brazzaville — revue juridique humaine requise et à
   documenter dans la politique de confidentialité et éventuellement
   à automatiser via une purge programmée.
2. Faut-il notifier les autres participants d'une conversation lorsqu'un
   auteur est anonymisé ? Non implémenté (choix conservateur : ne pas
   spammer les tiers).

---

## 7. Politique de confidentialité existante

- Route web : `/politique-confidentialite` (locale : rendu confirmé par
  lecture du composant ; production : non vérifiée dans ce sprint).
- Écran mobile : `PolitiqueConfidentialiteScreen.jsx` accessible depuis
  Profil.
- Contact : `support@altitudevision.agency`, `+242 06 800 21 51`,
  Brazzaville, République du Congo (`PolitiqueConfidentialite.jsx:31-45`).

**Points à mettre à jour dans la politique existante** (non fait dans
ce sprint car dirty worktree préservé et politique déjà présente) :

1. Ajouter mention explicite de **Sentry** (crash reporting mobile).
2. Ajouter mention explicite d'**Expo Push Service** (notifications).
3. Ajouter mention **Cloudinary** (stockage médias).
4. Ajouter mention **Google Maps SDK** et **Google Sign-In**.
5. Documenter la **procédure de suppression de compte** dès qu'elle
   sera implémentée.
6. Vérifier que la phrase "Nous ne partageons jamais vos données avec
   des tiers à des fins commerciales" (si présente) reste **précise et
   vérifiable** — préférer "Nous ne vendons pas vos données ; nous
   utilisons des sous-traitants techniques listés ci-dessus".

---

## 8. Sécurité — Google Maps (correction du constat initial)

L'audit initial affirmait que le manifest Android était suivi par Git.
**Ce constat était incorrect** :

```bash
git ls-files altimmo-app/android      # 0 fichier tracké
git grep -E "AIza[A-Za-z0-9_-]{35}"    # aucun résultat
```

`altimmo-app/.gitignore` contient `/android` : tout le dossier natif
généré par `expo prebuild` est exclu.

- **CLÉ_GOOGLE_MAPS_DANS_GIT** : ❌ non — jamais tracké. Aucun secret à
  extirper de l'historique.
- **CLÉ_SUR_FILESYSTEM_LOCAL** : non vérifié pendant ce gate ; aucune valeur secrète n'a été lue. Un manifest temporaire a été généré avec une valeur factice
  `build-1787511872437.apk` (149 Mo, non tracké) contiennent la clé.
- **EXPOSITION EXTERNE** : dépend d'où cet APK a été distribué. Si
  jamais partagé (EAS internal distribution, test interne, upload Play
  Console non publié), la clé est extractible via `apktool`.
- **MÉCANISME EN PLACE** : `altimmo-app/app.config.js:4-11` lit la clé
  via `process.env.GOOGLE_MAPS_ANDROID_API_KEY` et refuse un build EAS
  Android sans elle. Aucun changement de code nécessaire.

**Action recommandée (opérationnelle, humaine)** : rotation de la clé
Google Cloud + restriction Android + rebuild AAB. Runbook complet dans
`docs/compliance/google-maps-key-rotation.md`.

### Permissions Android — remédiation P0-3

`altimmo-app/app.config.js` déclare désormais un
`android.blockedPermissions` :

```
'android.permission.RECORD_AUDIO',
'android.permission.SYSTEM_ALERT_WINDOW',
```

Elles étaient injectées par des modules natifs (`expo-audio`,
`react-native-modal`) sans usage applicatif dans le code de l'app.

**Vérification effectuée** : `npx expo config --json` confirme que le
champ `android.blockedPermissions` est bien résolu par Expo au niveau
config :

```json
"blockedPermissions": [
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW"
]
```

**Vérification non destructive** : un prebuild a été exécuté dans une copie
contrôlée sous `/private/tmp`, avec une valeur Maps factice. Le projet et son
dossier `android/` local n'ont pas été modifiés. Le manifest principal généré
porte les deux directives de retrait. La fusion debug réussit ; la fusion
release a été arrêtée par l'upload Sentry faute de token et n'a pas été
contournée. `ANDROID_RELEASE_MANIFEST_REBUILD_PENDING`.

`FOREGROUND_SERVICE_MEDIA_PLAYBACK` et le service `AudioControlsService`
restent (auto-ajoutés par `expo-audio` pour la lecture des annonces
vidéo/audio). Justification à préparer pour la fiche Play si nécessaire.

---

## 9. Tests / QA (exécutés dans le closure gate)

Résultats réels des suites lancées :

| Suite | Résultat | Détail |
|---|---|---|
| Backend ciblé suppression/auth/membership/last-admin | **97/97 PASS**, 7 suites | Jest + MongoMemoryReplSet |
| Backend unit (`npm run test:unit`) | 1700 PASS / 3 échecs (timeout `propertyRoutes`, 2 attentes `rentalDossiersRoutes`) | 157 suites |
| Backend Mongo complet (`npm run test:mongo`) | **BLOCKED** | interrompu après 4 h 34 ; timeout 180 s observé dans `postContractContratTenantAuthority2E2XIII.mongo.integration.test.js` ; aucun total final fiable |
| Frontend targeted (`SupprimerMonCompte.test.jsx`, `PolitiqueConfidentialite.privacy.test.jsx`) | **12/12 PASS**, 2 suites | Vitest |
| Frontend complet (`npm test`) | **1191/1191 PASS**, 157 suites | Vitest |
| Mobile targeted (suppression + politique) | **8/8 PASS**, 2 suites | Jest Expo |
| Mobile complet (`npm test`) | **605/605 PASS**, 69 suites | Jest Expo |
| Client lint | 0 erreurs (280 warnings pré-existants) | ESLint |
| Mobile lint | 0 erreurs (129 warnings pré-existants) | ESLint |
| Mobile typecheck | OK | tsc --noEmit |
| Expo Doctor | **21/21 OK** | npx expo-doctor |
| Next.js build | OK — `/politique-confidentialite` (9.71 kB), `/supprimer-mon-compte` (3.79 kB) rendues statiques | npm run build:next |
| `git diff --check` | clean | — |

QA visuelle navigateur/émulateur : `BLOCKED_ENVIRONMENT` (aucun
navigateur/émulateur interactif dans cette session).

---

## 10. Contrôle final de cohérence

| Contrôle | Statut | Commentaire |
|---|---|---|
| `PRIVACY_VS_CODE_CONSISTENCY` | **PASS** | Politiques web/mobile alignées sur Sentry, Expo, Cloudinary, Google Maps, Google Sign-In et suppression. |
| `DATA_SAFETY_VS_CODE_CONSISTENCY` | **PASS** | Cette matrice a été construite depuis le code. |
| `ANDROID_PERMISSIONS_CONSISTENCY` | **PARTIAL** | Retraits configurés et prebuild prouvé ; manifest release fusionné attendu au prochain build signé. |
| `ACCOUNT_DELETION_CONSISTENCY` | **PASS** | Endpoint, service, UI et tests ciblés confirmés. |

---

## 11. Rapport initial historique — OBSOLÈTE

> Ce bloc est conservé comme trace de l'audit initial. Il est explicitement
> remplacé par le `GOOGLE_PLAY_P0_CLOSURE_REPORT` du 2026-09-29 et ne doit pas
> être utilisé pour une décision de release.

```
GOOGLE_PLAY_PRIVACY_DATA_SAFETY_REPORT

GIT_BASELINE
- branch: main
- HEAD: 1f5c74fa88cc62871ebb4372e39e41165344359a
- origin/main: 1f5c74fa88cc62871ebb4372e39e41165344359a
- initial_worktree: clean
- final_worktree: clean sauf 3 nouveaux fichiers dans docs/compliance/ (non commit)

ARCHITECTURE_AUDIT
- web: Next.js 15 App Router (client/), Netlify
- mobile: Expo ~57.0.25 / RN 0.86.3 (altimmo-app/)
- backend: Express + MongoDB + Socket.IO (server/), Render
- android_package: com.altitudevision.altimmo v1.0.1 (versionCode 2)

DATA_INVENTORY
- personal_info: nom, prénom, email (req), téléphone, photo, rôle
- location: approx (recentrage carte) + précise (GPS d'un bien publié)
- photos_videos: photos et vidéos de biens via Cloudinary ; upload vidéo confirmé dans `PublierBienScreen`
- files_documents: dossiers locataires, litiges, contrats, factures — Cloudinary
- messages: in-app (Socket.IO + MongoDB)
- financial: purchase history métier (transactions, réservations, loyers); aucune donnée bancaire dans le code
- app_activity: Google Analytics WEB uniquement — pas de mobile analytics tiers
- device_ids: Expo push token, device metadata Sentry
- diagnostics: Sentry crash + breadcrumbs
- other: contenu utilisateur (annonces, avis, offres)

ANDROID_PERMISSIONS
- permissions: ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE, INTERNET, VIBRATE, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, WRITE_EXTERNAL_STORAGE<=32
- blocked_permissions: RECORD_AUDIO, SYSTEM_ALERT_WINDOW ; preuve release finale différée au prochain build signé
- verdict: PARTIAL — manifest release fusionné encore requis

THIRD_PARTY_SERVICES
- services: Cloudinary, Expo Push, Expo Updates, Sentry, Google Sign-In, Google Maps SDK, Zoho Mail, MongoDB, Facebook Graph (pull vitrine)
- analytics: Google Analytics (web uniquement)
- crash_reporting: Sentry (mobile)
- advertising: NONE

LOCAL_STORAGE
- mechanisms: SecureStore (tenantRuntime), AsyncStorage (préférences UX), Sentry storage
- sensitive_data: tenantId + userId (SecureStore)
- logout_cleanup: PARTIAL — à confirmer humainement pour JWT et Sentry
- tenant_switch_cleanup: OUI pour le contexte tenant

ACCOUNT_DELETION
- account_creation: YES (email + Google Sign-In)
- in_app_deletion: YES
- web_deletion: YES (processus public informatif et espace authentifié)
- backend_support: YES (`DELETE /api/users/me`, identité issue de `req.user`)
- verdict: CODE_CLOSED ; 97/97 tests ciblés PASS

PRIVACY_POLICY
- existing_page: YES (web + mobile)
- route: /politique-confidentialite
- created_or_updated: UPDATED — suppression des durées juridiques non confirmées et alignement web/mobile
- public_auth_requirement: NONE (route publique)
- support_contact: support@altitudevision.agency
- local_status: EXISTS (429 lignes web, 417 mobile)
- production_status: NOT_VERIFIED (pas de déploiement dans ce sprint)

DATA_SAFETY
- matrix_created: YES
- path: docs/compliance/google-play-data-safety.md
- unresolved_items: 3 (prestataire de paiement effectif, manifest release signé, classification Play de la position précise du bien)

PLAY_CONSOLE_ANSWERS
- document_created: YES
- path: docs/compliance/google-play-console-answers.md
- human_decisions_remaining: 8

ADS
- third_party_ads: NO

FINANCIAL_FEATURES
- findings: purchase history métier présent; aucun SDK de paiement natif
- human_review_required: YES (prestataire paiement effectif)

HEALTH
- findings: NONE_FOUND

GOVERNMENT
- findings: NONE — société privée

TARGET_AUDIENCE
- findings: pas d'age gate, pas de contenu dédié enfants
- human_review_required: YES (choix 18+ recommandé)

REVIEW_ACCESS
- account_required: YES
- role_required: Client (min), Proprietaire (recommandé)
- human_action_required: YES — à créer en dehors de Git

TESTS
- targeted: NONE (audit documentaire, worktree préservé)
- frontend: NOT_RUN
- mobile: NOT_RUN
- backend: NOT_RUN
- lint: NOT_RUN
- typecheck: NOT_RUN
- expo_doctor: NOT_RUN
- build: NOT_RUN
- diff_check: PASS (git diff --check propre au démarrage)

VISUAL_QA
- desktop: BLOCKED_ENVIRONMENT
- tablet: BLOCKED_ENVIRONMENT
- mobile: BLOCKED_ENVIRONMENT
- evidence: aucune capture réalisée

CONSISTENCY
- privacy_vs_code: PARTIAL (Sentry/Expo Push/Cloudinary à ajouter à la politique)
- data_safety_vs_code: PASS
- android_permissions: PARTIAL (3 permissions à valider)
- account_deletion: FAIL

FILES_MODIFIED
- (aucun)

FILES_CREATED
- docs/compliance/google-play-data-safety.md
- docs/compliance/google-play-console-answers.md
- docs/compliance/google-play-privacy-audit.md

FILES_DELETED
- (aucun)

BLOCKERS
P0:
  - Suppression de compte self-service (endpoint + UI mobile + UI web) — bloquant Play
  - Clé Google Maps API en clair dans AndroidManifest.xml suivi par Git (rotation + restriction Google Cloud + retrait du suivi Git)
  - Compte de test Google Review à préparer (hors Git)
  - Content rating (IARC) à remplir manuellement dans Play Console
  - Target audience — décision 18+ et éventuel age gate
P1:
  - Politique de confidentialité à compléter (Sentry, Expo Push, Cloudinary, Google Maps, Google Sign-In)
  - Permissions Android à nettoyer/justifier (RECORD_AUDIO, SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE_MEDIA_PLAYBACK)
  - Confirmer prestataire de paiement et classifier Data Safety
  - Confirmer Sentry.setUser (userId envoyé ou non)
P2:
  - Documenter cycle de vie JWT mobile (SecureStore vs mémoire)
  - Vérifier cleanup logout côté SecureStore/Sentry
  - Décider possibilité d'upload vidéo côté utilisateur

GOOGLE_PLAY_PRIVACY_GATE: PARTIAL

FINAL_VERDICT: C
```

### Explication du verdict

**C — fonctionnalité importante manquante**. L'audit est complet, la
politique de confidentialité existe et la matrice Data Safety est
prête. Cependant :

1. **Suppression de compte** absente en self-service (P0) — bloquant
   direct Play Store.
2. **Clé Google Maps** en clair dans le manifeste versionné (P0
   sécurité).
3. Plusieurs décisions humaines P0 restent avant soumission
   (content rating, target audience, compte de review, prestataire
   de paiement, mise à jour de la politique).

Une fois ces points traités, le passage à B (validation humaine et
opérationnelle) puis A (soumission Play prête) est direct — aucune
architecture profonde à revoir, aucun invariant multi-tenant en
question.
