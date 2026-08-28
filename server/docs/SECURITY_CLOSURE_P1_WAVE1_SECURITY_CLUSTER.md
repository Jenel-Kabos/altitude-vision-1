# SECURITY-CLOSURE-P1-WAVE-1 — Security cluster (une seule exécution, après les 10 lots)

| Suite | Résultat |
|---|---|
| `securityClosureP1WaveContratListTenantAuthority.mongo.integration.test.js` (P1-A) | PASS |
| `securityClosureP1WaveLocataireProprietaireListTenantAuthority.mongo.integration.test.js` (P1-J) | PASS |
| `securityClosureP1WaveVisiteTenantAuthority.mongo.integration.test.js` (P1-B) | PASS |
| `securityClosureP1WaveLitigeSignalementTenantAuthority.mongo.integration.test.js` (P1-C) | PASS |
| `securityClosureP1WaveRealEstateApplicationTenantAuthority.mongo.integration.test.js` (P1-D) | PASS |
| `securityClosureP1WaveAccommodationUpdateFullTenantAuthority.mongo.integration.test.js` (P1-E) | PASS |
| `securityClosureP1WaveSaleRentalPropertyUpdateFullTenantAuthority.mongo.integration.test.js` (P1-F) | PASS |
| `securityClosureP1WavePropertyAssetTransitionAuthority.mongo.integration.test.js` (P1-G) | PASS |
| `securityClosureP1WaveHotelStaffAssignmentAuthority.mongo.integration.test.js` (P1-H) | PASS |
| `securityClosureP1WaveTransactionTenantAuthority.mongo.integration.test.js` (P1-I) | PASS |
| `securityClosureP0WaveMessagingSendAuthority.mongo.integration.test.js` (P0-A) | PASS |
| `securityClosureP0WavePaiementTenantAuthority.mongo.integration.test.js` (P0-B+C) | PASS |
| `securityClosureP0WaveLeaseLifecycleTenantAuthority.mongo.integration.test.js` (P0-D) | PASS |
| `securityClosureP0WaveAdminLegacyPropertyTenantAuthority.mongo.integration.test.js` (P0-E) | PASS |
| `messageReadAuthority.mongo.integration.test.js` (hotfix précédent) | PASS |
| `messagingTenantAmbiguousStaff.mongo.integration.test.js` (HF-FINAL-01) | PASS |
| `accommodationAvailabilityBlocksRbac.mongo.integration.test.js` (RBAC-FINAL-01) | PASS |
| `transactionCancellationReleasesReservation.mongo.integration.test.js` (IM-1R, préexistant) | PASS |

**Total : 18 suites / 138 tests, 100 % PASS** (exécuté avec `--runInBand` — une première tentative sans cette option a montré 7 suites en échec par contention de ressources, chaque suite démarrant son propre `MongoMemoryReplSet` en parallèle ; confirmé comme un artefact d'infrastructure, pas une régression, par cette ré-exécution séquentielle propre).

## Régression réelle trouvée et corrigée en cours de route

La première version du correctif P1-I appliquait `requireTenantScopeForStaffOrPlatformOperator` (fail-closed) au niveau ROUTE sur les endpoints `:id` (`getTransaction`/`finalizeTransaction`/`cancelTransaction`/`updateNotes`), ce qui cassait `transactionCancellationReleasesReservation.mongo.integration.test.js` (staff sans aucun tenant agissant sur une Transaction dont la Property est elle-même non attribuée — même leçon que P0-C/`encaisserMultiple`). Corrigé en retirant ce garde de route pour les endpoints `:id` et en résolvant le tenant EN LIGNE dans le contrôleur (`resolveTenantForUser`, tolérant), gardant le fail-closed uniquement sur les listes (`/`, `/stats`) où il est correct. Re-vérifié : 18/18 suites, 138/138 tests.

Aucune régression détectée sur les 5 P0 déjà certifiés ni sur les hotfixs antérieurs (HF-FINAL-01, RBAC-FINAL-01).
