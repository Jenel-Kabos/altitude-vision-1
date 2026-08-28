# HZ-07 — État initial

- Branche : `main`.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree : sale avant le sprint (59 fichiers suivis modifiés au relevé, 716 insertions, 444 suppressions, plus des fichiers non suivis). Aucun nettoyage, stash ou reset.
- `git diff --check` initial : code 0 ; trois avertissements CRLF préexistants dans `conversationController.js`, `internalMailController.js` et `emailRoutes.js`.
- Architecture initiale : PASS ; 472 fichiers, 1 531 edges, service→controller 2, controller→controller 1, route→model 12, cycles 0, unresolved 0, new violations 0.
- Réaudit lu : REPORT, DECISION, OPEN_FINDINGS et PRIORITY_MATRIX de `HOTFIX_TENANT_SCOPE_HORIZONTAL_REAUDIT2`.
- Finding confirmé : trois lectures Property LIVE (`GET /`, `GET /status/pending`, `GET /status/pending-count`) étaient globales pour un staff tenant-scoped. Approve/reject étaient déjà protégés.

Les modifications préexistantes restent la propriété de l’utilisateur et sont hors périmètre HZ-07.
