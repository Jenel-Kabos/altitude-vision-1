# HZ-07 — Matrice sécurité

| Acteur/cible | Liste | Pending/count | Approve/reject |
|---|---|---|---|
| Admin A → A | autorisé | autorisé | historique préservé |
| Admin A → B | exclu | exclu | 404, déjà sûr |
| Admin B → B | autorisé | autorisé | historique préservé |
| Admin B → A | exclu | exclu | 404, déjà sûr |
| Staff tenant-scoped sans tenant | 403 | 403 sur endpoint RBAC-accessible | 403/contrat route |
| PlatformOperator global | global | global | contrat global préservé |
| PlatformOperator scoped A | A seulement | A seulement | A seulement |
| PlatformOperator scoped B | B seulement | B seulement | B seulement |
| Client/Proprietaire | catalogue public | refus RBAC | refus RBAC |

Les tests couvrent également les tentatives `?tenant=B` et `?owner=B`, les données privées/PII, les totaux, la pagination, le tri et les variantes vente/location/Parcelle.
