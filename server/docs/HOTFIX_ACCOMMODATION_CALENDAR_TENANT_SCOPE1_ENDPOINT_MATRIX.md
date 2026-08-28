# Matrice des endpoints

Toutes les routes ci-dessous sont montées sous `/api/accommodations` par `server.js`. Aucun alias mort ou historique n'a été trouvé.

| Method | Endpoint | Auth | RBAC | Tenant resolution | Handler | Models | Read/Write |
|---|---|---|---|---|---|---|---|
| GET | `/:id/availability` | Public | Public | N/A, contrat public | route inline | Accommodation, Reservation, AccommodationAvailabilityBlock | Read |
| GET | `/:id/availability-blocks` | JWT | Tout utilisateur authentifié | middleware canonique pour staff ; parent `_id + tenant` ; ownership inchangé | `listBlocks` | Accommodation, AccommodationAvailabilityBlock | Read |
| GET | `/:id/reservation-calendar` | JWT | Admin, Collaborateur, GestionnaireImmobilier, CommunityManager ou propriétaire | idem | `getReservationCalendar` | Accommodation, AccommodationReservation, AccommodationAvailabilityBlock | Read |
| POST | `/:id/availability-blocks` | JWT | mêmes staff ou propriétaire | idem | `createBlock` | Accommodation, AccommodationAvailabilityBlock, AccommodationNightLock | Write |
| DELETE | `/:id/availability-blocks/:blockId` | JWT | mêmes staff ou propriétaire | idem | `deleteBlock` | Accommodation, AccommodationAvailabilityBlock, AccommodationNightLock | Write |

Statut des cinq routes : `LIVE`. Route d'update : inexistante (`NON APPLICABLE`). `DEAD_ROUTE` : aucune. `LEGACY` : aucune. `UNKNOWN` : aucune.
