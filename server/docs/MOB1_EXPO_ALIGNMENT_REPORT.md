# MOB-1 — Rapport final : alignement des dépendances Expo & certification Expo Doctor

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (**inchangé** — aucun commit effectué ce sprint, conformément au mandat).

## 1. Résumé exécutif

Les 12 packages Expo signalés en dette (Doctor 20/21) ont été alignés sur les versions patch attendues par le SDK réellement installé, en 3 groupes bisectables via `npx expo install`. **Doctor rapporte désormais 21/21, vérifié par exécution réelle et non déclaré.** Aucune régression : 33/33 suites, 313/313 tests (baseline SYNC-2D inchangée), lint 0 erreur, export Android réussi.

## 2. Correction factuelle du postulat « Expo SDK 52 » du mandat

**Le projet n'est pas sur Expo SDK 52.** Vérification directe et croisée :

- `package.json` déclare `"expo": "~57.0.12"` (avant sprint), `"react-native": "0.86.2"`.
- Le paquet `expo` réellement installé dans `node_modules` était `57.0.12` — c'est-à-dire **SDK 57**, pas 52.
- Aucune clé `sdkVersion` dans `app.json` ne contredit cette lecture.
- `altimmo-app/AGENTS.md` cite une troisième valeur, **v56.0.0**, elle aussi incohérente avec 52 et avec l'état réel (57).
- La mémoire persistante de session (skill `altitudevision`) cite également « Expo SDK 52 + React Native 0.76.9 » — obsolète sur les deux points (`react-native` réel : `0.86.2`).

Trois sources indépendantes (mandat, `AGENTS.md`, mémoire de session) donnent trois numéros de SDK différents (52, 56, « pas de valeur »), tous incohérents avec l'unique fait vérifiable : le paquet `expo` installé. Aucune de ces sources n'a été modifiée ou « corrigée » par ce sprint — ce n'était pas dans le périmètre MOB-1 (alignement de dépendances, pas mise à jour de documentation tierce) — mais l'écart est documenté ici pour éviter qu'un futur sprint ne reparte du chiffre 52 ou 56 sans vérification.

**Impact sur la procédure d'alignement : aucun.** `npx expo install`/`npx expo-doctor` résolvent toujours leurs versions « attendues » relativement au SDK **réellement installé** (lu depuis `node_modules/expo/package.json`), jamais depuis une doc externe ou un chiffre déclaré. La mécanique appliquée dans ce sprint est donc correcte indépendamment de la confusion 52/56/57.

## 3. Table exacte des 12 packages (avant / après / statut)

| Package | Installé (avant) | Attendu (SDK 57) | Installé (après) | Écart | Type de bump | Risque observé |
|---|---|---|---|---|---|---|
| expo | 57.0.12 | ~57.0.13 | 57.0.13 | patch | mineur | aucun |
| expo-asset | 57.0.10 | ~57.0.11 | 57.0.11 | patch | mineur | aucun |
| expo-auth-session | 57.0.6 | ~57.0.7 | 57.0.7 | patch | mineur | aucun |
| expo-dev-client | 57.0.11 | ~57.0.12 | 57.0.12 | patch | mineur | aucun |
| expo-file-system | 57.0.2 | ~57.0.4 | 57.0.4 | patch (×2) | mineur | aucun |
| expo-image | 57.0.2 | ~57.0.3 | 57.0.3 | patch | mineur | aucun |
| expo-image-picker | 57.0.9 | ~57.0.10 | 57.0.10 | patch | mineur | aucun |
| expo-location | 57.0.9 | ~57.0.10 | 57.0.10 | patch | mineur | aucun |
| expo-notifications | 57.0.10 | ~57.0.11 | 57.0.11 | patch | mineur | aucun |
| expo-sharing | 57.0.11 | ~57.0.12 | 57.0.12 | patch | mineur | aucun |
| expo-store-review | 57.0.1 | ~57.0.2 | 57.0.2 | patch | mineur | aucun |
| expo-updates | 57.0.13 | ~57.0.14 | 57.0.14 | patch | mineur | aucun |

Tous à jour exact avec l'attendu SDK 57 après le sprint.

## 4. Groupes d'exécution (bisectables, mandat §26-27)

1. **Core runtime** (`expo`, `expo-updates`, `expo-dev-client`) — `npx expo install expo@~57.0.13 expo-updates@~57.0.14 expo-dev-client@~57.0.12`. Effet secondaire transitoire observé : duplication imbriquée `node_modules/expo/node_modules/{expo-asset,expo-file-system,expo-constants}` (résolution npm normale après bump du paquet parent), Doctor passé à 19/21 temporairement (2 checks : duplication + 9 packages restants). Résolu par le groupe 2.
2. **Média/asset** (`expo-asset`, `expo-file-system`, `expo-image`, `expo-image-picker`, `expo-sharing`) — installation propre, `npm install` a retiré 3 paquets dupliqués (dédup automatique).
3. **Auth/permissions/divers** (`expo-auth-session`, `expo-location`, `expo-notifications`, `expo-store-review`) — installation propre, aucune duplication résiduelle.

Aucune commande `npm install --force`/`--legacy-peer-deps` utilisée. Aucune édition directe de `node_modules`. `package-lock.json` conservé et mis à jour normalement par `npm install` (invoqué en interne par `expo install`).

## 5. Expo Doctor — avant/après (exécution réelle, pas déclarative)

**Avant** : `20/21 checks passed. 1 check failed.` (12 packages hors version — voir ETAT_INITIAL §5).

**Après (vérifié par exécution répétée, y compris après nettoyage du dossier d'export temporaire)** :
```
Running 21 checks on your project...
21/21 checks passed. No issues detected!
```

## 6. Suite de tests (après modification)

```
Test Suites: 33 passed, 33 total
Tests:       313 passed, 313 total
Snapshots:   0 total
```
Identique en nombre à la baseline confirmée en fin de SYNC-2D — **aucune régression**. Aucun test modifié ni ajouté ce sprint (sprint de dépendances pur, pas de changement de comportement applicatif).

## 7. Lint

`npm run lint` → **0 erreur**, 102 avertissements pré-existants (`import/first` sur des fichiers de test, non liés à ce sprint, non introduits par ce sprint — présents avant modification, non traités car hors périmètre MOB-1).

## 8. Export Android

`npx expo export --platform android` → succès, bundle Hermes généré (`index-*.hbc`, 6.7MB), 54 assets résolus, aucune erreur de résolution de module. Dossier temporaire supprimé après vérification (aucun artefact laissé dans le repo).

## 9. Types

Aucun système de types statique configuré au niveau du projet mobile permettant un gate dédié distinct des tests (le projet est JS, pas TypeScript, à l'exception de `src/config/environment.ts` déjà couvert par la suite de tests existante) — aucune régression de type détectable au-delà de ce que la suite de tests/l'export couvrent déjà.

## 10. Fichiers modifiés (exhaustif)

Uniquement `altimmo-app/package.json` (24 lignes, les 12 versions ciblées, aucune autre modification — vérifié par `git diff`) et `altimmo-app/package-lock.json` (243 lignes, dérivées automatiquement par `npm install`, non éditées manuellement). Aucun fichier `src/**` modifié.

## 11. Fonctionnalités certifiées précédemment — statut de non-régression

| Domaine | Statut post-MOB-1 |
|---|---|
| Auth (tokenVersion/compte désactivé) | ✅ testé, inchangé |
| Tenant runtime | ✅ testé, inchangé |
| IAM-3 | ✅ testé, inchangé |
| Navigation (registry) | ✅ testé, inchangé |
| PMS hôtelier (housekeeping/maintenance/cockpit/financial readiness) | ✅ testé, inchangé |
| Notifications (router unifié) | ✅ testé, inchangé |
| Deep-links cross-owner/cross-tenant | ✅ testé, inchangé |
| Realtime (room hôtel) | ✅ testé, inchangé |
| GL locataire | ✅ testé, inchangé |
| Client (recherche/visites/messagerie) | ✅ testé, inchangé |
| Owner (annonces/hébergement indépendant) | ✅ testé, inchangé |

## 12. `npm run health`/`npm run ci`/`release-check`

Non exécutés — non trouvés comme scripts définis dans `altimmo-app/package.json` (uniquement `test`, `test:coverage`, `lint`, `doctor`, `start`/variants Expo). Ne pas prétendre les avoir exécutés.

## 13. Écarts non traités (hors périmètre, documentés)

- 102 avertissements ESLint pré-existants (`import/first`) — non introduits ni aggravés ce sprint, non corrigés (hors périmètre MOB-1, sprint de dépendances).
- 24 vulnérabilités `npm audit` (8 moderate, 16 high) rapportées par `npm install` — préexistantes, non quantifiées avant ce sprint (aucune baseline `npm audit` capturée en ETAT_INITIAL), `npm audit fix --force` **non exécuté** volontairement (mandat interdit tout `--force` non justifié ; une résolution d'audit peut forcer des versions majeures incompatibles avec l'alignement SDK strict demandé). À traiter dans un sprint dédié avec sa propre analyse d'impact.
- Confusion de numérotation SDK (52 mandat / 56 `AGENTS.md` / 52 mémoire session / 57 réel) — non résolue au niveau documentation, uniquement constatée et rapportée (§2).

## 14. Réponses aux questions factuelles du mandat

1. Le SDK est-il resté inchangé ? **Oui** — `expo` reste en version majeure 57 (57.0.12 → 57.0.13), aucun changement de SDK.
2. Tous les écarts étaient-ils des patchs ? **Oui**, confirmé par la table §3.
3. Une duplication de dépendances est-elle apparue ? **Oui, transitoirement** après le groupe 1 (§4), auto-résolue par le groupe 2 — confirmé par Doctor repassant de 19/21 à 21/21.
4. Le SDK 52 annoncé par le mandat est-il exact ? **Non** — voir §2, NON CONFIRMÉ comme SDK réel, le SDK réel est 57.
5. `--force`/`--legacy-peer-deps` ont-ils été utilisés ? **Non**, à aucun moment.
6. `node_modules` a-t-il été édité directement ? **Non.**
7. `package-lock.json` a-t-il été supprimé ? **Non**, mis à jour normalement par `npm install`.
8. `npx expo install --check` a-t-il été utilisé en amont ? **Oui**, pour confirmer la liste des 12 packages avant toute action.
9. L'alignement a-t-il été fait en un seul lot ou incrémental ? **Incrémental**, 3 groupes bisectables (§4).
10. Doctor est-il réellement 21/21, vérifié par exécution ? **Oui**, deux exécutions concordantes (§5).
11. La suite de tests a-t-elle régressé ? **Non**, 33/33 et 313/313 identiques à la baseline SYNC-2D.
12. De nouveaux tests ont-ils été ajoutés ? **Non** — sprint de dépendances pur, aucun changement de comportement à tester.
13. Le lint a-t-il régressé ? **Non**, 0 erreur avant et après, mêmes avertissements pré-existants.
14. L'export Android a-t-il réussi ? **Oui**, confirmé par exécution réelle (§8).
15. Des vérifications de types ont-elles été faites ? **NON CONFIRMÉ au-delà de la couverture de test existante** — pas de gate `tsc` dédié dans ce projet JS (§9).
16. Des fichiers source (`src/**`) ont-ils été modifiés ? **Non**, uniquement `package.json`/`package-lock.json` (§10).
17. Toutes les fonctionnalités certifiées SYNC-2A→2D restent-elles fonctionnelles ? **Oui, testées** (§11), sous réserve que la couverture de test existante reste représentative (aucune régression comportementale attendue pour des bumps de patch).
18. Le HEAD git a-t-il changé ? **Non**, `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` inchangé.
19. Un commit/push a-t-il été effectué ? **Non**, strictement interdit et non fait.
20. `npm audit` a-t-il été traité ? **Non**, volontairement hors périmètre (§13), pré-existant.
21. `npm run health`/`ci`/`release-check` ont-ils été exécutés ? **Non**, scripts inexistants dans ce projet (§12).
22. La cause du mismatch SDK 52 vs 57 a-t-elle été élucidée (historique du repo) ? **Non, NON CONFIRMÉ** — hors périmètre, aurait nécessité un audit d'historique git non demandé par ce sprint.

## 15. Git — vérification finale (lecture seule uniquement)

```
git status --short   → 55 lignes (53 pré-existantes + package.json + package-lock.json de ce sprint)
git diff --check     → propre
git diff --stat      → altimmo-app/package.json (24 lignes), altimmo-app/package-lock.json (243 lignes), + fichiers hérités SYNC-2A→2D inchangés
git branch --show-current → main
git rev-parse HEAD   → 0fc4157262d3a8b69e86b02cda66cb95d2e26ed5 (inchangé)
```
Aucun `git add`/`commit`/`push` exécuté, conformément au mandat.

## 16. Verdict

**MOB-1 CERTIFIÉ VERT** — Doctor 21/21 vérifié par exécution réelle, 33/33 suites / 313/313 tests sans régression, lint 0 erreur, export Android réussi, aucun fichier hors périmètre modifié, aucune action git destructive ou d'écriture.

**MOB-E2E : READY.** Aucun blocage technique identifié pour engager le sprint MOB-E2E. Réserve non bloquante à transmettre : la confusion de numérotation SDK (52/56/57 selon la source) devrait être clarifiée dans la documentation du projet (mandat, `AGENTS.md`, mémoire de session) avant qu'un futur sprint ne reparte d'un chiffre erroné — mais cela ne conditionne pas la certification technique de ce sprint, qui repose sur l'état réel du SDK (57) et non sur son étiquette.
