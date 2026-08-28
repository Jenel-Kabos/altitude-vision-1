# HZ-09 — Matrice des références

Le code de production contient 12 fichiers consommateurs et 15 appels directs. Tous appellent le même service canonique validant les memberships/opérateurs côté serveur.

| Fichier | Symbole / appels | Objet | Appelant | Runtime |
|---|---:|---|---|---|
| `routes/paiementRoutes.js` | `router.param` (1) | garde Paiement | routes `:id` | LIVE |
| `routes/userBusinessProfileRoutes.js` | `assertTargetInActorTenant` (1) | garde User | profil métier | LIVE |
| `routes/contratRoutes.js` | `router.param` (1) | garde Contrat | routes `:id` | LIVE |
| `routes/gestionDocumentRoutes.js` | `guardParam` (1) | garde Contrat/Paiement | génération docs | LIVE |
| `routes/locataireRoutes.js` | `assertLocataireInScope` (1) | garde Locataire | CRUD ciblé | LIVE |
| `routes/proprietaireRoutes.js` | `assertProprietaireInScope` (1) | garde Proprietaire | CRUD/biens | LIVE |
| `controllers/rentalDocumentController.js` | `download` (1) | accès staff document | route download | LIVE |
| `controllers/propertyController.js` | deux helpers (2) | lecture/action staff | Property | LIVE |
| `controllers/accommodationController.js` | `assertAccommodationAccessible` (1) | action staff | Accommodation | LIVE |
| `controllers/organizationController.js` | `actorTenantRootId` (1) | arbre/membership | Organization | LIVE |
| `routes/rentalManagementRoutes.js` | `router.param` (1) | garde dossier GL | routes `:id` | LIVE |
| `controllers/accommodationReservationController.js` | boundary/list/access (3) | lecture, transition, finance | réservations | LIVE |
| `services/platformTenant/tenantContextService.js` | `resolveTenantForUser` | façade canonique | 15 appels ci-dessus | LIVE |
| `middleware/tenantContext.js` | `requestedTenant`, `resolveAndAttachTenantScope` | frontière canonique enrichie | routes tenant-aware | LIVE |

Deux divergences confirmées : `userBusinessProfileRoutes.js` et `assertReservationAccess` ne lisent que `x-platform-tenant-id`; les treize autres appels acceptent aussi `X-Tenant-Id`. Elles provoquent un contexte absent/403 pour certains utilisateurs multi-tenant, pas un tenant choisi sans validation.
