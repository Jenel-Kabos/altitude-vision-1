# ARCH-2F — Matrice des requêtes KPI

| Endpoint | Model/service | Query | Filter | Output field | Read-only |
|---|---|---|---|---|---|
| `GET /api/dashboard/stats` | `Property` | `countDocuments()` | Aucun | `Altimmo` | Oui |
| `GET /api/dashboard/stats` | `Event` | `countDocuments()` | Aucun | `MilaEvents` | Oui |
| `GET /api/dashboard/stats` | `User` | `countDocuments()` | Aucun | `Users` | Oui |
| `GET /api/dashboard/stats` | `userKpiService` | `getUserKpiSummary()` puis `.proprietaires` | Règles préexistantes du service canonique | `Owners` | Oui |
| `GET /api/dashboard/stats` | `PortfolioItem` | `countDocuments(...)` | `{ isPublished: true }` | `Altcom` | Oui |

Il n'existe ni `find`, ni projection, ni sort, ni pipeline d'agrégation dans la route ciblée. Aucune date ou période n'est appliquée. Les cinq opérations restent dans le même `Promise.all` et dans le même ordre. La requête `Property` reste globale : aucun filtre vente/location, publication, modération, type `Parcelle` ou tenant n'a été ajouté.

