# ARCH-2C2 — État initial

## Git et documentation

- Branche : `main`.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree déjà non propre : résultats ARCH-2A, 2B, 2C1 et artefacts utilisateur préservés.
- `git diff --check` initial : vert.
- `ARCH1_REPORT.md` absent du workspace; les mesures certifiées reprises par ARCH-2A/2C1 ont été utilisées.

## Architecture post-ARCH-2C1

| Mesure | Valeur |
|---|---:|
| Fichiers | 463 |
| Arêtes internes | 1 511 |
| service→controller | 6 |
| controller→controller | 9 |
| route→model | 17 sur 13 routes |
| controller→model progressif | 202 |
| cycles | 0 |
| baseline stale | 0 |
| nouvelles violations | 0 |

Les neuf arêtes controller→controller restantes étaient : quatre consommateurs de `propertyController`, trois consommateurs de `userController`, `altimmoSearchController → propertyController` et `conversationController → messageController`.
