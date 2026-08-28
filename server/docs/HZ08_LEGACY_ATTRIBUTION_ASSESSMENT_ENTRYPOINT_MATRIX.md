# HZ-08 — Entrypoints et call graph

| Entrypoint LIVE | HTTP | Guard HZ-08 | Model/query | Effet possible |
|---|---|---|---|---|
| `/api/contrats/:id*` | GET/PUT/DELETE/POST | `router.param(id)` | `Contrat.findById` → Property/owner | lecture/mutation bail/paiements |
| `/api/paiements/:id*` | GET/PUT/DELETE/POST | `router.param(id)` | `Paiement.findById` → Contrat | montants, preuve, encaissement |
| `/api/gestion-docs/*/:contratId|:paiementId` | GET/POST | `router.param` | Contrat/Paiement | génération/envoi document/email |
| `/api/rental-management/:id*` | GET/PATCH/POST | `router.param(id)` | `RentalManagement.findById` → Property/owner/manager | occupation/publication/workflow |
| `/api/proprietaires/:id*`, `/api/locataires/:id*` | GET/PUT/DELETE/POST | middleware et contrôleur | Proprietaire/Locataire → Contrats | identité et GL |
| `/api/documents/:id` | GET/PATCH/DELETE | contrôleur | `Document.findById` → relations | document/PII |
| `/api/user-business-profiles/:userId*` | GET/POST | `assertTargetInActorTenant` | `User.findById` → memberships | profil métier |
| `/api/users/:id/contract-document` | GET | contrôleur | User → memberships | document d'identité/contrat |
| `/api/properties/*`, `/api/rental-maintenance/*` | mutations/lectures | contrôleur | Property → owner | modération/maintenance |
| `/api/accommodations/:id*`, `/api/accommodation-reservations/:id*` | mixte | contrôleur | Accommodation/Reservation | réservation/finance/workflow |
| `/api/conversations/:id*`, `/api/messages/:id*` | mixte | contrôleur | Conversation/Message | messages, pièces jointes, notifications |
| CLI audit/régularisation | aucun HTTP | resolver brut + manifest | 37 types du registre | audit/dry-run ; apply seulement avec flags/acteur explicites |

Call graph HTTP générique : `server.js → router monté → protect/tenant/capability/RBAC → param ou controller guard → assertResourceTenantOrUnattributed → resolveResourceTenant → findById/find relations → modèle`. Si le résultat est `unresolved`, le handler continue ; s'il est `ambiguous` ou résolu vers un autre tenant, une 404 est levée.

Autres entrypoints reliés : scripts CLI et notificationService (resolver brut). Aucun cron, worker, queue, webhook ou Socket.IO n'appelle directement la variante tolérante.

