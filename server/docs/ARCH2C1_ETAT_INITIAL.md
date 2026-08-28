# ARCH-2C1 — État initial

## Baseline Git

- Branche : `main`.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (`Update Altimmo 40`).
- Worktree déjà non propre : travaux ARCH-2A/ARCH-2B et autres artefacts utilisateur préservés.
- `git diff --check` initial : vert.
- Documents ARCH-1 demandés absents du workspace; les mesures certifiées reprises dans ARCH-2A ont été utilisées sans reconstruire un audit global.

## Mesure du checker avant refactor

| Mesure | Valeur |
|---|---:|
| Fichiers analysés | 462 |
| Arêtes internes | 1 509 |
| service → controller | 6 |
| controller → controller | 18 |
| route → model | 17 sur 13 routes |
| controller → model progressif | 202 |
| cycles connus | 0 |
| imports statiques non résolus | 0 |
| imports pendants progressifs | 3 |
| nouvelles violations | 0 |

`npm run architecture:check` était PASS. La baseline de cycles ARCH-2B était déjà vide.
