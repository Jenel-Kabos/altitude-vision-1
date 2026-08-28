# ARCH-2F — Matrice Route → Model

| Route file | Model | Symbol usage | Endpoint | Responsibility |
|---|---|---|---|---|
| `routes/dashboardRoutes.js` | `models/Property.js` | `Property.countDocuments()` | `GET /stats` | Compter toutes les propriétés |
| `routes/dashboardRoutes.js` | `models/Event.js` | `Event.countDocuments()` | `GET /stats` | Compter tous les événements |
| `routes/dashboardRoutes.js` | `models/User.js` | `User.countDocuments()` | `GET /stats` | Compter tous les utilisateurs |
| `routes/dashboardRoutes.js` | `models/portfolioItemModel.js` | `PortfolioItem.countDocuments({ isPublished: true })` | `GET /stats` | Compter le portfolio publié |

Ces quatre arêtes exactes ont été observées sur le HEAD courant puis supprimées de la route. Elles ont été transférées vers `services/dashboardKpiQueryService.js`, sans nouvelle arête route→model.

