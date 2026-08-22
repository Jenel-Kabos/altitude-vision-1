# RBAC-4 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé — aucun commit créé par RBAC-1/2/3/4, tout le travail reste en working tree).

```
git log -5 --oneline
63880f5 Update Altimmo 38
51f581e Update Altimmo 37
88c99d7 Update Altimmo 36
3cd0f1c Update Altimmo 35
f4f6b40 Update Img
```

`git diff --stat` : 16 fichiers modifiés (+419/-42), tous issus de RBAC-2/RBAC-3 — aucun fichier `altimmo-app/` dans ce diff.

`git diff --check` : exit 0.

`git status --short` : 46 lignes au total (16 modifiés + fichiers non suivis : nouveaux tests, tous les documents `server/docs/HOTFIX_*` et `server/docs/RBAC1_*`/`RBAC2_*`/`RBAC3_*` des sprints précédents). Tout préservé, rien écrasé.

## Baseline héritée

- RBAC-1 : AUDIT CERTIFIÉ (lecture seule).
- RBAC-2 : CERTIFIÉ VERT — `server/utils/iamArchitecture.js` canonique, `getEffectiveCapabilities(role)` pure fonction testée, 128/128 suites unit / 974/974 tests Mongo exhaustifs au moment du sprint.
- RBAC-3 : CERTIFIÉ VERT — Web consomme `capabilities` via un unique helper `can(capability)` dans `AuthContext.jsx`, payloads `createSendToken`/`sendGoogleAuthResponse`/`googleGetToken`/`/me` enrichis côté backend, pilote migré (`AdminDashboard.jsx`, `RoleDashboardOverview.jsx`), 3 tests adversariaux prouvant que le backend ignore un rôle/capacités forgé côté client, auto-guérison `/me` sans fallback local documentée.

RBAC-1 (`RBAC1_DUPLICATION_MATRIX.md`) avait déjà noté l'existence d'une copie mobile de `staffCapabilities.js` dans `altimmo-app/`, qualifiée de potentiellement peu/pas consommée — à ré-auditer précisément dans ce sprint (§20 du mandat RBAC-4), pas en confiance aveugle dans le constat RBAC-1.

## Périmètre RBAC-4

Faire consommer par `altimmo-app/` (Expo/React Native) les capacités calculées côté backend, sur le même principe que RBAC-3 côté Web : aucun mapping rôle→capacités recréé côté mobile, un seul helper canonique `can(capability)`, mobile jamais frontière de sécurité, migration pilote plutôt qu'exhaustive, préservation stricte des identités métier externes (Proprietaire/Client/businessProfiles) et des systèmes spécialisés (tenant, HotelStaffAssignment, financier).

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement.
