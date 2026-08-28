# ARCH-2A — Baseline des dettes

## Service → Controller — 6 arêtes

- `services/accommodation/mobileAccommodationPublicationService.js` → `controllers/propertyMobileController.js`
- `services/rentalLeaseRenewalService.js` → `controllers/contratController.js`
- `services/reporting/domains/accommodationReport.js` → `controllers/dashboardAnalyticsController.js`
- `services/reporting/domains/hotelReport.js` → `controllers/dashboardAnalyticsController.js`
- `services/reporting/domains/immobilierReport.js` → `controllers/dashboardAnalyticsController.js`
- `services/reporting/domains/locationReport.js` → `controllers/dashboardAnalyticsController.js`

## Controller → Controller — 18 arêtes

- `controllers/accommodationController.js` → `controllers/propertyController.js`
- `controllers/altimmoSearchController.js` → `controllers/propertyController.js`
- `controllers/conversationController.js` → `controllers/messageController.js`
- `controllers/hotelController.js` → `controllers/propertyController.js`
- `controllers/internalMailController.js` → `controllers/rentalDocumentController.js`
- `controllers/litigeController.js` → `controllers/rentalDocumentController.js`
- `controllers/locataireController.js` → `controllers/rentalDocumentController.js`
- `controllers/messageController.js` → `controllers/rentalDocumentController.js`
- `controllers/paiementController.js` → `controllers/rentalDocumentController.js`
- `controllers/propertyPortfolioController.js` → `controllers/userController.js`
- `controllers/proprietaireController.js` → `controllers/rentalDocumentController.js`
- `controllers/rentalContractRegularizationController.js` → `controllers/userController.js`
- `controllers/rentalMaintenanceController.js` → `controllers/rentalDocumentController.js`
- `controllers/rentalManagementController.js` → `controllers/userController.js`
- `controllers/rentalPropertyController.js` → `controllers/propertyController.js`
- `controllers/salePropertyController.js` → `controllers/propertyController.js`
- `controllers/signalementController.js` → `controllers/rentalDocumentController.js`
- `controllers/tenantPortalController.js` → `controllers/rentalDocumentController.js`

## Route → Model — 17 arêtes / 13 routes

- `routes/contratRoutes.js` → `models/Contrat.js`
- `routes/dashboardRoutes.js` → `models/Event.js`
- `routes/dashboardRoutes.js` → `models/portfolioItemModel.js`
- `routes/dashboardRoutes.js` → `models/Property.js`
- `routes/dashboardRoutes.js` → `models/User.js`
- `routes/devisRoutes.js` → `models/Devis.js`
- `routes/estimationRoutes.js` → `models/Estimation.js`
- `routes/gestionDocumentRoutes.js` → `models/Contrat.js`
- `routes/gestionDocumentRoutes.js` → `models/Paiement.js`
- `routes/locataireRoutes.js` → `models/Locataire.js`
- `routes/paiementRoutes.js` → `models/Paiement.js`
- `routes/platformTenantRoutes.js` → `models/PlatformTenantDomain.js`
- `routes/proprietaireRoutes.js` → `models/Proprietaire.js`
- `routes/projetsRoutes.js` → `models/Projet.js`
- `routes/realisationsRoutes.js` → `models/Realisation.js`
- `routes/rentalManagementRoutes.js` → `models/RentalManagement.js`
- `routes/userBusinessProfileRoutes.js` → `models/User.js`

## Cycle fort connu — 1

**Cycle CRM / Marketing / Notification**

- `services/crmAutomationActions.js`
- `services/crmAutomationEngine.js`
- `services/crmCockpitService.js`
- `services/crmScoreService.js`
- `services/crmService.js`
- `services/marketingCampaignService.js`
- `services/marketingSegmentService.js`
- `services/notificationService.js`

## Politique

Chaque entrée est individuelle, temporaire et consommée par `architecture/baseline.json`. Une nouvelle arête ou une signature de cycle différente échoue. Une entrée disparue échoue comme stale et doit être retirée. Le snapshot compact mémorise seulement les compteurs utiles, jamais les 1 508 arêtes.

