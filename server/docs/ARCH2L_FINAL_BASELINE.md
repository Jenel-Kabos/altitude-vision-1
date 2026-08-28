# ARCH-2L — Baseline finale

| Métrique | Avant | Après |
|---|---:|---:|
| fichiers analysés | 470 | 471 |
| edges statiques | 1 526 | 1 527 |
| service→controller | 3 | 2 |
| controller→controller | 1 | 1 |
| route→model | 12 | 12 |
| controller→model | 197 | 192 |
| cycles | 0 | 0 |
| stale | 0 | 0 |
| imports non résolus | 0 | 0 |
| nouvelles violations | 0 | 0 |

Seule l'exception `locationReport.js → dashboardAnalyticsController.js` est retirée de `architecture/baseline.json`. Les deux edges restantes sont Accommodation et Hotel vers le même controller. `runPropertySearch` reste intact. Architecture finale attendue et observée : PASS.
