# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Reproduction rouge → verte

## Commande

```
npx jest __tests__/accommodationAvailabilityBlocksRbac.mongo.integration.test.js
```

Fixtures (vrai Mongo) : Tenant A, `ownerA` (Proprietaire, possède Accommodation A), `ownerB` (Proprietaire, ne possède rien lié à A), `adminA` (Admin, tenant A), `staffAuthorized` (Collaborateur, tenant A — dans `isStaff` local), `staffUnauthorized` (Secretaire, tenant A — staff ailleurs dans l'app, hors `isStaff` local), `staffNoTenant` (Collaborateur, aucune adhésion), `client` (Client, aucun lien), `operatorGlobal` (PlatformOperator). Une Accommodation A avec un blocage sentinelle (`reason: 'SENTINEL-INTERNAL-NOTE'`).

## AVANT correctif (rouge)

```
Test Suites: 1 failed, 1 total
Tests:       3 failed, 9 passed, 12 total
```

| Test | Attendu | Reçu (avant fix) |
|---|---|---|
| Client authentifié sans lien avec l'hébergement | 403 | **200** — blocages internes (dates, `reason`, `createdBy`) exposés |
| Proprietaire NON-owner (ownerB) sur Accommodation A | 403 | **200** |
| Staff NON autorisé par rôle (Secretaire) Tenant A sur A | 403 | **200** |

Les 9 autres scénarios (unauthenticated, owner, admin, staff autorisé, staff sans tenant, PlatformOperator global/scoped, mutations CREATE/DELETE déjà protégées) étaient **déjà corrects avant tout correctif** — confirmant que le gap est précisément et uniquement RBAC (rôle/ownership), pas tenant, pas authentification.

## APRÈS correctif (vert)

```
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

Les 3 scénarios rouges renvoient désormais `403`, sans aucune donnée dans la réponse (`res.body.data` absent). Les 9 scénarios déjà corrects restent inchangés — confirmé par la même suite, sans aucune adaptation de leurs assertions.

## Root cause exacte (confirmée par les deux exécutions)

`listBlocks` (`controllers/accommodationReservationController.js`) n'appliquait, avant correctif, aucune vérification au-delà de `authorizedCalendarAccommodation` (qui gère uniquement la frontière **tenant**, HZ-02 — jamais le rôle ni l'ownership). Les trois routes sœurs sur la même ressource (`calendar`, `createBlock`, `deleteBlock`) appliquent toutes `isStaff(4 rôles) || owner===user.id` — `listBlocks` était la seule exception. Après correctif : garde identique ajoutée, réutilisée à l'identique, aucune nouvelle politique.
