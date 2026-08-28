# ARCH-2D2 — Cinq edges restantes

| # | Service | Controller | Symbol | Responsibility | Cluster | Risk |
|---:|---|---|---|---|---|---|
| 1 | `services/accommodation/mobileAccommodationPublicationService.js` | `controllers/propertyMobileController.js` | `buildMobilePropertyData` | Mapping et validation pure du payload Property mobile | Publication input | Faible pour le helper, élevé pour l'orchestrateur non déplacé |
| 2 | `services/reporting/domains/accommodationReport.js` | `controllers/dashboardAnalyticsController.js` | `accommodations` | Agrégats Accommodation, réservations et finance | Reporting | Élevé/transversal |
| 3 | `services/reporting/domains/hotelReport.js` | `controllers/dashboardAnalyticsController.js` | `hotels` | Scope hôtel, occupation, opérations et finance | Reporting | Élevé/transversal |
| 4 | `services/reporting/domains/immobilierReport.js` | `controllers/dashboardAnalyticsController.js` | `sales` | Agrégats Property, visites et transactions | Reporting | Élevé/transversal |
| 5 | `services/reporting/domains/locationReport.js` | `controllers/dashboardAnalyticsController.js` | `rentals` | Agrégats baux, paiements et maintenance | Reporting | Élevé/transversal |

Chaque service appelle une fois son symbole. `buildMobilePropertyData` avait aussi un appel interne dans le controller. Il ne dépend d'aucun modèle, contexte HTTP ou provider et ne produit aucun side effect. Les quatre fonctions reporting font de nombreuses lectures Mongo ; `hotels` applique en plus le scope tenant/hôtel et peut lever une erreur 403.
