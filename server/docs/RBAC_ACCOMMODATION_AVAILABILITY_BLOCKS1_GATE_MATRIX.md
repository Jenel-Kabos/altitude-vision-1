# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Matrice des portes de qualité

| Gate | Commande | Résultat |
|---|---|---|
| Rouge runtime archivé | `npx jest __tests__/accommodationAvailabilityBlocksRbac.mongo.integration.test.js` (avant fix) | **3/12 échoués** — reproduction confirmée (voir `_RED_REPRODUCTION.md`) |
| Test ciblé RBAC-FINAL-01 (après fix) | même commande | **12/12 PASS** |
| HZ-02 non-régression | `npx jest accommodationCalendarTenantScope.mongo.integration.test.js` | **15/15 PASS**, sans adaptation |
| Accommodation ciblé | 11 fichiers `*accommodation*.mongo.integration.test.js` | **11 suites / 146 tests — PASS** |
| Cluster HZ-01→HZ-07 + HF-FINAL-01 | 9 fichiers `*TenantScope*` + `messagingTenantAmbiguousStaff` | **9 suites / 161 tests — PASS** (137 + 24) |
| Backend complet | `npm run test:unit` | **141 suites / 1579 tests — PASS**, identique |
| Mongo exhaustif | `npm run test:mongo` | 1er passage : 110/111 suites, 1162/1163 tests — 1 échec isolé (`propertyModerationTenantScope.mongo.integration.test.js`, domaine Property, sans rapport avec Accommodation/`listBlocks`), confirmé flaky (17/17 PASS rejoué seul). **2e passage (propre) : 111 suites / 1163 tests — 100% PASS.** |
| Architecture | `npm run architecture:check` | **Identique avant/après** — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, 0 nouvelle violation, PASS |
| Lint | `npm run lint` | **0 erreur**, 108 warnings pré-existants, aucun nouveau, aucun sur le fichier modifié |
| `git diff --check` | | Propre sur les fichiers de ce mandat |
| Frontend | — | Non modifié |
| Mobile | — | Non modifié |
| Schéma/migration | — | Aucun |
| Production | — | Jamais lue ni mutée |
| Git | — | Aucun commit/push/deploy |

## Verdict des gates

Toutes les portes exigées par le mandat sont vertes. Le rouge a été obtenu, archivé, puis fermé par le correctif le plus étroit possible (une seule ligne de vérification ajoutée, réutilisant un guard déjà en production sur la même ressource).
