# SECURITY-FINAL-CLOSURE-AUDIT-1 — Matrice de certification des correctifs connus

| Finding | Surface | Test permanent | Résultat re-exécuté | Régression |
|---|---|---|---|---|
| HZ-01 | AccommodationReservation mutations tenant scope | `accommodationReservationTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-02 | Accommodation Calendar/Blocks tenant scope | `accommodationCalendarTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-03 | AccommodationReservation admin list tenant scope | `accommodationReservationListTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-04 | Accommodation admin/pending lists tenant scope | `accommodationAdminListsTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-05 | HotelReservation admin/pending lists tenant scope | `hotelReservationAdminListsTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-06 | Hotel admin/portfolio/pending lists tenant scope | `hotelAdminListsTenantScope.mongo.integration.test.js` | PASS | Non |
| HZ-07 | Property moderation tenant scope | `propertyModerationTenantScope.mongo.integration.test.js` | PASS | Non |
| HF-FINAL-01 | Messaging staff tenant ambigu | `messagingTenantAmbiguousStaff.mongo.integration.test.js` | PASS | Non |
| RBAC-FINAL-01 | Accommodation availability-blocks RBAC/ownership | `accommodationAvailabilityBlocksRbac.mongo.integration.test.js` | PASS | Non |
| Message Read Authority | `GET /api/messages/:conversationId` | `messageReadAuthority.mongo.integration.test.js` | PASS | Non |
| P0-A | Messaging send authority | `securityClosureP0WaveMessagingSendAuthority...test.js` | PASS | Non |
| P0-B/C | Rental payment global reads / bulk collection | `securityClosureP0WavePaiementTenantAuthority...test.js` | PASS | Non |
| P0-D | Rental lease lifecycle | `securityClosureP0WaveLeaseLifecycleTenantAuthority...test.js` | PASS | Non |
| P0-E | Legacy admin Property | `securityClosureP0WaveAdminLegacyPropertyTenantAuthority...test.js` | PASS | Non |
| P1-A (RA-04) | Contrat list | `securityClosureP1WaveContratListTenantAuthority...test.js` | PASS | Non |
| P1-B (RA-06) | Visite | `securityClosureP1WaveVisiteTenantAuthority...test.js` | PASS | Non |
| P1-C (RA-07) | Litige/Signalement | `securityClosureP1WaveLitigeSignalementTenantAuthority...test.js` | PASS | Non |
| P1-D (RA-08) | RealEstateApplication (Application) | `securityClosureP1WaveRealEstateApplicationTenantAuthority...test.js` | PASS | Non |
| P1-E (RA-10) | Accommodation updateFull | `securityClosureP1WaveAccommodationUpdateFullTenantAuthority...test.js` | PASS | Non |
| P1-F (RA-11) | Sale/Rental Property updateFull | `securityClosureP1WaveSaleRentalPropertyUpdateFullTenantAuthority...test.js` | PASS | Non |
| P1-G (RA-12) | PropertyAsset transition | `securityClosureP1WavePropertyAssetTransitionAuthority...test.js` | PASS | Non |
| P1-H (RA-13) | HotelStaffAssignment | `securityClosureP1WaveHotelStaffAssignmentAuthority...test.js` | PASS | Non |
| P1-I (RA-14) | Transaction/PaiementTransaction | `securityClosureP1WaveTransactionTenantAuthority...test.js` | PASS | Non |
| P1-J (RA-15) | Locataire/Proprietaire list | `securityClosureP1WaveLocataireProprietaireListTenantAuthority...test.js` | PASS | Non |

**Vérifié via `SECURITY_CLOSURE_P1_WAVE1_SOURCE_FINDINGS.md`** : le backlog P1 réel contient bien 10 findings distincts (RA-04, RA-06, RA-07, RA-08, RA-10, RA-11, RA-12, RA-13, RA-14, RA-15), pas 9 — confirmé, aucune divergence.

**Conclusion Partie A** : les 24 protections connues (7 HZ + HF-FINAL-01 + RBAC-FINAL-01 + Message Read Authority + 5 P0 + 10 P1) restent toutes vertes, aucune régression détectée sur leur périmètre exact. Voir gates détaillés dans `_GATE_MATRIX.md`.
