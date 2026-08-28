# ARCH-2C1 — Inventaire des dépendances interdites

Inventaire exact du checker initial : **6 service→controller + 18 controller→controller**.

| ID | Source | Target | Type | Symbole utilisé | Responsabilité / classification | Risque |
|---|---|---|---|---|---|---|
| S01 | `services/accommodation/mobileAccommodationPublicationService.js` | `controllers/propertyMobileController.js` | service→controller | `buildMobilePropertyData` | B — construction payload applicatif mobile | Élevé : transaction/publication Property |
| S02 | `services/rentalLeaseRenewalService.js` | `controllers/contratController.js` | service→controller | `generatePaiements` | C — génération métier d'échéances | Élevé : finance/bail |
| S03 | `services/reporting/domains/accommodationReport.js` | `controllers/dashboardAnalyticsController.js` | service→controller | `accommodations` | B — agrégat analytique | Moyen : reporting Mongo |
| S04 | `services/reporting/domains/hotelReport.js` | `controllers/dashboardAnalyticsController.js` | service→controller | `hotels` | B — agrégat analytique | Moyen/élevé : hôtel/finance |
| S05 | `services/reporting/domains/immobilierReport.js` | `controllers/dashboardAnalyticsController.js` | service→controller | `sales` | B — agrégat analytique | Moyen : Property/scope |
| S06 | `services/reporting/domains/locationReport.js` | `controllers/dashboardAnalyticsController.js` | service→controller | `rentals` | B — agrégat analytique | Moyen/élevé : location/finance |
| C01 | `controllers/accommodationController.js` | `controllers/propertyController.js` | controller→controller | `uploadFilesToCloudinary`, `parseAmenities`, `parseStringArray`, `parseNonNegativeAmount`, `parseAddress`, `parseGeoLocation`, `buildBasePropertyData`, `parseNumericField` | A/B — parsing et construction Property | Élevé |
| C02 | `controllers/altimmoSearchController.js` | `controllers/propertyController.js` | controller→controller | `runPropertySearch` | B — recherche Property | Élevé : public/modération |
| C03 | `controllers/conversationController.js` | `controllers/messageController.js` | controller→controller | `serializeMessage` | E — serializer/presenter | Faible à moyen : données privées |
| C04 | `controllers/hotelController.js` | `controllers/propertyController.js` | controller→controller | `uploadFilesToCloudinary`, `parseAmenities`, `parseStringArray`, `parseNonNegativeAmount`, `parseAddress`, `parseGeoLocation`, `buildBasePropertyData` | A/B — parsing et construction Property | Élevé |
| C05 | `controllers/internalMailController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C06 | `controllers/litigeController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C07 | `controllers/locataireController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C08 | `controllers/messageController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C09 | `controllers/paiementController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Moyen : preuve de paiement |
| C10 | `controllers/propertyPortfolioController.js` | `controllers/userController.js` | controller→controller | `expandScopeWithUnaffiliatedUsersIfSoleTenant` | F — scope tenant utilisateur | Élevé |
| C11 | `controllers/proprietaireController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C12 | `controllers/rentalContractRegularizationController.js` | `controllers/userController.js` | controller→controller | `expandScopeWithUnaffiliatedUsersIfSoleTenant` | F — scope tenant utilisateur | Élevé |
| C13 | `controllers/rentalMaintenanceController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C14 | `controllers/rentalManagementController.js` | `controllers/userController.js` | controller→controller | `expandScopeWithUnaffiliatedUsersIfSoleTenant` | F — scope tenant utilisateur | Élevé |
| C15 | `controllers/rentalPropertyController.js` | `controllers/propertyController.js` | controller→controller | `uploadFilesToCloudinary`, parseurs Property, `buildBasePropertyData` | A/B — parsing et construction Property | Élevé |
| C16 | `controllers/salePropertyController.js` | `controllers/propertyController.js` | controller→controller | `uploadFilesToCloudinary`, parseurs Property, `buildBasePropertyData` | A/B — parsing et construction Property | Élevé |
| C17 | `controllers/signalementController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |
| C18 | `controllers/tenantPortalController.js` | `controllers/rentalDocumentController.js` | controller→controller | `streamRemoteDocument` | D — proxy streaming HTTP(S) | Faible, sécurité sensible |

`streamRemoteDocument` reçoit seulement `{ url, name, res, context }`; ce n'est pas un handler HTTP et il ne réalise aucun accès DB, tenant, ownership ou IAM. Ces contrôles précèdent chaque appel.
