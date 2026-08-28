# HOTFIX-TENANT-SCOPE-HORIZONTAL-AUDIT-1 — État initial

Audit read-only démarré le 2026-08-25 sur `main`, HEAD `a04055f62952c782b92aeef2f100824a17a5f645`.

Le worktree était déjà fortement dirty : 48 fichiers suivis modifiés, de nombreux fichiers non suivis issus des travaux précédents, ainsi qu'un APK local. Aucun de ces éléments n'a été modifié ou supprimé par cet audit. `git diff --check` était vert avec trois avertissements CRLF préexistants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`).

## Architecture initiale

| Mesure | Valeur |
|---|---:|
| Fichiers | 471 |
| Edges statiques | 1528 |
| service→controller | 2 |
| controller→controller | 1 |
| route→model | 12 dans 11 routes |
| controller→model | 192 |
| cycles | 0 |
| imports unresolved | 0 |
| dangling connus | 3 |
| nouvelles violations | 0 |

`npm run architecture:check` : PASS. La baseline et le code de production sont hors périmètre et restent inchangés.

Le backend expose 681 déclarations de routes. L'audit approfondi a couvert 17 familles montées et 276 déclarations dans les 19 routeurs sensibles principaux, puis a utilisé le grep exhaustif sur routes, contrôleurs, services, middlewares, modèles et utilitaires pour détecter les consommateurs transversaux.
