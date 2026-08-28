# ARCH-2F — Matrice de refactor

| Route | Model | Query | New owner | Edge removed |
|---|---|---|---|---|
| `dashboardRoutes.js` | `Property` | `countDocuments()` | `dashboardKpiQueryService.getDashboardKpis` | Oui |
| `dashboardRoutes.js` | `Event` | `countDocuments()` | `dashboardKpiQueryService.getDashboardKpis` | Oui |
| `dashboardRoutes.js` | `User` | `countDocuments()` | `dashboardKpiQueryService.getDashboardKpis` | Oui |
| `dashboardRoutes.js` | `PortfolioItem` | `countDocuments({ isPublished: true })` | `dashboardKpiQueryService.getDashboardKpis` | Oui |

La route appelle une seule abstraction ciblée. Les requêtes ont été déplacées, pas copiées : une recherche statique ne trouve plus les quatre modèles dans `dashboardRoutes.js`. Le service n'accepte aucun paramètre Express et n'effectue aucune mutation.

