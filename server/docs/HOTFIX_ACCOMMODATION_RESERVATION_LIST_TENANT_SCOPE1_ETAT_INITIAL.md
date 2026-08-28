# HZ-03 — État initial

- Branche `main`, HEAD `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree fortement dirty avec les travaux antérieurs HZ-01/HZ-02 et d'autres sprints ; aucun nettoyage, stash ou écrasement.
- `git diff --check` initial : exit 0, trois avertissements CRLF préexistants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`).
- Architecture initiale : PASS ; 471 fichiers, 1 530 edges, service→controller 2, controller→controller 1, route→model 12, cycles 0, unresolved 0, dangling 3, new violations 0.
- Finding horizontal exact : `HZ-03`, `GET /api/accommodation-reservations`, staff non affilié non-PlatformOperator, absence de tenant laissant explicitement `query={}` et divulguant la liste globale.
- Production non utilisée.

Le premier lancement Mongo sandbox a échoué sur `listen EPERM` et est classé OUTILLAGE. La reproduction valide autorisée a donné 4 tests rouges et 11 verts : chaque rôle staff sans tenant recevait HTTP 200, `total=4`, avec A1/A2 et B1/B2.
