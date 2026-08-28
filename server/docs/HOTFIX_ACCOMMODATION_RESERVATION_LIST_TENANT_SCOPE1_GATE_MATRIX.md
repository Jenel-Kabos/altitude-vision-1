# Matrice des gates

| Gate | Résultat |
|---|---|
| Reproduction pré-fix | 4 rouges/15 ; HTTP 200 et 4 réservations A+B divulguées par chacun des 4 rôles staff |
| HZ-03 après fix | 15/15 verts |
| Calendar isolé | 15/15 verts |
| Combiné HZ-01/HZ-02/HZ-03 | 54/55, un timeout Calendar ; FLAKE documenté |
| Backend complet | 141/141 suites, 1 566/1 566 tests |
| Mongo exhaustif | 104/104 suites, 1 056/1 056 tests ; replica set arrêté proprement |
| Checker architectural | 7/7 |
| Architecture | PASS ; 471 fichiers, 1 530 edges, 2/1/12, cycles 0, unresolved 0, dangling 3, new violations 0 |
| Lint ciblé | 0 erreur, 0 warning |
| Lint global | 0 erreur, 108 warnings préexistants |
| `git diff --check` | exit 0 ; mêmes trois avertissements CRLF préexistants |
| Frontend/mobile/schéma/migration/production | aucun changement/aucune action |
