# Matrice de non-régression

| Domaine | Preuve | Résultat |
|---|---|---|
| HZ-03 liste ciblée | 15 scénarios Mongo | 15/15 verts |
| HZ-01 mutations confirm/cancel/check-in/check-out/no-show | suite tenant-scope | verte dans le gate combiné |
| HZ-02 Calendar/Blocks | suite isolée | 15/15 verts |
| Gate combiné HZ-01/02/03 | 55 tests | 54 verts, 1 timeout Calendar à 180 s ; classé FLAKE orchestration, suite isolée verte |
| PlatformOperator | global + scoped A/B | vert |
| Ownership/Client | owner + guest | vert |
| Filtres/pagination/sort/populate/empty | scénarios ciblés | vert |
| Read-only | snapshot Mongo avant/après | identique |
| Backend complet | toutes suites non-Mongo | 141/141, 1 566/1 566 |

La relance isolée verte ne masque pas le gate combiné rouge : celui-ci reste explicitement documenté. Le gate Mongo exhaustif officiel est l'autorité finale.
