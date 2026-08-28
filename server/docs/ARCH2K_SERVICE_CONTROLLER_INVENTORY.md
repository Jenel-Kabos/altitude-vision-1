# ARCH-2K — Inventaire exact service→controller

| # | Source service | Target controller | Imported symbol | Calls | Domain |
|---:|---|---|---|---:|---|
| 1 | `services/reporting/domains/accommodationReport.js` | `controllers/dashboardAnalyticsController.js` | `accommodations` | 1 | REPORTING / accommodation / finance |
| 2 | `services/reporting/domains/hotelReport.js` | `controllers/dashboardAnalyticsController.js` | `hotels` | 1 | REPORTING / hotel / finance / IAM |
| 3 | `services/reporting/domains/locationReport.js` | `controllers/dashboardAnalyticsController.js` | `rentals` | 1 | REPORTING / rental / finance / property |

Les trois imports sont réels dans HEAD et présents dans `architecture/baseline.json`. Chaque DomainReport appelle une fois le symbole importé. Les trois fonctions sont aussi appelées depuis `getModuleAnalytics`, donc déplacer leur owner pourrait réellement supprimer une edge et faire 3→2.

## Runtime

Toutes sont **LIVE** :

- `/api/dashboard-analytics/:module` → `dashboardAnalyticsController.getModuleAnalytics` → fonction concernée ;
- `/api/reporting/executive|domains/:domain|export/*` → `reportingController` → `reportingService` → DomainReport → fonction concernée ;
- l'executive report est aussi consommé par `erpService`.

Aucune edge n'est legacy ou morte. Les routes Reporting et Dashboard Analytics sont montées dans `server.js`.
