# ARCH-2I — Inventaire des candidats

| ID | Edge | Import | Endpoints/usages | ARCH-2G | HEAD actuel |
|---|---|---|---|---|---|
| A | `estimationRoutes.js → Estimation.js` | ligne 5 | POST `/` (`create`), GET `/` (`find/populate/sort/skip/limit`, `updateMany`, `countDocuments`) | dette applicative | `LIVE_APPLICATION_DEBT` |
| B | `realisationsRoutes.js → Realisation.js` | ligne 3 | GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id` | dette applicative/design legacy | `DEAD_ROUTE` au runtime, dette de code/lifecycle |
| LEGACY | `projetsRoutes.js → Projet.js` | ligne 3 | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` | `LEGACY_UNKNOWN` | `DEAD_ROUTE` |

Candidate A est montée par `server.js:367,562` sous `/api/estimation` et consommée par le client. B et LEGACY ne sont ni requises ni montées par l'entrypoint. Le modèle `Projet.js` est absent : charger `projetsRoutes.js` échouerait avant même de créer le routeur. `Realisation.js` existe et une collection historique est référencée dans les manifests de reset, mais aucune API active ne monte sa route.

Les trois edges existent statiquement dans la baseline et les imports. Gain théorique individuel : 12→11 ; aucun gain n'est réalisé dans cet audit.
