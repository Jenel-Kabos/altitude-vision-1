# ARCH-2D2 — Baseline finale

| Mesure | Avant | Après | Variation |
|---|---:|---:|---:|
| Fichiers analysés | 467 | 467 | 0 |
| Dépendances internes | 1521 | 1522 | +1 import canonique du controller |
| service→controller | 5 | 4 | -1 |
| controller→controller | 1 | 1 | 0 |
| route→model | 17 | 17 | 0 |
| controller→model | 199 | 199 | 0 |
| cycles | 0 | 0 | 0 |
| stale | 0 | 0 | 0 |
| nouvelles violations | 0 | 0 | 0 |
| non résolus / dangling | 0 / 3 | 0 / 3 | 0 |

Seule l'entrée `mobileAccommodationPublicationService → propertyMobileController` a été retirée de la baseline. Les quatre edges reporting et `altimmoSearchController → propertyController.runPropertySearch` restent suivies.
