# ARCH-2G — Inventaire des 13 edges route→model

| # | Route | Model | Endpoint | Operation | R/W | Purpose |
|---:|---|---|---|---|---|---|
| 1 | `contratRoutes.js` | Contrat | tous `/:id` via `router.param` | `findById` | R | existence + tenant |
| 2 | `devisRoutes.js` | Devis | POST `/`, GET `/`, PATCH `/:id` | create/find/findById+save | R/W | workflow devis |
| 3 | `estimationRoutes.js` | Estimation | POST `/`, GET `/` | create/find/updateMany/count | R/W | demande et inbox staff |
| 4 | `gestionDocumentRoutes.js` | Contrat | routes `/:contratId` | `findById` | R | guard tenant légal |
| 5 | `gestionDocumentRoutes.js` | Paiement | routes `/:paiementId` | `findById` | R | guard tenant financier |
| 6 | `locataireRoutes.js` | Locataire | GET/PUT/DELETE `/:id` | `findById` | R | scope tenant |
| 7 | `paiementRoutes.js` | Paiement | tous `/:id` via `router.param` | `findById` | R | scope tenant financier |
| 8 | `platformTenantRoutes.js` | PlatformTenantDomain | PATCH `/domains/:domainId/verify` | `findById` | R | cross-tenant/operator |
| 9 | `proprietaireRoutes.js` | Proprietaire | GET/PUT/DELETE `/:id`, biens/photos imbriqués | `findById` | R | scope tenant |
| 10 | `projetsRoutes.js` | Projet | GET/POST/PUT/DELETE | find/new+save/update/delete | R/W | CRUD legacy non monté |
| 11 | `realisationsRoutes.js` | Realisation | GET/GET id/POST/PUT/DELETE | find/findById/new+save/update/delete | R/W | CRUD legacy non monté |
| 12 | `rentalManagementRoutes.js` | RentalManagement | routes `/:id` via `router.param` | `findById` | R | ownership + tenant |
| 13 | `userBusinessProfileRoutes.js` | User | routes `/:userId` protégées | `findById` | R | cible dans tenant acteur |

Exactement 13 imports/edges. `projetsRoutes.js` référence un modèle absent et ni cette route ni `realisationsRoutes.js` ne sont montées dans `server.js`.
