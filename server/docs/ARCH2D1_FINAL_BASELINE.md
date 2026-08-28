# ARCH-2D1 — Baseline finale

| Mesure | Avant | Après | Variation |
|---|---:|---:|---:|
| Fichiers analysés | 466 | 467 | +1 service canonique |
| Dépendances internes | 1519 | 1521 | +2 imports vers le propriétaire canonique, suppression de l'import interdit |
| service→controller | 6 | 5 | -1 |
| controller→controller | 1 | 1 | 0 |
| route→model | 17 | 17 | 0 |
| controller→model | 199 | 199 | 0 |
| Cycles | 0 | 0 | 0 |
| Baselines stale | 0 | 0 | 0 |
| Nouvelles violations | 0 | 0 | 0 |
| Imports non résolus | 0 | 0 | 0 |
| Imports dangling | 3 | 3 | 0 |

Seule l'edge `rentalLeaseRenewalService → contratController` a été retirée de `architecture/baseline.json`. Les cinq autres service→controller et la dernière controller→controller Property restent explicitement suivies.
