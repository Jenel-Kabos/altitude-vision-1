# ARCH-2C1 — Baseline finale

| Mesure | Avant | Après | Variation |
|---|---:|---:|---:|
| Fichiers analysés | 462 | 463 | +1 service canonique |
| Arêtes internes | 1 509 | 1 511 | +2 nettes après remplacement de 9 imports par 10 imports vers le service et extraction des dépendances `http`/`https` hors graphe interne |
| service → controller | 6 | 6 | 0 |
| controller → controller | 18 | 9 | **−9** |
| route → model | 17 / 13 routes | 17 / 13 routes | 0 |
| controller → model progressif | 202 | 202 | 0 |
| cycles | 0 | 0 | 0 |
| baseline stale | 0 | 0 | 0 finale |
| nouvelles violations | 0 | 0 | 0 |

Le checker a d'abord signalé exactement les neuf entrées stale attendues. Seules ces entrées ont été supprimées. La baseline n'a reçu aucune exception nouvelle.
