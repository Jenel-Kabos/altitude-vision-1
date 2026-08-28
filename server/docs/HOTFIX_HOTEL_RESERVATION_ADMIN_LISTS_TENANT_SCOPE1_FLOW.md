# HZ-05 — Flux des deux routes

`server/server.js` monte `hotelReservationRoutes` sur `/api/hotel-reservations`.

Pour `/admin/list` et `/status/pending`, le flux après correction est :

`auth.protect` → `attachTenantContext` → `auth.restrictTo(Admin, GestionnaireImmobilier, Collaborateur)` → `requireTenantScopeForStaffAllowPlatformWide` → contrôleur → requête `HotelReservation` → populate → tri/pagination éventuelle → réponse.

`attachTenantContext` résout la sélection canonique dans `req.platformTenant`. Le guard refuse un staff sans tenant, conserve un PlatformOperator global sans `platformTenant`, et accepte un PlatformOperator explicitement scoped. Aucun service intermédiaire n'est invoqué.

- `/admin/list` → `hotelReservationController.listAdmin` → `countDocuments(query)` et `find(query)` ; populate `hotel` (`name manager`) et `roomCategory` (`name`) ; tri `{createdAt:-1}` ; skip/limit ; enveloppe `{reservations,total,page,limit}`.
- `/status/pending` → `hotelReservationController.pending` → `find({status:'pending', tenant?})` ; mêmes populate ; tri `{createdAt:1}` ; enveloppe `{reservations}`.

Le tenant est un champ direct, canonique et indexé du modèle `HotelReservation`; aucune résolution indirecte par Hotel ni migration n'est nécessaire.
