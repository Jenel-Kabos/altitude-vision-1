# ARCH-2H — Contrat API

| Method/path | Auth | Succès | Erreurs verrouillées | Réponse |
|---|---|---|---|---|
| POST `/api/devis` | public | 201 | 400 requis, 500 interne | corps existant inchangé |
| GET `/api/devis` | `protect` + `ROLES_ESTIMATION` | 200 | 401/403 middleware, 500 interne | `status`, `results`, `data.devis` |
| PATCH `/api/devis/:id` | `protect` + `ROLES_ESTIMATION` | 200 | 401/403, 404, 500 | `status`, `data.devis` |

Méthodes, chemins, status, messages, body, ordre des erreurs et headers Express implicites sont inchangés. Aucune pagination n'existait. Aucun changement frontend/mobile n'est requis.
