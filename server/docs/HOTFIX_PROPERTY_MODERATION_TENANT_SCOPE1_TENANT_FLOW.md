# HZ-07 — Flux tenant

Flux corrigé :

`server.js` → `/api/properties` → auth existante → RBAC existant → `requireTenantScopeForStaffAllowPlatformWide` → `req.platformTenant` → controller → filtre Mongo `tenant`.

- Staff tenant A/B : le middleware résout le tenant canonique et le controller l’injecte dans `find` et `countDocuments`.
- Staff tenant-scoped sans tenant : 403 avant le controller.
- PlatformOperator global : `req.platformTenant` absent par contrat ; la requête reste globale.
- PlatformOperator scoped : le tenant sélectionné est propagé.
- Public, Client et Proprietaire sur `GET /` : le guard n’exige pas de tenant et la branche catalogue public reste globale et filtrée par publication/disponibilité.
- `Property` porte directement `tenant: ObjectId → PlatformTenant` ; aucune relation indirecte ni migration n’est nécessaire.
- Le paramètre HTTP `tenant` est supprimé de la query applicative : seule la frontière serveur peut définir le tenant.
- Approve/reject : le flux existant `findById → assertPropertyTenantAccess → assertResourceTenantOrUnattributed` retourne 404 hors tenant avant toute mutation.
