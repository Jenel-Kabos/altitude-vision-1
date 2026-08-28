# Matrice des findings

| ID | Endpoint/family | Risk | Actor | Missing boundary | Evidence | Priority |
|---|---|---|---|---|---|---|
| HZ-01 | `POST /api/accommodation-reservations/:id/{confirm,check-in,check-out,no-show}` et cancel staff | mutation workflow + facture/locks cross-tenant | Admin/staff Tenant A | resolver, tenant authorization | `transition()` charge par ID ; `canManage` accepte le rôle seul | P0 |
| HZ-02 | `/api/accommodations/:id/availability-blocks`, reservation-calendar | lecture/mutation calendrier et réservations cross-tenant | tout staff Tenant A ; tout authentifié sur listBlocks | resolver/authorization | `createBlock`, `deleteBlock`, `calendar` acceptent rôle ; `listBlocks` n'a aucun guard | P0 |
| HZ-03 | `GET /api/accommodation-reservations` | réservations globales si staff sans tenant | staff non affilié non-PlatformOperator | fail-closed | absence de tenant laisse `query={}` explicitement | P0 |
| HZ-04 | `GET /api/accommodations/admin/list`, `/status/pending` | hébergements/owners cross-tenant | staff Tenant A | resolver + query predicate | services appelés sans tenant/scope | P0 |
| HZ-05 | `GET /api/hotel-reservations/admin/list`, `/status/pending` | réservations, clients et données de séjour cross-tenant | Admin/staff Tenant A | tenant authorization | attach context existe mais query globale | P0 |
| HZ-06 | `GET /api/hotels/admin/list`, `/portfolio`, `/status/pending` | inventaire hôtel cross-tenant | Admin Tenant A | consumption du tenant résolu | branche `role === Admin` omet `hotelIds` | P0 |
| HZ-07 | `GET /api/properties/status/pending[-count]` et listing staff authentifié | biens non publiés/owners cross-tenant | Admin/staff Tenant A | resolver/query scope | `Property.find` global ; `isAdmin` supprime les filtres publics | P0 |
| HZ-08 | ressources historiques avec `assertResourceTenantOrUnattributed` | ambiguïté de ressources inattribuables | staff tenant | attribution stricte impossible | unresolved est volontairement toléré | P2 |
| HZ-09 | résolution inline de headers dans plusieurs contrôleurs/routes | drift et omission future | transversal | centralisation | multiples appels `resolveTenantForUser` hors middleware | P2 |

Les HZ-01 à HZ-07 sont directement exploitables statiquement par des routes montées et des queries réelles, mais aucune reproduction runtime nouvelle n'a été persistée ou ajoutée : **runtime leak NON CONFIRMÉ** conformément au sprint read-only. Aucun `$lookup`/populate n'est la cause racine de ces findings ; la racine est déjà non scopée avant ces relations.
