# ARCH-2J — Matrice de refactor

| Service source | Controller target | Imported symbol | New owner | Edge removed |
|---|---|---|---|---|
| `reporting/domains/immobilierReport.js` | `dashboardAnalyticsController.js` | `sales` | `reporting/immobilierReportQueryService.getImmobilierReportData` | Oui |

Le controller importe lui aussi le nouvel owner pour `/dashboard-analytics/sales`. L'ancien helper et son export ont été supprimés ; aucune duplication ne subsiste.
