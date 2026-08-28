# HZ-05 — Matrice des gates

| Gate | Résultat |
|---|---|
| Rouge avant fix | confirmé : 18 exécutés, 11 rouges, 7 verts |
| HZ-05 après fix | 18/18 verts |
| Cluster HZ-01→HZ-05 | 90/90 verts |
| HotelReservation/hôtel ciblé | 8 suites, 165/165 verts |
| Backend unit complet | 141 suites, 1 579/1 579 verts |
| Mongo exhaustif | 106 suites, 1 091/1 091 verts, exit 0 |
| Checker architecture Jest | 7/7 verts |
| Architecture finale | PASS : 472 fichiers, 1 531 edges, dette connue inchangée, 0 cycle/unresolved/nouvelle violation |
| Lint backend | exit 0, 0 erreur, 108 warnings préexistants/hors patch |
| `git diff --check` | exit 0 ; trois warnings CRLF préexistants identiques au baseline |

Les premiers lancements Supertest sans élévation ont rencontré `listen EPERM` avant assertions ; les mêmes commandes dans l'environnement local autorisé sont vertes. Cette limitation sandbox n'est pas une régression applicative.
