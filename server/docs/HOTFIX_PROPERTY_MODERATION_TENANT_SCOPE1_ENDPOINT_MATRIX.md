# HZ-07 — Matrice des endpoints Property

Tous les endpoints sont montés sous `/api/properties` par `server/server.js`.

| Method | Endpoint | Mounted | Purpose | Auth | RBAC | Tenant Guard | Handler | Model/Service |
|---|---|---:|---|---|---|---|---|---|
| GET | `/` | Oui, LIVE | catalogue public / liste staff | optionalAuth | public ; branche staff existante | guard canonique, exigé seulement pour staff ; PO global permis | `getAllProperties` | Property/APIFeatures |
| GET | `/status/pending` | Oui, LIVE | modération pending | protect | Admin | guard canonique | `getPendingProperties` | Property/moderationClassificationService |
| GET | `/status/pending-count` | Oui, LIVE | badge pending | protect | Admin, Collaborateur | guard canonique | `getPendingPropertiesCount` | Property/moderationClassificationService |
| PATCH | `/admin/:id/:action` | Oui, LIVE | validate/reject | protect | Admin | contrôle ressource existant | `updatePropertyStatus` | Property/tenantResourceAttributionService |
| GET | `/my-properties` | Oui, LIVE | portefeuille owner | protect | contrat owner existant | inchangé | handler existant | Property |
| GET | `/latest`, `/recommended`, `/:id` | Oui, LIVE | catalogue public | selon route | contrat existant | inchangé | handlers existants | Property |
| POST/PUT/DELETE | routes de création/édition/suppression | Oui, LIVE | gestion Property | contrat existant | contrat existant | inchangé | handlers existants | Property |

Aucun alias DEAD_ROUTE/LEGACY HZ-07 n’a été trouvé. Publication, recommandation et transaction ne sont pas dans la surface vulnérable démontrée.
