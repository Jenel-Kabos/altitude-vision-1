# Matrice PlatformOperator finale

| Actor | Scope | Reservation A | Reservation B | Expected |
|---|---|---|---|---|
| PlatformOperator actif | global | mutation 200 | mutation 200 | accès plateforme conservé |
| PlatformOperator actif | Tenant A | mutation 200 | 404, intacte | isolation A |
| PlatformOperator actif | Tenant B | 404, intacte | mutation 200 | isolation B |

Preuve Mongo réelle dédiée dans `accommodationReservationTenantScope.mongo.integration.test.js`. L'identité opérateur est créée par `grantOperator`, pas simulée par un rôle Admin.

