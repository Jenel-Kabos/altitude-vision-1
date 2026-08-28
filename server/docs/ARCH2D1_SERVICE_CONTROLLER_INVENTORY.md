# ARCH-2D1 — Inventaire service→controller

| # | Service source | Controller target | Symbol | Calls | Responsibility | Domain | Class / risk |
|---:|---|---|---|---:|---|---|---|
| 1 | `services/accommodation/mobileAccommodationPublicationService.js` | `controllers/propertyMobileController.js` | `buildMobilePropertyData` | 1 | Construire les données Property d'une publication mobile | Accommodation / Property | G mutation-orchestration, élevé |
| 2 | `services/rentalLeaseRenewalService.js` | `controllers/contratController.js` | `generatePaiements` | 1 | Générer et insérer les échéances mensuelles impayées | Rental | D domain service, moyen |
| 3 | `services/reporting/domains/accommodationReport.js` | `controllers/dashboardAnalyticsController.js` | `accommodations` | 1 | Produire l'agrégat analytique hébergement | Reporting | I mixed query/presenter, élevé |
| 4 | `services/reporting/domains/hotelReport.js` | `controllers/dashboardAnalyticsController.js` | `hotels` | 1 | Produire l'agrégat analytique hôtel | Reporting | I mixed query/presenter, élevé |
| 5 | `services/reporting/domains/immobilierReport.js` | `controllers/dashboardAnalyticsController.js` | `sales` | 1 | Produire l'agrégat analytique ventes | Reporting | I mixed query/presenter, élevé |
| 6 | `services/reporting/domains/locationReport.js` | `controllers/dashboardAnalyticsController.js` | `rentals` | 1 | Produire l'agrégat analytique locations | Reporting | I mixed query/presenter, élevé |

Les six imports ciblent des helpers/fonctions de domaine mal hébergés, pas l'import direct d'un handler Express complet par son appelant. Le cluster reporting reste néanmoins mêlé à des requêtes, scopes et présentations de dashboard. `generatePaiements` ne reçoit ni `req`, ni `res`, ni `next`; il dépend uniquement du modèle `Paiement`.
