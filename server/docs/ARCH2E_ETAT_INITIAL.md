# ARCH-2E — État initial

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`
- Worktree : non propre ; sprints ARCH précédents et changements inbox/client hors scope présents, tous préservés.
- `git diff --check` : exit 0 ; avertissements CRLF préexistants sur trois fichiers hors scope.

| Mesure | Valeur |
|---|---:|
| Fichiers analysés | 467 |
| Arêtes internes | 1522 |
| service→controller | 4 |
| controller→controller | 1 |
| route→model | 17 sur 13 routes |
| controller→model | 199 |
| cycles / stale / nouvelles violations | 0 / 0 / 0 |
| imports non résolus / dangling | 0 / 3 |

ARCH-2A à ARCH-2D2 sont pris comme historique certifié. ARCH-2E ne modifie ni production, ni baseline, ni tests.
