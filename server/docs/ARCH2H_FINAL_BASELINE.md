# ARCH-2H — Baseline finale

| Métrique | Avant | Après |
|---|---:|---:|
| Fichiers analysés | 468 | 469 |
| Edges statiques | 1 523 | 1 524 |
| service→controller | 4 | 4 |
| controller→controller | 1 | 1 |
| route→model | 13 | 12 |
| routes route→model | 12 | 11 |
| controller→model | 199 | 199 |
| cycles | 0 | 0 |
| stale baseline | 0 | 0 |
| new violations | 0 | 0 |

`architecture:check` final : PASS. Seule l'entrée `routes/devisRoutes.js → models/Devis.js` a été retirée de `architecture/baseline.json`. Les 9 KEEP, les 2 autres dettes applicatives, l'edge legacy et `runPropertySearch` sont intacts.
