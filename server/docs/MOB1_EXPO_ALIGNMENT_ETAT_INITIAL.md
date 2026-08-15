# MOB-1 — État initial : alignement des dépendances Expo

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2D, non commité, `git diff --check` propre avant modification). Ce document précède toute modification de ce sprint.

## 1. Rapports lus

`SYNC1_WEB_MOBILE_REPORT.md`, `SYNC2A_MOBILE_FOUNDATIONS_REPORT.md`, `SYNC2B_MOBILE_PMS_REPORT.md`, `SYNC2C_MOBILE_NOTIFICATIONS_REPORT.md`, `SYNC2D_FINAL_PARITY_REPORT.md`, `SYNC2D_FINAL_PARITY_ETAT_INITIAL.md`, `SYNC2D_FINAL_PARITY_MATRIX.md`. Chaque rapport SYNC mentionne, sans jamais le traiter, la même dette Expo Doctor (« 20/21, 12 packages hors version ») — confirmée identique en base de ce sprint (§5).

## 2. Correction factuelle du postulat du mandat (à documenter, pas à passer sous silence)

Le mandat MOB-1 affirme à plusieurs reprises (titre, §1, §3, §5, §64, §76) que le projet est sur **Expo SDK 52**. Vérification directe :

- `altimmo-app/package.json` : `"expo": "~57.0.12"`, `"react": "19.2.3"`, `"react-native": "0.86.2"`.
- `altimmo-app/node_modules/expo/package.json` : `"version": "57.0.12"` (installé, pas seulement déclaré).
- Aucune clé `sdkVersion` dans `app.json` pour arbitrer autrement.
- `npx expo-doctor` et `npx expo install --check` résolvent tous deux leurs versions « attendues » contre le SDK réellement installé, soit **SDK 57**, et non 52.
- Troisième signal contradictoire trouvé : `altimmo-app/AGENTS.md` référence la documentation **v56.0.0** (« Expo HAS CHANGED... docs.expo.dev/versions/v56.0.0/ »), ni 52 ni 57.
- La skill `altitudevision` (mémoire persistante) indique elle aussi « Expo SDK 52 + React Native 0.76.9 », également obsolète face au `package.json` réel (`react-native: 0.86.2`).

**Conclusion** : le projet est réellement sur **Expo SDK 57** depuis un moment non déterminé par ce sprint (aucune trace de `sdkVersion` alternative, aucun commit isolé n'a été audité pour dater la transition — hors périmètre de MOB-1). Le mandat est suivi sur le fond (aligner les patchs sur le SDK réellement installé, ne pas changer de SDK) : la mécanique `expo install`/`expo-doctor` est par construction relative au SDK installé, donc l'écart de numérotation (52 vs 57 vs 56) n'affecte pas la validité de la procédure d'alignement elle-même. Ce constat est transmis tel quel, sans reformulation a posteriori du mandat.

## 3. Baseline outillage

| Outil | Version |
|---|---|
| Node | v20.20.2 |
| npm | 10.8.2 |
| expo (CLI, via npx) | 57.0.14 |
| expo (package installé, avant sprint) | 57.0.12 |
| react | 19.2.3 |
| react-native | 0.86.2 |

## 4. Baseline tests/gates (avant modification)

Confirmée par les rapports SYNC-2A à SYNC-2D, non ré-exécutée avant modification (déjà vérifiée exhaustivement en fin de SYNC-2D sans régression) : **33 suites / 313 tests**, tous verts. Cette baseline sert de référence de non-régression pour ce sprint (voir REPORT §correspondant pour la ré-exécution post-modification).

## 5. Baseline Expo Doctor (avant modification)

`npm run doctor` → **20/21 checks passed, 1 check failed, 12 packages out of date** :

| Package | Installé | Attendu (SDK 57) |
|---|---|---|
| expo | 57.0.12 | ~57.0.13 |
| expo-asset | 57.0.10 | ~57.0.11 |
| expo-auth-session | 57.0.6 | ~57.0.7 |
| expo-dev-client | 57.0.11 | ~57.0.12 |
| expo-file-system | 57.0.2 | ~57.0.4 |
| expo-image | 57.0.2 | ~57.0.3 |
| expo-image-picker | 57.0.9 | ~57.0.10 |
| expo-location | 57.0.9 | ~57.0.10 |
| expo-notifications | 57.0.10 | ~57.0.11 |
| expo-sharing | 57.0.11 | ~57.0.12 |
| expo-store-review | 57.0.1 | ~57.0.2 |
| expo-updates | 57.0.13 | ~57.0.14 |

Tous les écarts sont des **versions de patch** (troisième chiffre uniquement), aucune version mineure/majeure — risque de compatibilité a priori faible, à confirmer par les gates.

## 6. Périmètre du sprint

Aligner strictement ces 12 packages sur les versions patch attendues par le SDK réellement installé (57), sans changer de SDK, sans `--force`/`--legacy-peer-deps` non justifié, sans édition directe de `node_modules`, sans suppression de `package-lock.json`, via `npx expo install` (jamais `npm install <pkg>@latest`), en groupes incrémentaux bisectables plutôt qu'en un seul lot.

## 7. Fichiers concernés (attendus, avant modification)

`altimmo-app/package.json`, `altimmo-app/package-lock.json` uniquement. Aucun fichier source (`src/**`) attendu à être modifié — ce sprint est un alignement de dépendances, pas une migration de code.

## 8. État git avant modification

`git status --short` : 53 lignes (fichiers modifiés/nouveaux hérités des sprints E2E-1 à SYNC-2D, tous non commités, cohérents avec chaque rapport précédent). `git diff --check` propre. `git branch --show-current` → `main`. `git rev-parse HEAD` → `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5`.

## 9. Fonctionnalités certifiées à ne pas régresser

Auth (tokenVersion/compte désactivé), Tenant runtime (`PlatformTenantRuntimeContext`), IAM-3 (`staffCapabilities`), Navigation (registry partagé), PMS hôtelier complet (housekeeping/maintenance/cockpit/financial readiness), Notifications (router unifié SYNC-2C), Deep-links (cross-owner/cross-tenant testés SYNC-2D), Realtime (`useHotelRealtime`, room hôtel), GL locataire (portail complet), Client (recherche/visites/messagerie), Owner (annonces/hébergement indépendant).

## 10. Packages hors périmètre (dépendances Expo non listées par Doctor)

`expo-audio`, `expo-camera`, `expo-crypto`, `expo-device`, `expo-document-picker`, `expo-font`, `expo-haptics`, `expo-linear-gradient`, `expo-secure-store`, `expo-status-bar`, `expo-video`, `expo-web-browser` : déjà alignés (absents de la liste Doctor), non touchés par construction.

## 11. Risques identifiés avant modification

- `expo` (paquet racine) peut réintroduire des copies imbriquées (`node_modules/expo/node_modules/...`) de packages déjà présents à la racine, un artefact courant de résolution npm après bump de la dépendance parente — à surveiller via un second passage Doctor après le groupe « core ».
- `expo-notifications`/`expo-location`/`expo-image-picker` touchent des permissions natives sensibles (déjà testées via mocks Jest) — aucune régression attendue au niveau JS pur pour un bump de patch, mais gates complets exigés.
- `expo-file-system` (57.0.2 → 57.0.4) est l'écart de patch le plus large des 12 — surveillance ciblée prévue.

## 12. Stratégie d'exécution

3 groupes bisectables :
1. Core runtime : `expo`, `expo-updates`, `expo-dev-client`.
2. Média/asset : `expo-asset`, `expo-file-system`, `expo-image`, `expo-image-picker`, `expo-sharing`.
3. Auth/permissions/divers : `expo-auth-session`, `expo-location`, `expo-notifications`, `expo-store-review`.

Doctor ré-exécuté après chaque groupe ; suite de tests complète et gates finaux après le groupe 3.

## 13. Commande exacte utilisée

`npx expo install <pkg>@<version attendue exacte>` par groupe (jamais `@latest`, jamais `--force`/`--legacy-peer-deps`).

## 14. Definition of Done de ce sprint

`expo-doctor` → 21/21 réel (pas déclaratif) ; 33/33 suites et 313/313 tests toujours verts ; lint 0 erreur ; export Android réussi ; `package.json`/`package-lock.json` seuls fichiers modifiés ; aucun `git add`/`commit`/`push`.

## 15. Verdict attendu en fin de sprint

READY ou NOT READY pour MOB-E2E, avec justification factuelle — pas de certification déclarative sans preuve d'exécution.
