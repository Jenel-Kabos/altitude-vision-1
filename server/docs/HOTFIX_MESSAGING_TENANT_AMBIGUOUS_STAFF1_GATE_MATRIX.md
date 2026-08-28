# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Matrice des portes de qualité

| Gate | Commande | Résultat |
|---|---|---|
| Rouge runtime archivé | `npx jest __tests__/messagingTenantAmbiguousStaff.mongo.integration.test.js` (avant fix) | **12/24 échoués** — reproduction confirmée (voir `_RED_REPRODUCTION.md`) |
| Test ciblé HF-FINAL-01 (après fix) | même commande | **24/24 PASS** |
| Messaging non-régression (existants + nouveau) | `npx jest conversationStaffInboxTenant.test.js conversationRoutes.test.js messageSerializer.test.js messageAttachmentMimeFilter.test.js messagingTenantAmbiguousStaff.mongo.integration.test.js` | **5 suites / 54 tests — PASS** |
| Cluster HZ-01→HZ-07 | `npx jest --runInBand` (8 fichiers `*TenantScope*`) | **8 suites / 137 tests — PASS**, identique à l'état pré-hotfix |
| Backend complet | `npm run test:unit` | **141 suites / 1579 tests — PASS**, identique |
| Mongo exhaustif | `npm run test:mongo` | **110 suites / 1151 tests — 100% PASS** (durée ≈25min) — +1 suite/+24 tests par rapport à la dernière baseline connue (109/1127), exactement l'ajout de `messagingTenantAmbiguousStaff.mongo.integration.test.js` (24 tests), aucune régression |
| Architecture | `npm run architecture:check` | **Identique avant/après** — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, 0 nouvelle violation, PASS |
| Lint | `npm run lint` | **0 erreur**, 108 warnings pré-existants, aucun nouveau, aucun sur les fichiers modifiés |
| `git diff --check` | | Propre — 1 avertissement CRLF pré-existant sur `messageRoutes.js` (ligne de fin déjà présente), aucun nouveau |
| Frontend | — | Non modifié |
| Mobile | — | Non modifié |
| Schéma/migration | — | Aucun |
| Production | — | Jamais lue ni mutée — tous les tests utilisent `MongoMemoryReplSet` éphémère |
| Git | — | Aucun commit/push/deploy |

## Verdict des gates

Toutes les portes exigées par le mandat sont vertes. Le rouge a été obtenu, archivé, puis fermé par le correctif le plus étroit possible (câblage de routeur uniquement, aucune ligne de contrôleur/service modifiée).
