# ARCH-2H — Matrice de refactor

| Route | Model | Usage | New owner | Edge removed |
|---|---|---|---|---|
| POST `/api/devis` | Devis | create | `devisApplicationService.createDevis` | Oui |
| GET `/api/devis` | Devis | find/populate/sort | `devisApplicationService.listDevis` | Oui |
| PATCH `/api/devis/:id` | Devis | find/mutate/save/populate | `devisApplicationService.updateDevis` | Oui |

Le service est étroit, ne reçoit ni `req`, ni `res`, ni `next`, et possède l'unique accès Devis. Email, notification, validation, HTTP et sécurité restent dans la route.
