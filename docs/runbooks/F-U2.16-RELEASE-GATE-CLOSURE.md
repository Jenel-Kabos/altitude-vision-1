# F-U2.16 — Clôture de la porte de release

Date : 2026-10-16. Dépôt `altitude-vision-1`, branche `main`, HEAD `5a54a13`. Aucun commit, push, déploiement, publication ni changement de secret ou de configuration de production.

Références :
- [F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md](F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md)
- [F-U2.15-FINAL-RELEASE-CERTIFICATION.md](F-U2.15-FINAL-RELEASE-CERTIFICATION.md)

Preuves (hors dépôt, droits `700`) : `~/altitude-vision-certification-logs/F-U2.16/`. Ce dossier contient :
- les journaux complets de `certify:release` ;
- 6 rapports de plantage macOS (`.ips`) ;
- l'audit npm brut (JSON) et ses avis racines ;
- les comparaisons de captures.

## 1. État Git

| | Début | Fin |
|---|---|---|
| Branche / HEAD | `main` / `5a54a13` | `main` / `5a54a13` |
| Suivis modifiés / non suivis / indexés | 246 / 204 / 0 | 246 / 205 / 0 |

Le patch des fichiers suivis est **identique octet pour octet** au début. Sauvegarde : `~/altitude-vision-backups/F-U2.16-start-20261016-025135/`.

**Fichier modifié par F-U2.16 : ce rapport uniquement.**

Hors dépôt : Node **20.19.6** installé en parallèle via nvm, avec autorisation. Node 20.20.2 est conservé et l'alias par défaut est inchangé (`default → 20 → v20.20.2`).

## 2. Phase 1 — Certification Node / CI

**CI.** Non utilisable pour cette certification :
- elle exécuterait le code **commité** (`5a54a13`), et non les 246 modifications non commitées ; il faudrait commiter et pousser, ce qui est interdit ;
- `gh` et Docker sont absents.

La CI (`.github/workflows/e2e.yml`) utilise `node-version: 20`, c'est-à-dire aujourd'hui **v20.20.2**.

**Compatibilité de Node 20.19.6, vérifiée avant installation.**
- Les 1 677 paquets déclarant `engines.node` (racine, serveur, client, mobile) acceptent 20.19.6 comme 20.20.2.
- React Native 0.86.3 exige `^20.19.4`, ce que 20.19.6 satisfait. Expo 57 s'aligne sur React Native.
- L'ABI des modules natifs est identique (`NODE_MODULE_VERSION` 115).

**`certify:release` complet sous Node 20.19.6** (02:57 → 05:42, 9 907 s, journal intégral `certify-release-node20.19.6.log`) :

| Section | Étape | Résultat |
|---|---|---|
| Serveur | Architecture, lint | ✅ |
| Serveur | Tests unitaires | ❌ **plantage natif V8** : un processus Jest tué par `SIGTRAP`, la suite `hotelWebPublicationController.unit.test.js` n'a pas été exécutée. 1 940/1 940 tests exécutés réussis, **aucune assertion en échec**. |
| Serveur | Tests MongoDB (8 shards) | ✅ 3 454/3 454 |
| Client | Lint, build | ✅ |
| Client | Tests | ✅ **184/184 fichiers, 1 366/1 366 tests** |
| Mobile | Syntaxe, lint, types, tests 657/657, **Doctor 21/21**, export | ✅ |

**Total : 12/13.** La suite non exécutée, relancée seule sous 20.19.6, passe à **2/2**. Les 1 942 tests unitaires serveur sont donc verts.

**Analyse de cause, menée avant toute autre modification.**

| Élément | Constat |
|---|---|
| Signature | 6 rapports macOS (`.ips`), tous dans le fil du ramasse-miettes concurrent de V8 : `v8::internal::ConcurrentMarking::RunMajor` (`SIGSEGV` dans `IteratePointers`, ou `SIGTRAP` via `V8_Fatal : unreachable code`) |
| Versions | Identique sous Node **20.20.2** et **20.19.6** : changer de correctif de Node 20 ne suffit pas |
| Processus touchés | Variables (Jest serveur, Vitest client, `next dev`), sans lien avec un test ou un module précis |
| Machine | MacBook Pro 16" 2019 (`MacBookPro16,1`), Intel Core i9-9980HK, x86_64 natif (pas de Rosetta), macOS 26 |
| Signaux matériels | 3 redémarrages forcés du GPU (`gpuRestart`) consignés par le noyau le 15/10 ; charge système très élevée pendant les sessions (moyenne jusqu'à 49) |

**Classement (`FAILURE_CLASSIFICATION.md`) : INFRASTRUCTURE.** Il s'agit d'une instabilité du poste local : matériel ou thermique, ou incompatibilité entre V8 de Node 20 et macOS 26 sur Intel. **Ce n'est pas un échec applicatif.**

**Preuve combinée.** Sur les deux exécutions complètes de la porte (F-U2.15 sous 20.20.2, F-U2.16 sous 20.19.6), **chacune des 13 étapes a réussi intégralement au moins une fois**. Mais **aucune exécution unique n'est verte à 13/13** : la réserve formelle demeure.

## 3. Phase 2 — Validation visuelle (9 captures)

Format et dimensions identiques à HEAD pour toutes : 1440×900 en desktop, 390×844 en mobile, densité 1.

| Capture | Écart | Format | Troncature / débordement | Justification |
|---|---|---|---|---|
| accommodations `desktop-dark-filters-closed` | 0,32 % | desktop ✅ | aucun | Instant de l'animation d'apparition (en-tête et indicateurs) |
| accommodations `desktop-light-filters-closed` | 0,32 % | desktop ✅ | aucun | Idem |
| accommodations `desktop-light-filters-open` | 1,75 % | desktop ✅ | aucun | Idem ; puces « Brazzaville » et « Maintenance » et filtres identiques |
| accommodations `mobile-dark` | 0,58 % | mobile ✅ | aucun | Idem ; disposition mobile (recherche, puis Filtres et Ajouter côte à côte) |
| accommodations `mobile-light` | 1,23 % | mobile ✅ | aucun | Idem |
| inbox `desktop-light` | 0,75 % | desktop ✅ | **corrigé** | La référence HEAD tronquait le corps du message (iframe coupée) ; le message est désormais complet, pièces jointes en pied (IH3) ; horodatage dynamique |
| inbox `desktop-dark` | 0,82 % | desktop ✅ | **corrigé** | Idem |
| inbox `mobile-light-detail` | 2,92 % | mobile ✅ | **corrigé** | Idem (message tronqué dans HEAD) ; date dynamique |
| inbox `mobile-light-list` | 0,14 % | mobile ✅ | aucun | Seuls changent les horodatages relatifs (« 22:04 » vers « 23:01 », « 22 août » vers « 12 oct. ») |

Les composants affichés sont conformes. L'identité Altimmo est inchangée. **Aucune régression.**

Recommandation : accepter les 9 captures, **sur décision humaine**. Elles n'ont pas été acceptées automatiquement.

Amélioration suggérée, non appliquée : figer l'horloge (`page.clock`) et attendre la fin des animations dans ces specs, pour des captures déterministes.

## 4. Phase 3 — Vulnérabilités npm (mobile)

`npm audit` signale 78 entrées (1 critique, 59 élevées, 18 modérées). **67 sont des propagations** : les paquets parents (jest, expo, react-native…) sont marqués à cause d'une sous-dépendance, et les « correctifs » proposés sont des retours en arrière absurdes (`expo@44`, `react-native@0.72`). Il reste **11 paquets réellement vulnérables** :

| Paquet (version) | Gravité | Chaîne | Exposition en production | Correctif disponible | Risque de régression | Décision recommandée |
|---|---|---|---|---|---|---|
| **axios** 1.19.0 | élevée (12 avis) | direct (`src/services/api.js`, `annonceService.js`) | **Oui**, client HTTP de l'app. La plupart des avis visent l'adaptateur Node, HTTP/2 ou proxy (non utilisés sous React Native, adaptateur XHR) ; restent applicables les « gadgets » de pollution de prototype et l'injection d'en-têtes, qui exigent une pollution préalable. | **1.20.0 (mineure)** | Faible | **Mettre à jour vers 1.20.x**, dans un lot dédié avec tests mobiles |
| **decode-uri-component** 0.2.2 | modérée | `@react-navigation/native` 6 → core → `query-string` 7 | **Oui**, analyse des liens profonds (`linking`). Risque de déni de service local de l'app par un lien malformé | 0.4.3+ / 0.5.0, hors plage de `query-string` 7 ; sinon React Navigation 7 (**majeure**) | Moyen à élevé | Accepter temporairement ; planifier la migration React Navigation 7 |
| shell-quote 1.10.0 | **critique** | react-native → `react-devtools-core` | Non : outils de développement uniquement (lanceur d'éditeur côté Node, jamais dans le bundle de release) | 1.11.0 / 1.12.0 | Faible | Mettre à jour via `overrides` lors d'une passe de maintenance |
| node-forge 1.4.0 | élevée | `expo-updates` / `@expo/cli` → `@expo/code-signing-certificates` | Non : outillage CLI de signature de code (la vérification sur l'appareil est native) | **Aucune version corrigée** | — | Accepter, surveiller |
| @xmldom/xmldom 0.8.13 / 0.9.10 | élevée | `@expo/config-plugins` / `@expo/plist` → plist | Non : génération de configuration au prebuild | 0.8.x et 0.9.12 | Faible | Corriger via `overrides` (maintenance) |
| image-size 1.2.1 | élevée | react-native → metro | Non : bundler (build) | 2.0.3+ (majeure pour metro) | Moyen | Accepter (build uniquement) |
| js-yaml 3.15.1 / 4.3.1 | élevée | jest (istanbul), eslint | Non : tests et lint | 3.15.2 / 4.x | Faible | `overrides` (maintenance) |
| brace-expansion 1.1.18 / 5.0.9 | élevée | eslint, minimatch, glob | Non : outillage | 1.1.21 / 5.0.12 | Faible | `overrides` (maintenance) |
| braces 3.0.3 | élevée | jest → micromatch | Non : tests | **Aucune version corrigée** | — | Accepter |
| sprintf-js 1.0.3 | modérée | jest → js-yaml 3 → argparse | Non : tests | **Aucune version corrigée** | — | Accepter |
| uuid 7.0.3 | modérée | `@expo/config-plugins` → xcode | Non : prebuild iOS | 11.1.1+ (majeure pour xcode) | Moyen | Accepter |

`npm audit fix` et `--force` n'ont pas été lancés, et aucune dépendance n'a été modifiée pendant F-U2.16, pour ne pas invalider la certification. **Seuls `axios` (correction mineure, exposée en production) et `decode-uri-component` (exposé, correction majeure) concernent l'application livrée.**

## 5. Phase 4 — Service de premier plan `expo-location`

| Question | Réponse |
|---|---|
| Origine exacte | `node_modules/expo-location/android/src/main/AndroidManifest.xml` : `<service .services.LocationTaskService foregroundServiceType="location" exported="false">`, déclaré **sans condition** par la bibliothèque. Le plugin n'ajoute `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` et `ACCESS_BACKGROUND_LOCATION` que si `isAndroidBackgroundLocationEnabled` ou `isAndroidForegroundServiceEnabled` est activé, **ce qui n'est pas le cas**. |
| Origine de `FOREGROUND_SERVICE` | `androidx.work:work-runtime` 2.9.1 (WorkManager, `SystemForegroundService` sans type), dépendance transitive. Sans rapport avec la localisation. |
| Utilisation effective | **Aucune** : pas de `startLocationUpdatesAsync`, de géorepérage, de `TaskManager` (non installé) ni de demande de localisation en arrière-plan |
| Usage réel de la localisation | Premier plan ponctuel uniquement : `CarteScreen.jsx` (recentrage de la carte) et `PublierBienScreen.jsx` (position d'un bien publié), via `requestForegroundPermissionsAsync` et `getCurrentPositionAsync` |
| Nécessité métier | Les permissions `ACCESS_COARSE_LOCATION` et `ACCESS_FINE_LOCATION` sont **justifiées** (carte, géolocalisation d'une annonce). Le service *location* n'est **pas nécessaire**. |
| Conformité | Sous targetSdk 36, Android refuserait de démarrer ce service comme service de premier plan de localisation sans `FOREGROUND_SERVICE_LOCATION`, absente du binaire. Il est donc **inerte**. Les fiches Data safety (`docs/compliance/google-play-data-safety.md`) déclarent la localisation approximative et précise, en premier plan, sans arrière-plan : c'est cohérent. |
| Impact Play Console | Ni `FOREGROUND_SERVICE_LOCATION` ni `ACCESS_BACKGROUND_LOCATION` : **pas de déclaration de localisation en arrière-plan** à prévoir. Le formulaire de types de services de premier plan ne devrait pas être déclenché, faute de permission `FOREGROUND_SERVICE_<TYPE>`. À confirmer lors du premier envoi de l'AAB, car la Play Console peut interroger sur tout service typé. |

**Décision : rien retiré.**

Option de durcissement, non appliquée, à valider : supprimer `LocationTaskService` du manifeste fusionné par un petit plugin de configuration (`tools:node="remove"`). L'impact fonctionnel est nul compte tenu de l'usage constaté, mais il faudrait revalider la build native et le test `androidReleaseManifest`.

## 6. Phase 5 — Préparation EAS / Google Play

Configuration relue, sans aucune commande EAS distante :

| Élément | Constat |
|---|---|
| Profil `production` | `android.buildType: app-bundle` (AAB), `autoIncrement: true`, `channel: production`, `environment: production` |
| Versions | `appVersionSource: remote` : le `versionCode` est géré par EAS (le `versionCode: 2` local est ignoré pour les builds EAS) ; `version` 1.0.1 ; `runtimeVersion` en politique `appVersion` |
| Signature | `credentialsSource` non défini, donc **identifiants gérés par EAS** (distant). Keystore local `@jenelkabos25__altimmo-app.jks` (copie de sauvegarde) **ignoré par Git, non suivi** |
| Soumission | `submit.production.android.serviceAccountKeyPath: ./google-service-account.json` : **fichier absent** localement (il serait ignoré par Git s'il était créé) |
| Secrets locaux | `.jks`, `client_secret_*.json`, `google-services.json`, `.env`, APK : **tous ignorés et non suivis** |
| Environnement de production | `EXPO_PUBLIC_API_URL=https://altitude-vision.onrender.com/api` ; `SENTRY_DISABLE_AUTO_UPLOAD=true` (**pas d'envoi de source maps à Sentry** : traces de plantage de production illisibles) |

### Checklist de validation humaine (AAB de production et Play Console)

1. [ ] Décider de l'envoi des source maps Sentry pour le profil `production` (`SENTRY_DISABLE_AUTO_UPLOAD`) : changement de configuration de production, à autoriser explicitement.
2. [ ] Vérifier dans EAS (`eas credentials`) que le keystore Android de production est bien celui enregistré dans la Play Console (signature d'application Play / clé d'importation).
3. [ ] Lancer la build distante `eas build -p android --profile production` (**payante, sur autorisation explicite**) et noter le `versionCode` attribué.
4. [ ] Contrôler le manifeste de l'AAB produit (`bundletool dump manifest`) : permissions identiques à la build locale (§5), absence de `CAMERA`, `READ_MEDIA_*`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE_LOCATION` et `ACCESS_BACKGROUND_LOCATION`.
5. [ ] Installer l'AAB, via un APK universel produit par `bundletool`, sur un appareil réel Android 14 ou plus : connexion, carte (localisation au premier plan), publication d'un bien, notifications push, messagerie, OTA (`expo-updates`, canal `production`).
6. [ ] Fournir `google-service-account.json` (hors Git) ou la clé de compte de service dans EAS **avant** `eas submit`.
7. [ ] Play Console : mettre à jour Data safety (localisation approximative et précise, premier plan) et la politique de confidentialité ; répondre aux éventuelles questions sur les services de premier plan ; questionnaire de contenu ; publication d'abord sur un **canal de test interne**.
8. [ ] Valider les 9 captures (§3) et le lot de corrections F-U2.14 à F-U2.16 avant tout commit.

## 7. Synthèse des réserves

| Réserve héritée de F-U2.15 | Statut |
|---|---|
| Porte de release verte en une exécution | **Restante.** 12/13 ; seule cause : plantage natif V8 de l'infrastructure, chaque étape ayant été démontrée verte au moins une fois |
| Validation des captures | **Levée techniquement** (9/9 justifiées). Décision humaine requise |
| Vulnérabilités npm | **Analysées.** 2 exposées en production : `axios` (correctif mineur à appliquer), `decode-uri-component` (majeure à planifier) |
| Service de premier plan `expo-location` | **Levée.** Inerte, sans incidence sur les déclarations ; durcissement optionnel proposé |
| EAS / Play Console | **Préparée.** Checklist ci-dessus ; build distante et soumission non déclenchées |

## 8. Risques de sécurité identifiés

1. `axios` 1.19.0 dans l'application livrée : faible exploitabilité sous React Native, mais un correctif mineur existe.
2. `decode-uri-component` dans l'analyse des liens profonds : déni de service local possible par un lien piégé.
3. Plantages de production non symbolisés côté Sentry (pas d'envoi de source maps).
4. Les vulnérabilités d'outillage (critique `shell-quote` comprise) n'atteignent pas l'application livrée, mais exposent les postes de développement et de build.
5. Le poste de certification est instable (V8, GPU), ce qui empêche une preuve locale reproductible.

Les invariants PLATFORM, TENANT et UNRESOLVED, les autorisations et les règles financières n'ont été ni modifiés ni réduits par F-U2.16. Ils restent couverts par les suites vertes : 3 454 tests MongoDB et 96/96 en E2E de production (F-U2.15).

## 9. Recommandation

- **Préparation technique : GO conditionnel.** Toutes les suites fonctionnelles, de sécurité et de conformité sont vertes, et chaque étape de la porte a réussi intégralement au moins une fois. L'unique échec est un défaut d'infrastructure démontré, indépendant du code.
- **Autorisation de publication : NO-GO à ce stade.** La porte de release n'a pas été verte en une seule exécution reproductible. Pour la lever :
  1. une exécution `certify:release` **13/13** sur une infrastructure stable : CI Linux après commit et poussée sur une branche (décision du propriétaire), ou un autre poste. Avant de réutiliser ce poste, un diagnostic matériel (Apple Diagnostics) est conseillé ;
  2. la mise à jour d'`axios` vers 1.20.x, suivie des tests mobiles ;
  3. la validation humaine des 9 captures ;
  4. la checklist EAS / Play Console (§6), avec la build distante et la soumission sur autorisation explicite.

Aucune publication sans nouvelle autorisation explicite du propriétaire.
