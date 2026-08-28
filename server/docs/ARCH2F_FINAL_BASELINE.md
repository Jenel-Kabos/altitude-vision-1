# ARCH-2F — Baseline finale

| Mesure | Avant | Après | Variation |
|---|---:|---:|---:|
| Fichiers analysés | 467 | 468 | +1 service |
| Arêtes internes | 1522 | 1523 | +1 frontière canonique nette |
| service→controller | 4 | 4 | 0 |
| controller→controller | 1 | 1 | 0 |
| route→model | 17 / 13 routes | 13 / 12 routes | -4 / -1 route |
| controller→model | 199 | 199 | 0 |
| Cycles | 0 | 0 | 0 |
| Imports non résolus | 0 | 0 | 0 |
| Imports dangling | 3 | 3 | 0 |
| Baseline stale | 0 | 0 | 0 |
| Nouvelles violations | 0 | 0 | 0 |

`npm run architecture:check` : **PASS**. Les quatre seules entrées retirées de `architecture/baseline.json` sont celles de `dashboardRoutes.js` vers `Event`, `portfolioItemModel`, `Property` et `User`. `runPropertySearch` et les quatre dettes service→controller de reporting restent intactes.

