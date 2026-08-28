# Matrice des gates

| Gate | Résultat |
|---|---|
| Reproduction rouge pré-fix | 11 échecs sécurité sur 15 tests, 4 caractérisations vertes |
| Test Mongo hotfix après fix | 15/15 verts |
| Tests Accommodation ciblés combinés | 3/3 suites, 54/54 tests |
| Backend unitaire complet | 141/141 suites, 1 566/1 566 tests |
| Mongo exhaustif | 103/103 suites, 1 041/1 041 tests ; replica set arrêté |
| Checker architectural | 7/7 |
| Architecture | PASS ; 471 fichiers, 1 530 edges, 2/1/12, cycles 0, unresolved 0, dangling 3, new violations 0 |
| Lint backend | exit 0, 0 erreur, 108 warnings préexistants |
| Lint fichiers ciblés | 0 erreur ; 1 warning préexistant dans le contrôleur |
| `git diff --check` initial et final | exit 0 ; mêmes 3 avertissements CRLF préexistants |
| Frontend/mobile | aucun changement |
| Schéma/migration/production | aucun changement/aucune action |

Les premiers lancements sandbox de Supertest/Mongo ayant échoué avec `EPERM` sont classés `OUTILLAGE`, non résultats applicatifs. Les relances autorisées constituent les gates de référence ci-dessus.
