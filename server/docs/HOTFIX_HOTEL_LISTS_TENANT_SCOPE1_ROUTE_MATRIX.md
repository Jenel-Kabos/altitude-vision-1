# HZ-06 — Matrice des routes Hotel

Toutes les routes sont montées sous `/api/hotels` par `server/server.js`.

| Endpoint | Classe | Auth/RBAC | Handler | Query |
|---|---|---|---|---|
| GET `/admin/list` | A — HZ-06 confirmé | protect, ROLES_ALTIMMO | `listAdmin` | `listHotelsForAdmin` |
| GET `/portfolio` | A — HZ-06 confirmé | protect, contrat existant | `portfolio` | `listValidatedHotelPortfolio` |
| GET `/status/pending` | A — HZ-06 confirmé | protect, ROLES_MODERATION | `pending` | `Hotel.find` |
| GET `/accessible` | B — déjà scope accès | protect | staff assignment controller | scope manager/assignment |
| GET `/public`, `/public/:id` | C — public hors HZ-06 | public | `listPublic/getPublic` | publication publique |
| GET `/mine` | D — owner hors HZ-06 | protect | `mine` | `manager=req.user.id` |
| GET `/portfolio/:id`, `/:id` | B — détail contrôlé, hors HZ-06 | protect | contrôleurs détail | assertHotelAccess |
| PATCH `/:id/:action` et autres mutations | E — auditées, non corrigées | RBAC/capability existants | handlers existants | hors listes HZ-06 |
| GET `/` | E — sélecteur admin non classé HZ-06 par les audits | ROLES_ALTIMMO | `list` | inchangé |

Aucune route HZ-06 DEAD/UNMOUNTED n’a été trouvée.
