# HZ-04 — État initial

- Date d'audit : 2026-08-26.
- Branche : `main` ; HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree déjà fortement modifié par les hotfixs précédents ; aucune modification existante n'a été supprimée, stashed ou réécrite.
- Diff initial : 53 fichiers, 349 insertions, 424 suppressions.
- `git diff --check` initial : code 0 ; trois avertissements CRLF préexistants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`).
- Architecture initiale : 471 fichiers, 1530 edges ; service→controller 2, controller→controller 1, route→model 12/11 routes, controller→model 192, cycles 0, unresolved 0, dangling 3, nouvelles violations 0, PASS.
- Audit horizontal relu : HZ-04 désigne les listes LIVE `GET /api/accommodations/admin/list` et `GET /api/accommodations/status/pending`.
- Pré-fix, les routes faisaient `protect → restrictTo(ROLES_ALTIMMO) → handler` sans résolution tenant ; les deux requêtes lisaient globalement `Accommodation`.

