# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Matrice des portes de validation

| Porte | Commande | Résultat AVANT correctif | Résultat APRÈS correctif | Statut |
|---|---|---|---|---|
| Reproduction rouge permanente | `npx jest messageReadAuthority.mongo.integration.test.js` (via `test:mongo`) | 4 failed, 10 passed / 14 | 14 passed / 14 | ✅ PASS |
| Messaging + RBAC-blocks ciblé | Suite combinée (Messaging + `accommodationAvailabilityBlocksRbac`) | — | 7 suites / 80 tests PASS | ✅ PASS |
| Cluster HZ-01→HZ-07 | Suites tenant-scope horizontales | — | 8 suites / 137 tests PASS | ✅ PASS |
| Backend complet (unit) | `npm run test:unit` | 1 échec isolé (`rentalMaintenanceRoutes.test.js`, flake de charge confirmé non lié) | 141 suites / 1579 tests PASS (ré-exécution propre) | ✅ PASS |
| **Mongo exhaustif** | `npm run test:mongo` (depuis `server/`) | — | **112 suites / 1177 tests PASS**, 0 échec, 0 flake observé | ✅ PASS |
| Architecture | `npm run architecture:check` | 472 fichiers / 1531 edges / 0 cycle / PASS (baseline) | 473 fichiers / 1535 edges / `controller→controller` inchangé à 1 / 0 nouvelle violation / PASS | ✅ PASS |
| Lint | `npm run lint` + `npx eslint` ciblé | 108 avertissements pré-existants, 0 erreur | 108 avertissements (inchangé), 0 erreur, 0 nouveau sur les fichiers touchés | ✅ PASS |
| Diff-check | `git status --short` / `git rev-parse HEAD` | HEAD `a04055f6...` | HEAD `a04055f6...` (inchangé), diff limité aux fichiers listés dans `_DIFF_SCOPE.md` | ✅ PASS |

## Détail de la première tentative Mongo (échec d'environnement, non un échec de test)

Une première tentative de lancement du run Mongo exhaustif (tâche `bxmzj8twi`) a échoué avec `exit code 1` et le message `cd: no such file or directory: server` — un problème de répertoire de travail du shell (le shell était déjà positionné dans `server/`, donc `cd server` échouait), identique en nature aux deux incidents similaires rencontrés plus tôt dans cette session pour le mandat RBAC. Ce n'était pas un échec de test. Le run a été relancé (`b3fg2a21g`) depuis le bon répertoire (`pwd` confirmé = `.../altitude-vision-1/server` avant le lancement de `npm run test:mongo`), aboutissant au résultat exhaustif 112/112 — 1177/1177 ci-dessus.

## Conclusion des portes

Toutes les portes obligatoires du mandat sont **vertes**, sans exception, sans échec resté irrésolu, sans flake non vérifié.
