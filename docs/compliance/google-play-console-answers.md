# Google Play Console — réponses recommandées

Aide à la saisie humaine dans Play Console pour l'app
`com.altitudevision.altimmo`. **Ce document n'est pas une soumission
automatique** : chaque champ doit être validé par un responsable.

Sources : `altimmo-app/app.config.js`, `altimmo-app/android/app/src/main/AndroidManifest.xml`,
`altimmo-app/package.json`, `altimmo-app/src/**`, `server/**`, `client/**`.

Format : `RECOMMENDED_ANSWER | CONFIDENCE | EVIDENCE | HUMAN_REVIEW_REQUIRED | COMMENTS`.

---

## Privacy policy

- **RECOMMENDED_ANSWER** : `https://www.altitudevision.agency/politique-confidentialite`
- **CONFIDENCE** : HIGH pour l'existence de la route côté code
  (`client/app/politique-confidentialite/page.jsx` → `PolitiqueConfidentialite.jsx`).
  **MEDIUM** pour la disponibilité en production — non déployée dans cette
  session (voir §PRODUCTION_URL_STATUS du rapport).
- **EVIDENCE** : `client/app/politique-confidentialite/page.jsx`, contenu
  429 lignes dans `client/lib/pages/PolitiqueConfidentialite.jsx`.
- **HUMAN_REVIEW_REQUIRED** : YES — vérifier accessibilité HTTPS publique
  sans authentification, indexabilité, absence de contenu placeholder.
- **COMMENTS** : la page existante décrit déjà Google Analytics, cookies,
  droits GDPR. À réviser pour cohérence avec cette matrice Data Safety
  (ajouter mention explicite Sentry, Cloudinary, Expo Push, Google Maps,
  Google Sign-In, et la procédure de suppression de compte).

## Ads

- **RECOMMENDED_ANSWER** : `Non — cette application ne contient pas de publicités tierces.`
- **CONFIDENCE** : HIGH
- **EVIDENCE** : aucun SDK détecté (`grep` sur `admob|audience-network|facebook.*sdk`
  dans `altimmo-app/` retourne un seul faux positif dans le texte de la
  politique de confidentialité mobile).
- **HUMAN_REVIEW_REQUIRED** : NO
- **COMMENTS** : Attention à la distinction — marketing des services
  Altitude Vision dans l'app ≠ publicité tierce.

## App access / login requirements

- **RECOMMENDED_ANSWER** : `Toutes ou une partie des fonctionnalités de mon app sont limitées`
- **CONFIDENCE** : HIGH
- **EVIDENCE** : `client/lib/context/AuthContext.jsx`, `ProtectedRoute`,
  `RoleProtectedRoute`; côté mobile la plupart des écrans nécessitent JWT
  (voir `altimmo-app/src/services/api.js`).
- **HUMAN_REVIEW_REQUIRED** : YES — fournir des identifiants de test à
  Google (compte "Review Access") pour :
  - un rôle **Client** (parcours annonces + messagerie + réservation)
  - éventuellement un rôle **Proprietaire** (publier un bien)
- **COMMENTS** : ne PAS mettre d'identifiants en clair dans Git ; renseigner
  directement dans le formulaire Play Console.
- **REVIEW_ACCOUNT_REQUIRED** : YES
- **RECOMMENDED_TEST_ROLE** : Client (nécessaire) + Proprietaire (recommandé)
- **REQUIRED_ACCESS_PATHS** : Login → onglet Annonces → détail d'un bien →
  Messagerie → Notifications.

## Content rating

- **RECOMMENDED_ANSWER** : `HUMAN_DECISION_REQUIRED` — répondre au
  questionnaire IARC dans Play Console. À notre lecture du code, il n'y a
  ni contenu violent, ni sexuel, ni jeu d'argent, ni contenu généré par
  l'utilisateur susceptible d'atteindre une audience mineure. Rating
  probable "Everyone / PEGI 3".
- **CONFIDENCE** : MEDIUM
- **EVIDENCE** : absence de features de type jeu, dating, gambling, alcool.
- **HUMAN_REVIEW_REQUIRED** : YES — le questionnaire IARC engage l'éditeur
  et doit être rempli par un humain.
- **COMMENTS** : signaler la présence d'UGC (annonces, messages) →
  répondre "Yes" à la question "Users can interact / share content".

## Target audience and content

- **RECOMMENDED_ANSWER** : `18+ (ou 13+ minimum si Play l'impose)`
- **CONFIDENCE** : MEDIUM
- **EVIDENCE** : `CHILD_DIRECTED_EVIDENCE` = aucun onboarding enfant, pas
  d'age gate, marketing B2C/B2B immobilier. `AGE_GATE_PRESENT` = NO.
- **HUMAN_REVIEW_REQUIRED** : YES
- **COMMENTS** : recommander d'ajouter une case "j'ai plus de 18 ans" à
  l'inscription si Play impose la conformité "Not designed for children".

## Data Safety — form summary

| Section | Réponse | Confiance |
|---|---|---|
| Does your app collect or share any of the required user data types? | **YES** | HIGH |
| Is all of the user data collected by your app encrypted in transit? | **YES** (HTTPS/WSS partout) | HIGH |
| Do you provide a way for users to request that their data is deleted? | **YES — via email `support@altitudevision.agency`** (procédure documentée dans la politique). **NO** pour un mécanisme in-app self-service — voir plus bas. | HIGH |

Détail des types de données collectées / partagées : voir
`docs/compliance/google-play-data-safety.md`.

## Account deletion

- **RECOMMENDED_ANSWER (après remédiation P0)** :
  - In-app deletion : **YES** — écran `Profil → Supprimer mon compte`
    dans l'application mobile Altimmo (`ProfilScreen.jsx`).
  - Web-based deletion URL : `https://www.altitudevision.agency/supprimer-mon-compte`
    (page publique explicative + contact `support@altitudevision.agency`).
- **CONFIDENCE** : HIGH pour l'existence code + doc ; MEDIUM pour la
  couverture métier (voir points ci-dessous).
- **EVIDENCE** :
  - Backend : route `DELETE /api/users/me` (`server/routes/userRoutes.js`
    bloc "utilisateur connecté"), controller
    `userController.deleteMyAccount`, service
    `server/services/accountSelfDeletionService.js`.
  - Stratégie : soft-delete + anonymisation. `status='Supprimé'`,
    `isActive=false`, `tokenVersion++`, nom/email/téléphone/photo
    anonymisés, memberships révoquées, avatar Cloudinary détruit.
  - Last-admin protection : erreur `LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED`
    si l'utilisateur est seul Admin actif d'au moins un tenant (réutilise
    l'invariant certifié `tenantMemberService`).
  - UI mobile : bouton "Supprimer mon compte" dans la danger zone du
    `ProfilScreen`, double confirmation.
  - Page publique : `client/app/supprimer-mon-compte/page.jsx`.
  - Tests : `server/__tests__/accountSelfDeletion.mongo.integration.test.js`
    (7 scénarios : 401, anonymisation, idempotence, isolation
    inter-utilisateurs, révocation memberships, last-admin bloqué,
    non-dernier admin autorisé, invalidation JWT).
- **HUMAN_REVIEW_REQUIRED** : NO pour le mécanisme technique. YES pour :
  - décision métier RGPD sur les durées de conservation légales
    (facturation, litiges) en République du Congo / Congo-Brazzaville →
    `HUMAN_LEGAL_REVIEW_REQUIRED` avant publication d'une durée chiffrée ;
    confidentialité et éventuellement une purge programmée ;
  - communication avec les autres participants d'une conversation dont
    l'auteur a été anonymisé (aucune notification automatique
    implémentée).

## Government apps

- **RECOMMENDED_ANSWER** : `Non — application privée`
- **CONFIDENCE** : HIGH
- **EVIDENCE** : Altitude Vision est une société privée d'expertise
  multidisciplinaire (voir `PolitiqueConfidentialite.jsx`).
- **HUMAN_REVIEW_REQUIRED** : NO

## Financial features

- **RECOMMENDED_ANSWER** : `HUMAN_DECISION_REQUIRED`
- **CONFIDENCE** : LOW
- **EVIDENCE** : présence de flows "paiement" (`paiement/success`,
  `paiement/cancel` en universal links) et `mes-paiements`, mais **aucun
  SDK de paiement natif** dans l'app mobile — donc les paiements sont
  probablement réalisés via WebView / lien navigateur, hors app. Le code
  actuel ne stocke aucun PAN/carte.
- **HUMAN_REVIEW_REQUIRED** : YES — confirmer le prestataire de paiement
  effectif (Stripe ? Mobile Money ? redirection externe ?) et déclarer en
  conséquence : "l'app facilite le paiement mais ne le traite pas
  directement".
- **COMMENTS** : ne pas cocher "cryptocurrency", "banking", "personal loans".

## Health

- **RECOMMENDED_ANSWER** : `Non applicable`
- **CONFIDENCE** : HIGH
- **EVIDENCE** : aucune fonctionnalité santé, aucun SDK Health Connect.
- **HUMAN_REVIEW_REQUIRED** : NO

## News apps

- **RECOMMENDED_ANSWER** : `Non — pas déclaré comme application de presse`
- **CONFIDENCE** : HIGH
- **EVIDENCE** : la fonctionnalité "actualites" côté web est un bloc
  éditorial de la société, pas un service de presse.

## COVID-19 contact tracing

- **RECOMMENDED_ANSWER** : `Non`
- **CONFIDENCE** : HIGH

## Data safety — additional notes (à copier dans le champ libre Play Console)

> Altimmo collecte les informations strictement nécessaires à la
> publication d'annonces immobilières, à la messagerie entre utilisateurs
> et à la gestion des visites/réservations. Les images et documents
> sont hébergés par Cloudinary (service provider). Les notifications
> push transitent par Expo Push Service. Les rapports de crash sont
> envoyés à Sentry. Aucune publicité tierce n'est intégrée. Les
> paiements sont traités hors application via un partenaire externe
> (à préciser).

---

## Récapitulatif — décisions humaines restantes (après remédiation P0)

| # | Décision | Priorité | Bloque soumission Play |
|---|---|---|---|
| 1 | ~~Suppression de compte self-service~~ ✅ CODE_CLOSED — endpoint + UI + tests livrés | — | Non |
| 2 | Rotation Google Maps configurée (`HUMAN_CONFIRMED`) ; rebuild AAB et validation Maps signée restent requis avant suppression de l'ancienne clé | P0 sécurité | **OUI** |
| 3 | Confirmer prestataire de paiement effectif et adapter Data Safety | P1 | Recommandé |
| 4 | ~~RECORD_AUDIO / SYSTEM_ALERT_WINDOW~~ ✅ CODE_CLOSED — bloquées via `android.blockedPermissions` dans `app.config.js`. ✅ GOOGLE-PLAY-R2 — FOREGROUND_SERVICE / FOREGROUND_SERVICE_MEDIA_PLAYBACK et le service `mediaPlayback` retirés (`expo-audio` `enableBackgroundPlayback: false` : l'audio n'est lu qu'en premier plan) — aucune déclaration FGS à fournir | — | Non |
| 5 | Politiques web/mobile et procédure publique alignées ; durées chiffrées soumises à `HUMAN_LEGAL_REVIEW_REQUIRED` | P1 | Revue juridique |
| 6 | Fournir un compte de test Google Review (Client + Proprietaire) | P0 | **OUI** pour review |
| 7 | Répondre au questionnaire IARC (content rating) | P0 | **OUI** |
| 8 | Décider tranche d'âge cible (18+ vs 13+) et ajouter age gate si nécessaire | P0 | **OUI** |
| 9 | Revue juridique humaine (République du Congo / Congo-Brazzaville) : durées de conservation applicables à la facturation et aux litiges — à documenter dans la politique | P1 | Recommandé |
