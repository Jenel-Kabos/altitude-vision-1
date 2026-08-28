NEXT PRIORITY:
HOTFIX-HOTEL-RESERVATION-ADMIN-LISTS-TENANT-SCOPE-1

Finding:
HZ-05

Domain:
HotelReservation

Surface:
`GET /api/hotel-reservations/admin/list` → `hotelReservationController.listAdmin`; `GET /api/hotel-reservations/status/pending` → `hotelReservationController.pending`.

Severity:
P0

Why:
Les deux routes sont montées, authentifiées et autorisées à ROLES_ALTIMMO, mais `attachTenantContext` est seulement non bloquant. `listAdmin` construit `query={}` et `pending` exécute `{status:'pending'}` ; aucune des deux requêtes ne consomme `HotelReservation.tenant` ni les hôtels autorisés. Admin tenant A peut donc statiquement lire B par simple GET, avec total/populates globaux, PII invité, dates de séjour, demandes spéciales, snapshot tarifaire et montants. HZ-01→HZ-04 n'ont pas touché cette frontière.

Expected security invariant:
Admin/staff tenant A ne lit que les réservations hôtelières attribuées à A ; staff sans tenant échoue fermé ; PlatformOperator global/scoped suit un contrat explicitement caractérisé ; total, filtres, pagination et populate portent exactement le même scope ; aucun changement d'ownership Client/Proprietaire ni des workflows Hotel.

Expected scope:
Caractérisation runtime Mongo Tenant A/B des deux routes, middleware tenant/Hotel existant approprié, handlers et requêtes HotelReservation strictement nécessaires, tests ciblés puis gates complets. Aucun nouveau modèle ou primitive si les primitives existantes suffisent.

DO NOT TOUCH:
HZ-01→HZ-04, lifecycle HotelReservation, check-in/out, cancellation, finance, inventaire, RBAC produit, Property HZ-07, Hotel HZ-06, frontend, mobile, schémas, migrations, données de production et cleanup architectural.
