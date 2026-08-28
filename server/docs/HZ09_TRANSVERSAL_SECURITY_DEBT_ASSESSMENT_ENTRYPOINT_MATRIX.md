# HZ-09 — Matrice des entrypoints

| Surface montée | Méthodes / URL finales | Auth/RBAC | Chaîne effective |
|---|---|---|---|
| Paiements | `/api/paiements/:id*` GET/PUT/POST/DELETE | JWT + capabilities/Admin | param → resolver → attribution → controller → Paiement/finance |
| Profils métier | `/api/user-business-profiles/:userId*` GET/POST | JWT + self/staff/Admin | route guard → resolver → User → attribution → controller/service |
| Contrats | `/api/contrats/:id*` GET/PUT/DELETE + paiements | JWT + capabilities/Admin | param → resolver → attribution → controller → Contrat/Paiement |
| Documents GL | `/api/gestion-docs/*/:contratId|:paiementId` | JWT + document capabilities | param → resolver → attribution → génération/envoi |
| Locataires | `/api/locataires/:id` GET/PUT/DELETE | JWT + STAFF_IMMO/Secretaire | route guard → resolver → attribution → CRUD |
| Propriétaires | `/api/proprietaires/:id*` GET/PUT/DELETE/biens | JWT + STAFF_IMMO/Secretaire | route guard → resolver → attribution → CRUD/uploads |
| Documents locatifs | `GET /api/rental-documents/:documentId/download` | JWT ; ownership ou ROLES_DOCS | controller → Contrat → resolver pour staff → attribution → stockage |
| Properties | routes `/api/properties/:id*` protégées selon action | JWT + rôle/ownership | controller helper → resolver → attribution → query/mutation |
| Accommodations | routes privées `/api/accommodations/:id*` | JWT + rôle/ownership | controller helper → resolver → attribution → query/mutation |
| Organisation | `/api/organization/units*`, `/memberships*` | JWT + staff/Admin | controller → resolver → racine → service → OrgUnit/Membership |
| Gestion locative | `/api/rental-management/:id*` | JWT + tenant middleware + capabilities/ownership | canonical middleware → param → resolver redondant → attribution → controller |
| Réservations hébergement | `/api/accommodation-reservations/*` | JWT + rôle/ownership ; middleware sur list/transitions | middleware selon route → controller → resolver → attribution/query/finance |

Tous les routeurs sont définis, exportés, importés et montés dans `server.js`. Aucun cron, worker, queue, Socket.IO, webhook ou script n'appelle directement ce symbole en production.
