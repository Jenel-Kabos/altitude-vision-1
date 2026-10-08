# Google Play — Data Safety matrix (Altimmo mobile)

Cible : `com.altitudevision.altimmo` (Android package confirmé dans
`altimmo-app/app.config.js:57` et `altimmo-app/android/app/src/main/AndroidManifest.xml`).

Version auditée : `1.0.1` (`versionCode: 2`), Expo `~57.0.25`, React Native `0.86.3`.

Date de l'audit : 2026-09-28. Commit HEAD : `1f5c74f`.

Ce document décrit **ce que fait le code** aujourd'hui. Il ne remplace pas la
saisie humaine dans Play Console mais fournit la classification recommandée,
la preuve dans le code, et le niveau de confiance.

Distinctions Google Play utilisées :
- **Collected** : la donnée quitte l'appareil (transmise à un backend, un
  service tiers, ou stockée hors appareil).
- **Shared** : la donnée est transférée à un tiers *au-delà* d'un service
  provider strict agissant pour Altitude Vision. Un prestataire technique
  utilisé uniquement pour héberger/traiter la donnée pour notre compte, sous
  contrat, sans autre finalité, n'est en principe **pas** un "partage" au
  sens Play Console — cette qualification finale reste une décision humaine.
- **Ephemeral** : traitée en mémoire uniquement, jamais stockée.

Légende `CONFIDENCE` : HIGH (preuve directe dans le code), MEDIUM (déduit),
LOW (nécessite validation humaine).

---

## Personal info

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Name | YES | NO (service providers seulement) | NO | Required | Account management, App functionality | `server/models/User.js` (nom/prénom via inscription), écrans `EditProfileScreen.jsx`, `ProfilScreen.jsx` | HIGH | Stocké MongoDB (Render), transmis pour messagerie/annonces |
| Email address | YES | NO (service providers) | NO | Required | Account management, Developer communications (transactionnel), App functionality | `server/models/User.js:21 (email)`, `server/config/email.js` (Zoho SMTP) | HIGH | Envoi via Zoho pour vérif email/reset password/notifications transactionnelles |
| User IDs | YES | NO (service providers) | NO | Required | Account management, App functionality | JWT contient `userId`, Mongo `_id`; aucun appel applicatif `Sentry.setUser` trouvé | HIGH | Réévaluer si l'identité Sentry est ajoutée ultérieurement |
| Address | YES (biens immobiliers) | NO | NO | Optional | App functionality | `server/models/Property.js`, `PublierBienScreen.jsx` | HIGH | Il s'agit de l'adresse d'un **bien**, pas nécessairement du domicile de l'utilisateur. À déclarer sous "Other personal info" plutôt qu'"Address" si Play Console distingue |
| Phone number | YES | NO (service providers) | NO | Optional (inscription email) / Required (inscription phone) | Account management, App functionality | `server/models/User.js:69 (phone)`, `authProvider: 'phone'` | HIGH | Format international, utilisé pour contact |
| Race and ethnicity | NO | – | – | – | – | Aucune preuve dans le code | HIGH | – |
| Political or religious beliefs | NO | – | – | – | – | Aucune preuve | HIGH | – |
| Sexual orientation | NO | – | – | – | – | Aucune preuve | HIGH | – |
| Other personal info | YES (rôle, business profile, documents propriétaire/locataire) | NO | NO | Optional | App functionality | `server/models/User.js` (`role`, `authProvider`), `userBusinessProfileService.js`, `tenantPortalService.js`, `personalDocumentService.js` | HIGH | Documents bail/pièces justificatives via Cloudinary |

## Financial info

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| User payment info (cartes, comptes) | NO — pas de collecte directe de PAN/CB | – | – | – | – | Aucun SDK Stripe/CB natif détecté dans `altimmo-app`; pas de champ carte dans les modèles | HIGH | Si un fournisseur de paiement est branché plus tard (Stripe/Mobile Money), à réévaluer. Voir `HUMAN_REVIEW_REQUIRED` : moyen de paiement effectif hors app ? |
| Purchase history | YES (transactions immobilières / locations / réservations hôtel) | NO | NO | – | App functionality | `server/models/Transaction.js`, `client/app/mes-paiements`, `mes-reservations-hotel`, `transactionService.js` | HIGH | Historique métier (loyers, réservations, offres). Play Console : « Purchase history » vise plutôt les IAP ; documenter en toute transparence côté Data Safety |
| Credit score | NO | – | – | – | – | Aucune preuve | HIGH | – |
| Other financial info | POSSIBLE — factures, montants de loyer, offres | NO | NO | Optional | App functionality | `server/models/Invoice*.js`, `rentalPayment*` | MEDIUM | Montants et références internes, pas de coordonnées bancaires. À qualifier humainement |

## Location

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Approximate location | YES | NO | POSSIBLE (recherche carte) | Optional | App functionality | `CarteScreen.jsx:189` `Location.requestForegroundPermissionsAsync` + `Location.getCurrentPositionAsync({ accuracy: Balanced })` | HIGH | Utilisé pour recentrer la carte à proximité de l'utilisateur |
| Precise location | YES | NO | NO (persistée sur les annonces créées par l'utilisateur) | Optional | App functionality | `PublierBienScreen.jsx:244-249` — l'annonceur peut capturer la position GPS de son bien avec `Location.getCurrentPositionAsync` | HIGH | La coordonnée du **bien** est ensuite stockée sur `Property`. **Distinction clé** : ce sont des coordonnées d'annonce publique, pas la position personnelle de l'utilisateur. À documenter clairement dans la politique |

## Messages

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Emails (in-app) | NO — l'app ne lit pas la boîte mail de l'utilisateur | – | – | – | – | Zoho polling côté serveur = boîtes internes Altitude Vision, pas celles des utilisateurs | HIGH | – |
| SMS or MMS | NO | – | – | – | – | Aucune permission SMS, aucun SDK SMS | HIGH | – |
| Other in-app messages | YES | NO (service providers) | NO | Optional | App functionality | Socket.IO client `socketService.js`, écrans `Messagerie/`, backend `internalMessageController.js` | HIGH | Messages entre utilisateurs de la plateforme, persistés MongoDB |

## Photos and videos

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Photos | YES | NO (Cloudinary = service provider) | NO | Optional | App functionality | `PhotoManager.jsx`, `expo-image-picker`, `expo-camera`, backend `server/config/cloudinary.js`, routes `rentalPropertyRoutes.js`, `estimationRoutes.js`… | HIGH | Photos de biens, photo de profil, pièces jointes messagerie. Uploadées via Cloudinary (URL retournée au client) |
| Videos | YES | YES (Cloudinary) | NO | Optional | App functionality | `PublierBienScreen.jsx` autorise `mediaTypes: ['images', 'videos']`; `annonceService.js` traite les MIME vidéo et uploade vers Cloudinary | HIGH | Publication volontaire par l'utilisateur |

## Audio files

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Voice or sound recordings | NO — aucun appel d'enregistrement audio dans `src/` | – | – | – | – | `expo-audio` sert à la lecture dans `ChatScreen.jsx`; `RECORD_AUDIO` est bloquée par `android.blockedPermissions` | HIGH | Manifest généré : directive de retrait confirmée ; manifest fusionné release à revalider dans le prochain build signé |
| Music files | NO | – | – | – | – | – | HIGH | – |
| Other audio files | NO | – | – | – | – | – | HIGH | – |

## Files and docs

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Files and docs | YES | NO (Cloudinary = service provider) | NO | Optional | App functionality | `expo-document-picker`, `personalDocumentService.js`, `secureAttachmentService.js`, backend `litigeRoutes.js` (upload PDF+images) | HIGH | Dossiers locataires, litiges, contrats |

## Calendar

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Calendar events | NO — pas d'accès au calendrier natif | – | – | – | – | Aucun `expo-calendar`, pas de permission READ_CALENDAR | HIGH | Les créneaux de visite sont saisis dans l'app, pas lus depuis le calendrier système |

## Contacts

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Contacts | NO | – | – | – | – | Aucun `expo-contacts`, pas de permission READ_CONTACTS | HIGH | – |

## App activity

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| App interactions | YES (côté web) | NO | – | – | Analytics | `client/lib/components/GoogleAnalytics.jsx` — GA4 côté **web** seulement. Aucun GA côté mobile | HIGH (web) / HIGH (mobile: pas de GA) | À déclarer si Data Safety concerne aussi l'usage web ; côté mobile pur : NO |
| In-app search history | NO (pas de tracking des recherches vers un backend analytics dédié) | – | – | – | – | Recherches locales, filtres non journalisés côté produit | MEDIUM | – |
| Installed apps | NO | – | – | – | – | Aucun `PackageManager.getInstalledPackages`, pas de `<queries>` général | HIGH | Le `<queries>` ne cible que l'intent VIEW/BROWSABLE https, autorisé sans QUERY_ALL_PACKAGES |
| Other user-generated content | YES | NO | NO | Optional | App functionality | Annonces, avis, messages, documents, offres | HIGH | Contenu métier |
| Other actions | NO (côté mobile) | – | – | – | – | – | MEDIUM | – |

## Web browsing

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Web browsing history | NO | – | – | – | – | – | HIGH | – |

## App info and performance

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Crash logs | YES | NO (Sentry = service provider) | NO | Optional (mais activé par défaut) | Analytics, Fraud prevention, security and compliance | `altimmo-app/App.js` `Sentry.init`, plugin `@sentry/react-native/expo` dans `app.config.js:113` | HIGH | Sentry projet `altimmo-mobile`, org `altitudevision` |
| Diagnostics | YES | NO (Sentry) | NO | Optional | Analytics | Sentry breadcrumbs par défaut | HIGH | – |
| Other performance data | NO explicite | – | – | – | – | – | MEDIUM | – |

## Device or other IDs

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Device or other IDs | YES | NO (Expo/Sentry = service providers) | NO | Required (push) / Optional | App functionality (push notifications), Analytics (Sentry) | `notificationsService.js:24` `Notifications.getExpoPushTokenAsync`, `expo-updates` (installation ID Expo), Sentry (device metadata) | HIGH | Le push token Expo est un identifiant lié à l'installation, envoyé à Expo Push Service pour livrer les notifications |

## Health and fitness

| DATA_TYPE | COLLECTED | SHARED | EPHEMERAL | REQ/OPT | PURPOSES | CODE_EVIDENCE | CONFIDENCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Health / fitness info | NO | – | – | – | – | Aucune preuve, aucun SDK Health Connect | HIGH | – |

---

## Data collection practices — synthèse

- **Chiffrement en transit** : oui, tous les endpoints backend sont HTTPS
  (`https://altitude-vision.onrender.com`), WSS pour Socket.IO. À déclarer
  "Data is encrypted in transit".
- **Chiffrement au repos** : MongoDB Atlas/Render + Cloudinary appliquent
  un chiffrement au repos par défaut au niveau infrastructure. **Ne pas
  déclarer** cela comme un chiffrement applicatif de bout en bout —
  aucune preuve dans le code d'un chiffrement end-to-end. Formuler
  prudemment : "Data is encrypted in transit; at-rest encryption is
  provided by our hosting providers."
- **Mécanisme de suppression** : ❌ **actuellement PARTIAL** — pas
  d'endpoint self-service côté utilisateur (voir
  `google-play-console-answers.md` §"Account deletion").
- **Data deletion request** : préconisation — publier une adresse email
  dédiée (`support@altitudevision.agency`) et documenter le workflow
  humain, en attendant l'implémentation d'un endpoint self-service.

## Unresolved items (`HUMAN_REVIEW_REQUIRED`)

1. Aucun appel applicatif `Sentry.setUser(...)` trouvé ; réévaluer si ce comportement est ajouté
   utilisateur (à ce jour non trouvé dans `App.js` mais possible via un
   wrapper d'auth). Si oui : Sentry reçoit un `userId` — à déclarer.
2. Upload vidéo confirmé dans le flux `PublierBienScreen` vers Cloudinary ; aligner la réponse Console
   est branché en lecture).
3. Vérifier sur le prochain AAB signé que RECORD_AUDIO / SYSTEM_ALERT_WINDOW sont absentes ; FOREGROUND_SERVICE_MEDIA_PLAYBACK est désormais absente (GOOGLE-PLAY-R2 : `expo-audio` `enableBackgroundPlayback: false`, aucune lecture en arrière-plan)
   sont réellement nécessaires (héritages Expo) — voir la section permissions
   du rapport d'audit.
4. Confirmer le moyen de paiement effectif (hors application ? redirection
   navigateur ? intégration future ?) et la classification Data Safety
   correspondante.
5. Décider si les coordonnées GPS de biens publiés sont à déclarer sous
   "Precise location" (position d'un bien) ou sous "Other personal info" —
   la position de l'utilisateur elle-même est en approximate. Recommandation :
   déclarer "Precise location — Optional — App functionality" en précisant
   la finalité (géolocaliser une annonce publiée).
