# Findings encore ouverts

## HZ-05 — HotelReservation admin lists — P0

Chemin : `server.js` → `/api/hotel-reservations` → protect → `attachTenantContext` → ROLES_ALTIMMO → `listAdmin`/`pending` → `HotelReservation.countDocuments/find`.

- `listAdmin` part de `query={}` ; hotelId/status/search sont client-supplied mais aucun tenant n'est ajouté.
- `pending` exécute `find({status:'pending'})`.
- `HotelReservation.tenant` existe directement mais n'est pas consommé.
- `attachTenantContext` ne bloque pas et les handlers ignorent `req.platformTenant`.
- Un Admin tenant A atteint statiquement les lignes B par simple GET ; total et populate sont également globaux.
- PII : prénom, nom, email, téléphone, pays, dates, demandes spéciales ; données tarifaires et montant total.
- Read-only, sans side effect direct. Exploitabilité : PROVEN_STATIC ; runtime cross-tenant dédié : NEEDS_RUNTIME_CONFIRMATION.

## HZ-06 — Hotel admin lists — P0

Chemin : `server.js` → `/api/hotels` → protect + attach-if-resolvable → routes → contrôleur → services Hotel.

- Pour `role === 'Admin'`, `hotelIds` reste `undefined` sur admin/list et portfolio ; le service conserve `query={}` ou seulement les invariants de publication.
- pending ajoute des IDs accessibles uniquement si le rôle n'est pas Admin.
- Le contexte tenant peut être correctement attaché mais est ignoré par la branche Admin.
- Admin tenant A → inventaire B est PROVEN_STATIC. Runtime dédié : NEEDS_RUNTIME_CONFIRMATION.
- Données moins sensibles que HZ-05 ; aucune mutation dans le finding.

## HZ-07 — Property moderation/list — P0

Chemin : `server.js` → `/api/properties` → routes pending/count ou optional-auth root → contrôleur → `Property.find/countDocuments`.

- pending et pending-count n'ont aucun tenant middleware et les requêtes ne contiennent pas `tenant`.
- pending peuple l'owner avec nom, email, téléphone, photo et rôle.
- root listing traite tout `STAFF_IMMO` comme `isAdmin`, supprime les filtres publics et utilise `baseFilter={}` sans tenant.
- Admin/staff tenant A → données B est PROVEN_STATIC. Runtime dédié : NEEDS_RUNTIME_CONFIRMATION.
- Read-only ; pas d'effet financier direct.

## HZ-08 — attribution legacy tolérante — P2

Le helper `assertResourceTenantOrUnattributed` est toujours vivant et largement utilisé. Il refuse une attribution prouvée à un autre tenant, mais tolère volontairement une ressource historique impossible à attribuer. Risque dépendant des données, pas une route unique ni un nouvel exploit statique universel. Une régularisation/migration dédiée reste nécessaire ; ne pas la mélanger au P0 suivant.

## HZ-09 — résolution inline — P2

Les appels directs à `resolveTenantForUser` subsistent dans plusieurs contrôleurs/routes. C'est un risque de drift et d'omission future, non une vulnérabilité unique démontrée. Adoption progressive de la primitive canonique après fermeture des P0.

## Finding RBAC distinct

La largeur historique de `GET /api/accommodations/:id/availability-blocks` reste un RBAC FINDING séparé. HZ-02 a fermé le cross-tenant mais n'a volontairement pas changé les rôles autorisés. Aucun nouveau finding distinct n'a été découvert dans ce re-audit.
