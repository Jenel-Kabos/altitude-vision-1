# HZ-07 — Matrice des gates

| Gate | Résultat |
|---|---|
| Rouge pré-fix HZ-07 | 13 échecs / 17 après alignement 404 historique |
| HZ-07 final | 17/17 verts |
| HZ-01→HZ-05 + HZ-07 | 6 suites, 107/107 verts |
| Property ciblé | 20 suites, 289/289 verts |
| Backend unitaire complet | 141 suites, 1 579/1 579 verts |
| Mongo exhaustif — passage 1 | 107/108 suites ; 1 110/1 111 tests ; seul timeout Reporting/ERP indépendant |
| Rejeu isolé de ce timeout | 1/1 vert en 27,718 s |
| Mongo exhaustif — passage 2 | 108 suites, 1 111/1 111 verts |
| Checker architecture Jest | 7/7 verts |
| Architecture | PASS ; 472 fichiers, 1 531 edges, 2/1/12, 0 cycle, 0 unresolved, 0 nouvelle violation |
| Lint backend | 0 erreur, 108 avertissements préexistants |
| `git diff --check` final | Vert ; seuls les 3 avertissements CRLF préexistants |

Verdict gates : vert. Le timeout du premier passage est classé flake de charge, prouvé par le rejeu isolé puis le second passage exhaustif.
