# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — État initial

- Date : 2026-08-25.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ; branche `main`.
- Worktree : fortement dirty avant intervention, modifications antérieures conservées sans stash/reset/checkout. Le statut initial complet a été capturé ; il incluait 51 fichiers suivis modifiés, de nombreux fichiers non suivis des sprints précédents, ainsi que l'APK mobile non suivi.
- `git diff --check` initial : uniquement trois warnings CRLF préexistants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`).
- Architecture initiale : 471 fichiers, 1529 edges, service→controller 2, controller→controller 1, route→model 12/11 routes, controller→model 192, cycles 0, unresolved 0, dangling 3, violations nouvelles 0, PASS.
- Gate Mongo précédent : 101/102 suites, 1023/1026 tests ; trois `E11000` dans `rentalReportQueryBoundary.mongo.integration.test.js`. Rerun isolé précédent : 6/6.
- Fichiers AccommodationReservation de production déjà modifiés avant ce micro-hotfix : `middleware/tenantContext.js`, `routes/accommodationReservationRoutes.js`, `controllers/accommodationReservationController.js`, `services/accommodationReservationService.js`. Ils ne sont pas modifiés ici.

Le premier rerun isolé sous sandbox a échoué par `listen EPERM 0.0.0.0`; ce n'était pas un résultat test. Le rerun autorisé sur Replica Set local a confirmé 6/6.
