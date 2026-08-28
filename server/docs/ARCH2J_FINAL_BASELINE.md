# ARCH-2J — Baseline finale

| Métrique | Avant | Après |
|---|---:|---:|
| fichiers analysés | 469 | 470 |
| edges statiques | 1 524 | 1 526 |
| service→controller | 4 | 3 |
| controller→controller | 1 | 1 |
| route→model | 12 | 12 |
| controller→model | 199 | 197 |
| cycles | 0 | 0 |
| stale | 0 | 0 |
| new violations | 0 | 0 |

Seule l'entrée `immobilierReport.js → dashboardAnalyticsController.js` a été retirée de la baseline. Architecture finale : PASS.
