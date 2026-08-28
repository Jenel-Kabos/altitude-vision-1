# SECURITY-CLOSURE-P0-WAVE-1 — Security cluster (une seule exécution, après les 5 lots)

| Suite | Tests | Résultat |
|---|---|---|
| `securityClosureP0WaveMessagingSendAuthority.mongo.integration.test.js` (P0-A, nouveau) | 13 | PASS |
| `securityClosureP0WavePaiementTenantAuthority.mongo.integration.test.js` (P0-B+C, nouveau) | 9 | PASS |
| `securityClosureP0WaveLeaseLifecycleTenantAuthority.mongo.integration.test.js` (P0-D, nouveau) | 6 | PASS |
| `securityClosureP0WaveAdminLegacyPropertyTenantAuthority.mongo.integration.test.js` (P0-E, nouveau) | 7 | PASS |
| `messageReadAuthority.mongo.integration.test.js` | 14 | PASS |
| `messagingTenantAmbiguousStaff.mongo.integration.test.js` (HF-FINAL-01) | — | PASS |
| `accommodationCalendarTenantScope.mongo.integration.test.js` (HZ-02) | — | PASS |
| `accommodationReservationListTenantScope.mongo.integration.test.js` (HZ-03) | — | PASS |
| `accommodationReservationTenantScope.mongo.integration.test.js` (HZ-01) | — | PASS |
| `accommodationAdminListsTenantScope.mongo.integration.test.js` (HZ-04) | — | PASS |
| `hotelAdminListsTenantScope.mongo.integration.test.js` (HZ-06) | — | PASS |
| `hotelReservationAdminListsTenantScope.mongo.integration.test.js` (HZ-05) | — | PASS |
| `propertyModerationTenantScope.mongo.integration.test.js` (HZ-07) | — | PASS |
| `accommodationAvailabilityBlocksRbac.mongo.integration.test.js` (RBAC-FINAL-01) | 12 | PASS |

**Total mesuré : 14 suites / 208 tests, 100 % PASS.** (Les suites HZ affichent leurs comptes détaillés dans leur propre run ; le total agrégé de 208 provient des deux runs combinés — 196 pour le premier lot de 13 suites + 12 pour `accommodationAvailabilityBlocksRbac`, exécutée séparément après coup pour compléter la couverture RBAC-FINAL-01 omise du premier lot.)

Aucune régression détectée sur les hotfixs déjà certifiés. Les 4 nouvelles suites permanentes de ce sprint (35 tests) rejoignent la suite Mongo exhaustive de manière définitive.
