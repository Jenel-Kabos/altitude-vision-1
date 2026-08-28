# ARCH-2H — Matrice des usages

| Endpoint | Model call avant | Input | Résultat/décision route | Side effects |
|---|---|---|---|---|
| POST `/api/devis` | `create` | 9 champs du body validé | 400 si requis absent ; sinon 201 ; erreur DB 500 | DB, puis notification et email best-effort |
| GET `/api/devis` | `find/populate/sort` | aucun | enveloppe `status/results/data` ; erreur 500 | lecture DB |
| PATCH `/api/devis/:id` | `findById/save/populate` | id, champs optionnels, user id | 404 si absent ; sinon 200 ; erreur 500 | mutation DB |

Nombre d'usages applicatifs : 3. Les décisions HTTP et les middlewares demeurent propriétaires de la route.
