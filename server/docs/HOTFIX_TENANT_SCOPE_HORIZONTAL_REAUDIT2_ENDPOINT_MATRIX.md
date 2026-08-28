# Matrice des endpoints

Les trois routeurs sont réellement montés par `server.js`. `attachTenantContext` et `attachTenantScopeIfResolvable` résolvent éventuellement un contexte mais ne constituent pas une autorisation.

| Finding | Method | Endpoint | Mounted | Auth | RBAC | Tenant Guard | Ownership | Handler |
|---|---|---|---|---|---|---|---|---|
| HZ-05 | GET | `/api/hotel-reservations/admin/list` | LIVE | protect | ROLES_ALTIMMO | attach non bloquant, ignoré par query | N/A admin list | `hotelReservationController.listAdmin` |
| HZ-05 | GET | `/api/hotel-reservations/status/pending` | LIVE | protect | ROLES_ALTIMMO | attach non bloquant, ignoré par query | N/A moderation | `hotelReservationController.pending` |
| HZ-06 | GET | `/api/hotels/admin/list` | LIVE | protect | ROLES_ALTIMMO | attach-if-resolvable ; branche Admin ignore scope | manager/assignment seulement pour non-Admin | `hotelController.listAdmin` |
| HZ-06 | GET | `/api/hotels/portfolio` | LIVE | protect | aucun restrictTo route | attach-if-resolvable ; branche Admin ignore scope | manager/assignment seulement pour non-Admin | `hotelController.portfolio` |
| HZ-06 | GET | `/api/hotels/status/pending` | LIVE | protect | ROLES_MODERATION | attach-if-resolvable ; branche Admin ignore scope | aucun pour Admin | `hotelController.pending` |
| HZ-07 | GET | `/api/properties/status/pending` | LIVE | protect | Admin | aucun | aucun | `propertyController.getPendingProperties` |
| HZ-07 | GET | `/api/properties/status/pending-count` | LIVE | protect | Admin, Collaborateur | aucun | aucun | `propertyController.getPendingPropertiesCount` |
| HZ-07 | GET | `/api/properties` | LIVE | optionalAuth | public ou staff | aucun ; staff `STAFF_IMMO` passe en vue globale | aucun sur liste | `propertyController.getAllProperties` |

## Nature des accès

Tous ces endpoints sont read-only. Aucun endpoint restant dans AUDIT1 ne mute directement une ressource. HZ-05 expose toutefois identité/contact invité, dates, demandes spéciales, tarif instantané et montants. HZ-07 pending peuple `owner` avec nom, email, téléphone, photo et rôle. HZ-06 expose l'inventaire privé hôtel/property. Aucun endpoint historique listé n'est non monté.
