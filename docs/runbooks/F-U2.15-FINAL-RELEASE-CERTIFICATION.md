# F-U2.15 — Déblocage de la release et certification finale

Dates : 2026-10-15 → 2026-10-16. Dépôt `altitude-vision-1`, branche `main`, HEAD `5a54a13` (inchangé). Aucun commit, push, déploiement ni changement de secret.

Rapport précédent : [F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md](F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md).

## 1. État Git

| | Début F-U2.15 | Fin F-U2.15 |
|---|---|---|
| Branche / HEAD | `main` / `5a54a13` | `main` / `5a54a13` |
| Fichiers suivis modifiés | 242 | 246 |
| Fichiers non suivis | 202 | 203 |
| Indexés | 0 | 0 |

Sauvegarde de départ (hors dépôt, droits `700`) : `~/altitude-vision-backups/F-U2.15-start-20261015-215608/`. Elle contient le patch binaire, l'archive des fichiers non suivis, ainsi que `package.json` et `package-lock.json` mobiles d'origine.

Aucune modification préexistante n'a été perdue. Les deux seuls fichiers sortis de `git diff` sont deux captures inbox **régénérées à l'identique** de HEAD, sans aucune restauration Git.

## 2. Fichiers modifiés par F-U2.15

| Fichier | Nature |
|---|---|
| `altimmo-app/package.json`, `altimmo-app/package-lock.json` | Alignement des correctifs Expo SDK 57 (§3) |
| `client/next.config.mjs` | Drapeau `NEXT_E2E_BUILD=1` : sortie `.next-e2e` et backend local autorisé dans la CSP **uniquement** pour ce build (§5) |
| `client/lib/__tests__/nextConfigE2EBuild.test.js` (nouveau) | Garantit que la CSP de production reste inchangée sans le drapeau (3 tests) |
| `client/playwright.config.js` | Délai de **démarrage** du webServer à 900 s, pour couvrir le build de production. Aucun délai de test modifié. |
| `server/scripts/start-accommodation-e2e.js` | `next build` + `next start` par défaut (`E2E_NEXT_MODE=dev` conserve `next dev`) ; index Mongo construits avant le démarrage du serveur ; attente de `/api/ready` |
| `.github/workflows/e2e.yml` | Commentaire mis à jour ; `timeout-minutes` passé de 30 à 45 |
| `.gitignore` | `client/.next-e2e/` |
| `client/e2e/accommodationSearchBar1/accommodations-visual.spec.js`, `client/e2e/inbox2/inbox-visual.spec.js` | Contexte de rendu fixé (§6) |
| `client/e2e/e2e1-pms-workflow.spec.js` | Test cross-owner restreint aux réponses de l'API et **renforcé** (§5) |
| 9 captures `*.png` | Régénérées par le banc corrigé (§6) |

## 3. Dépendances mises à jour (Expo SDK 57, correctifs uniquement)

Commande : `npx expo install --fix` (npm, lockfile existant). Aucune montée majeure. React Native 0.86.3 et React 19.2.3 inchangés.

| Paquet | Avant | Après |
|---|---|---|
| expo | 57.0.26 | 57.0.30 |
| expo-asset | 57.0.18 | 57.0.20 |
| expo-auth-session | 57.0.13 | 57.0.16 |
| expo-constants | 57.0.20 | 57.0.22 |
| expo-crypto | 57.0.3 | 57.0.4 |
| expo-dev-client | 57.0.19 | 57.0.20 |
| expo-location | 57.0.20 | 57.0.21 |
| expo-notifications | 57.0.21 | 57.0.23 |
| expo-sharing | 57.0.22 | 57.0.23 |
| expo-updates | 57.0.24 | 57.0.26 |
| jest-expo | 57.0.5 | 57.0.6 |

Transitives : `expo-modules-core` 57.0.23, `@expo/config-plugins` 57.0.10, `@expo/prebuild-config` 57.0.19, `@expo/cli` 57.0.31 et d'autres correctifs `@expo/*`. Une sous-dépendance ajoutée (`@expo/json-file`), aucune supprimée.

**Impact natif analysé** (comparaison des paquets avant/après) :
- **aucun `AndroidManifest.xml` modifié** ;
- `build.gradle` : seuls les numéros de version changent ;
- `expo-notifications` 57.0.23 : correctif d'un plantage sous Expo Go et retouche de l'obtention du jeton push (TypeScript) ;
- `expo-updates` 57.0.25 et 57.0.26 : sans changement visible ; 57.0.24 corrigeait le retéléchargement d'assets déjà embarqués ;
- `runtimeVersion` (politique `appVersion`) inchangé : une OTA publiée depuis ce code reste servie aux binaires 1.0.1 existants, ce qui est acceptable pour des correctifs internes au SDK 57 ;
- dossiers natifs régénérés par prebuild (CNG, ignorés par Git), aucun fichier natif suivi.

## 4. Validation mobile et conformité Google Play

| Contrôle | Résultat |
|---|---|
| `expo-doctor` | **21/21** (en échec à la fin de F-U2.14) |
| Tests (`test:coverage`) | **657/657**, dont `androidReleaseManifest.test.js` (manifeste résolu depuis un prebuild propre) |
| Syntaxe, typecheck, lint | OK (0 erreur, 128 avertissements) |
| Export JavaScript Android (`expo export`) | OK : bundle JS uniquement, **ce n'est pas une build native** |
| **Build native Android** | **`./gradlew :app:assembleRelease` réussie** (7 min 06), APK de 65 Mo, ABI `arm64-v8a`, prebuild propre dans une copie isolée, **signature avec la clé de debug d'Expo** (keystore de production non utilisé). La copie a été supprimée ensuite. |

Manifeste du **binaire réel** (`aapt2`) :
- `targetSdk` 36, `versionCode` 2, `versionName` 1.0.1 ;
- **absents** : `CAMERA`, `READ_MEDIA_*`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` ;
- aucun service `mediaPlayback` ;
- ni `debuggable`, ni trafic en clair.

**Impact Google Play : aucun changement de permissions ni de déclarations par rapport à la certification R2.**

Point d'attention, **antérieur** à F-U2.15 : `expo-location` déclare un service de premier plan de type *location*. Son manifeste n'est pas modifié par cette mise à jour.

## 5. Playwright en mode production

**Configuration.** Le banc lance un `next build` de production avec `NEXT_E2E_BUILD=1` et `NEXT_PUBLIC_API_URL=http://localhost:5000/api`, dont la sortie va dans `client/.next-e2e`. Il sert ensuite l'application avec `next start`, sous le garde réseau E2E.

**Sécurité de cette configuration.**
- La CSP de production n'autorise `localhost` qu'avec ce drapeau, qui force aussi la sortie dans `.next-e2e`. Netlify publiant `.next`, une build E2E n'est jamais publiable. Le test `nextConfigE2EBuild.test.js` le vérifie.
- Les données restent isolées : `MongoMemoryReplSet` éphémère, prestataire de paiement factice, identifiants externes neutralisés.
- `bypassCSP` n'est pas utilisé.
- Les 96 scénarios sont conservés, aucun test n'est désactivé et aucune autorisation n'est assouplie.

**Causes découvertes et corrigées en production.**
1. **Démarrage du backend.** La construction en arrière-plan des index des 147 modèles (`autoIndex`, environ 45 s) ralentissait toutes les premières requêtes : 26 s pour la première fiche de bien. Sous `next dev`, ce délai était masqué par la compilation des pages. Les index sont désormais construits avant le démarrage du serveur, et le banc attend `/api/ready`. Mesure : 404 en 22 ms au lieu de 4,4 s, fiche de bien en 57 ms au lieu de 7,2 s.
2. **Test cross-owner.** En production, Next précharge des routes de page (RSC, 200, **sans données**) dont l'URL contient l'identifiant de l'hôtel. La trace prouve que l'API répond bien `404` et `403`. Le test ne regarde plus que les réponses de l'API, et il échoue désormais si **une seule** réponse API réussit pour l'hôtel étranger pendant la visite.

**Résultats.**

| Campagne (production) | Résultat | Durée |
|---|---|---|
| n° 1 (avant correctifs) | 95/96 | 9,8 min |
| n° 2 et n° 3 (avant correctif d'index) | 94/96, 94/96 | 8,5 min |
| **n° 4 et n° 5 (configuration finale)** | **96/96 et 96/96**, sans relance | 8,8 et 8,9 min |

Pour comparaison, la campagne finale de F-U2.14 sous `next dev` donnait 96/96 en 20,1 min.

## 6. Captures d'écran (11 fichiers suivis)

**Constat.** Les versions modifiées pendant F-U2.14 étaient **invalides**. Les specs visuelles montent le composant par `setContent`, sans `<meta viewport>`. Exécutées aussi sous `mobile-chromium` (Pixel 5 : `isMobile`, DPR 2,75), elles produisaient une mise en page desktop réduite (viewport de mise en page de 980 px) en 3960×2475. La passe mobile, exécutée en dernier, écrasait ainsi les références.

**Correction.** `test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 })` dans les deux specs. C'est le contexte des références ; les tests tournent toujours dans les deux projets.

**Comparaison avec HEAD après régénération** (pixels différant de plus de 40 niveaux).

| Capture | Écart | Verdict |
|---|---|---|
| inbox `mobile-dark-folders`, `mobile-light-folders` | identiques octet pour octet | Inchangées |
| inbox `mobile-light-list` | 0,14 % | Légitime (anticrénelage) |
| accommodations `mobile-dark` | 0,16 % | Légitime |
| accommodations `desktop-dark-filters-closed` | 0,32 % | Légitime |
| accommodations `desktop-light-filters-closed` | 0,54 % | Légitime |
| inbox `desktop-light` / `desktop-dark` | 0,75 % / 0,82 % | Légitime (horodatage dynamique) |
| accommodations `mobile-light` | 1,23 % | Légitime (état de l'animation d'apparition) |
| accommodations `desktop-light-filters-open` | 1,68 % | Légitime (animation et anticrénelage) |
| inbox `mobile-light-detail` | 2,93 % | **Amélioration** : la référence HEAD montrait le corps du message **tronqué** (défaut d'iframe couvert par les tests IH3, désormais verts) ; la date diffère |

Aucune régression visuelle. Identité visuelle Altimmo (orange et blanc) inchangée. **Ces captures ne sont pas validées automatiquement : à approuver par le propriétaire avant tout commit.**

## 7. Certification finale

`certify:release` (9 900 s), exécution complète du 2026-10-15 23:02 au 2026-10-16 01:47 :

| Section | Étape | Résultat |
|---|---|---|
| Serveur | Architecture, lint | ✅ |
| Serveur | Tests unitaires | ✅ 1 942/1 942 |
| Serveur | Tests MongoDB (8 shards) | ✅ 3 454/3 454 |
| Client | Lint, build | ✅ |
| Client | Tests | ❌ **3 processus Vitest tués par un plantage natif V8** (`Check failed: marking_state_.GreyToBlack(object)`). 181/181 fichiers exécutés réussis (1 346 tests), 3 fichiers non exécutés, **aucune assertion en échec**. |
| Mobile | Syntaxe, lint, types, tests (657/657), **Doctor (21/21)**, export | ✅ |

**Total : 12/13 validations.**

Relances de la suite client seule :
- n° 1 : 2 processus tués par le même plantage V8 ;
- n° 2 : **184/184 fichiers, 1 366/1 366 tests** (1 363 de référence, plus les 3 nouveaux tests de configuration).

Classement selon `FAILURE_CLASSIFICATION.md` : **infrastructure, défaut natif du runtime** Node v20.20.2 (V8, x86_64 macOS), sans lien avec le code de l'application. C'est la même famille que les plantages `ConcurrentMarking` observés avant l'interruption de F-U2.14.

Autres résultats de F-U2.15 : Playwright production 96/96 (deux fois), mobile 21/21 et 657/657, build native release OK.

## 8. Limites des validations locales

- Build native **Android** signée avec la clé de debug d'Expo, sur une seule ABI. Ni build EAS de production, ni signature de production, ni test sur appareil réel ou dans la Play Console.
- **iOS** : aucune build ni aucun test natif (pas de chaîne iOS validée localement).
- E2E Chromium uniquement (desktop et Pixel 5 émulé), sur des données de test éphémères.
- `npm` signale 78 vulnérabilités (18 modérées, 59 élevées, 1 critique) dans les dépendances mobiles. Elles n'ont été ni auditées ni corrigées : `npm audit fix` est hors périmètre, et `--force` serait potentiellement cassant.

## 9. Risques résiduels

1. **Stabilité de Node v20.20.2 sur cette machine**, avec des plantages natifs V8 intermittents. C'est la seule cause de l'échec de la porte de release.
2. OTA `expo-updates` : `runtimeVersion` inchangée alors que des modules natifs ont reçu des correctifs.
3. Service de premier plan *location* déclaré par `expo-location`, antérieur à F-U2.15 : à confirmer dans les déclarations Play Console.
4. La CI E2E fait désormais un build de production : elle dure environ 3 min de plus pour le build et 45 s pour les index (délai global relevé à 45 min).
5. Captures en attente de validation humaine.

## 10. Verdict

**`RELEASE READY SOUS CONDITIONS`**

Les causes du blocage F-U2.14 sont levées :
- `expo-doctor` 21/21 ;
- build native Android release réussie ;
- conformité Google Play inchangée ;
- E2E 96/96 en mode production, deux fois consécutives ;
- ensemble des suites fonctionnelles au vert.

La dernière exécution complète de la porte de release reste formellement à **12/13**. L'étape en échec ne contient aucune assertion en échec : elle a été interrompue par un plantage natif du runtime Node, et la même suite passe intégralement (184/184) à la relance.

Conditions à lever avant la release :
1. **Une exécution complète et verte de `certify:release`** sur un runtime stable : CI Linux (Node 20), ou autre correctif de Node 20 installé localement après accord.
2. **Validation humaine** des 9 captures régénérées (§6).
3. Build **EAS de production** signée et revue Play Console. Ces étapes ne sont pas réalisables localement et relèvent du propriétaire.

Aucune mise en production sans nouvelle autorisation explicite.
