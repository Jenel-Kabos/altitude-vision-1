# Findings fermés

| Finding | Protection encore présente | Tests encore présents | Statut |
|---|---|---|---|
| HZ-01 | middleware canonique sur cinq transitions + attribution avant mutation | `accommodationReservationTenantScope.mongo.integration.test.js` | CLOSED_CERTIFIED |
| HZ-02 | middleware canonique sur quatre routes + parent Accommodation tenant-scoped | `accommodationCalendarTenantScope.mongo.integration.test.js` | CLOSED_CERTIFIED |
| HZ-03 | middleware canonique sur GET list ; branches owner/guest conservées | `accommodationReservationListTenantScope.mongo.integration.test.js` | CLOSED_CERTIFIED |
| HZ-04 | middleware canonique sur deux listes + prédicat direct `Accommodation.tenant` | `accommodationAdminListsTenantScope.mongo.integration.test.js` | CLOSED_CERTIFIED |

Revalidation ciblée du 2026-08-26 : 4 suites, 72/72 tests verts. Une première tentative sandboxée a échoué avant les tests (`listen EPERM` sur MongoMemoryServer) ; la relance locale autorisée est entièrement verte. Aucune régression évidente n'est apparue et aucun fichier HZ-01→HZ-04 n'a été modifié pendant ce re-audit.

Aucun autre finding AUDIT1 n'a été indirectement fermé par ces quatre hotfixs.
