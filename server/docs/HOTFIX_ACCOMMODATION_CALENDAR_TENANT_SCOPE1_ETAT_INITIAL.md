# HOTFIX-ACCOMMODATION-CALENDAR-TENANT-SCOPE-1 — État initial

- Branche : `main`.
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
- Worktree : déjà fortement modifié par des travaux antérieurs ; aucun changement existant n'a été écrasé, nettoyé ou stashed.
- `git diff --check` initial : exit 0 ; trois avertissements CRLF préexistants sur `conversationController.js`, `internalMailController.js` et `emailRoutes.js`.
- Architecture : 471 fichiers, 1 529 edges avant l'import du middleware ; service→controller 2, controller→controller 1, route→model 12, cycles 0, unresolved 0, new violations 0, PASS.
- Finding exact : `HZ-02`, routes `/api/accommodations/:id/availability-blocks` et `/api/accommodations/:id/reservation-calendar`, lecture et mutations pilotées par ObjectId sans résolution tenant.
- Cause statique : `Accommodation.findById(id)` puis requêtes enfant par `accommodation`, sans filtre tenant et sans middleware de résolution tenant.
- Périmètre : Mongo de test uniquement ; aucune production.

La reproduction runtime initiale a confirmé le finding : 11 échecs de sécurité sur 15 tests (cross-tenant 200/201/204 au lieu de 404, staff sans tenant 200 au lieu de 403), tandis que 4 cas de caractérisation légitimes étaient déjà verts.
